#!/usr/bin/env python3
"""
RLM FastAPI Service — runs the RLM loop as a persistent HTTP service.

Instead of being spawned as a subprocess per-request (with circular HTTP calls
back to Next.js), this service:
  - Receives {prompt, model, context} via POST /rlm-query
  - Makes direct API calls to Cerebras / DeepSeek from Python
  - Streams NDJSON events (same format the frontend already consumes)
  - Runs persistently — no cold-start overhead, no circular HTTP dependency

Start with:
  CEREBRAS_API_KEY=... DEEPSEEK_API_KEY=... python3 rlm_service.py
  # or via uvicorn:
  uvicorn rlm_service:app --host 0.0.0.0 --port 8000
"""

import os
import re
import io
import json
import threading
import contextlib
import concurrent.futures
import queue as sync_queue
import asyncio

from fastapi import FastAPI
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from openai import OpenAI

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── LLM clients ──────────────────────────────────────────────────────────────

CEREBRAS_MODELS = {"llama3.1-8b", "gpt-oss-120b", "qwen-3-235b-a22b-instruct-2507"}
DEEPSEEK_MODELS = {"deepseek-chat", "deepseek-reasoner"}

# Per-model context character limits for sub-LM calls
CONTEXT_LIMITS = {
    "llama3.1-8b": 30_000,
    "gpt-oss-120b": 60_000,
    "qwen-3-235b-a22b-instruct-2507": 100_000,
    "deepseek-chat": 200_000,
    "deepseek-reasoner": 200_000,
}


def _make_client(model: str) -> OpenAI:
    if model in DEEPSEEK_MODELS:
        return OpenAI(
            base_url="https://api.deepseek.com",
            api_key=os.environ["DEEPSEEK_API_KEY"],
        )
    return OpenAI(
        base_url="https://api.cerebras.ai/v1",
        api_key=os.environ["CEREBRAS_API_KEY"],
    )


def _chat_completion(client: OpenAI, model: str, messages: list, timeout: int = 180) -> str:
    """Blocking (synchronous) chat completion."""
    try:
        resp = client.chat.completions.create(
            model=model,
            messages=messages,
            temperature=0.7,
            timeout=timeout,
        )
        return resp.choices[0].message.content or ""
    except Exception as e:
        return f"[LLM error: {e}]"


# ─── System prompt ─────────────────────────────────────────────────────────────

SYSTEM_PROMPT = """You are tasked with answering a query with associated context. You can access, transform, and analyze this context interactively in a REPL environment that can recursively query sub-LLMs, which you are strongly encouraged to use as much as possible. You will be queried iteratively until you provide a final answer.

The REPL environment is initialized with:
1. A `context` variable that contains extremely important information about your query. You should check the content of the `context` variable to understand what you are working with. Make sure you look through it sufficiently as you answer your query.
2. A `llm_query` function that allows you to query an LLM inside your REPL environment.
3. A `llm_query_batched` function that allows you to query multiple prompts concurrently: `llm_query_batched(prompts: List[str]) -> List[str]`. This is much faster than sequential `llm_query` calls when you have multiple independent queries. Results are returned in the same order as the input prompts.
4. A `SHOW_VARS()` function that returns all variables you have created in the REPL. Use this to check what variables exist before using FINAL_VAR.
5. The ability to use `print()` statements to view the output of your REPL code and continue your reasoning.

STRATEGY for large context (e.g. a PDF):
- Phase 1 (first action): Inspect `context` structure — `print(len(context))` and `print(context[:3000])`.
- Phase 2: Use regex or string search to find natural chunk boundaries (section headers, paragraphs, etc.). Use `llm_query_batched` to analyze chunks in parallel.
- Phase 3: Aggregate sub-LM results into a final answer and call FINAL().

CRITICAL RULES:
- Do NOT pass the full context string into a single llm_query() call — chunk it first. Each sub-LM call can handle ~100K chars.
- Do NOT reassign or overwrite the `context` variable. Never do `context = ...`.
- You will only see truncated REPL output — use llm_query() to analyze large variables instead of print().

When you want to execute Python code in the REPL environment, wrap it in triple backticks with 'repl' language identifier:
```repl
chunk = context[:10000]
answer = llm_query(f"What is the answer to the question? Context: {chunk}")
print(answer)
```

Example — batched chunking strategy:
```repl
import re
# Inspect structure
print(f"Context length: {len(context)}")
print(context[:2000])
```
```repl
# Split into ~50K char chunks and query in parallel
chunk_size = 50000
chunks = [context[i:i+chunk_size] for i in range(0, len(context), chunk_size)]
print(f"Split into {len(chunks)} chunks")
prompts = [f"Answer this question about the following text: <QUESTION>\\n\\nText:\\n{c}" for c in chunks]
answers = llm_query_batched(prompts)
for i, a in enumerate(answers):
    print(f"Chunk {i}: {a[:200]}")
```
```repl
# Aggregate
final_answer = llm_query(f"Synthesize these answers into one complete response:\\n" + "\\n---\\n".join(answers))
print(final_answer)
```
FINAL_VAR(final_answer)

IMPORTANT: When you are done, provide a final answer using FINAL() or FINAL_VAR(), NOT inside a code block:
1. FINAL(your final answer here)
2. FINAL_VAR(variable_name) — returns a REPL variable you created earlier

WARNING — COMMON MISTAKE: FINAL_VAR retrieves an EXISTING variable. Create and assign it in a ```repl``` block FIRST, then call FINAL_VAR in your next response.

Think step by step. Execute immediately — do not just describe what you will do."""


# ─── REPL helpers ─────────────────────────────────────────────────────────────

def _exec_repl_block(code: str, namespace: dict) -> tuple[str, str]:
    stdout_buf = io.StringIO()
    stderr_buf = io.StringIO()
    try:
        with contextlib.redirect_stdout(stdout_buf), contextlib.redirect_stderr(stderr_buf):
            exec(code, namespace)
    except Exception as e:
        stderr_buf.write(f"Error: {type(e).__name__}: {e}\n")
    return stdout_buf.getvalue(), stderr_buf.getvalue()


def _extract_repl_blocks(text: str) -> list[str]:
    return re.findall(r"```repl\n(.*?)```", text, re.DOTALL)


def _extract_final(text: str, namespace: dict):
    """Detect FINAL(...) or FINAL_VAR(...) written outside code blocks."""
    stripped = re.sub(r"```repl\n.*?```", "", text, flags=re.DOTALL)

    m = re.search(r"FINAL_VAR\((\w+)\)", stripped)
    if m:
        var_name = m.group(1)
        val = namespace.get(var_name)
        return str(val) if val is not None else f"[variable '{var_name}' not found]"

    m = re.search(r"FINAL\((.+?)\)", stripped, re.DOTALL)
    if m:
        return m.group(1).strip().strip("\"'")

    # Handle "FINAL:\nsome answer" or "FINAL\nsome answer" (model writes it as a label)
    m = re.search(r"^FINAL[:\s]*\n(.+)", stripped, re.MULTILINE | re.DOTALL)
    if m:
        return m.group(1).strip()

    return None


# ─── Core RLM loop ────────────────────────────────────────────────────────────

PROTECTED_KEYS = frozenset(
    {"context", "llm_query", "llm_query_batched", "SHOW_VARS", "FINAL", "FINAL_VAR", "__builtins__"}
)


def run_rlm_loop(
    prompt: str,
    model: str,
    context: str,
    push: callable,
    max_iterations: int = 10,
):
    """
    Runs the full RLM loop synchronously. Calls push(event_dict) for every event.
    Designed to be run in a background thread.
    """
    client = _make_client(model)
    call_counter = [0]
    repl_final = [None]
    ctx_limit = CONTEXT_LIMITS.get(model, 30_000)

    # ── Sub-LM calls ──────────────────────────────────────────────────────────

    def _sub_llm_call(sub_prompt: str, ctx=None) -> str:
        call_counter[0] += 1
        node_id = f"node_{call_counter[0]}"

        push({"type": "node_start", "nodeId": node_id, "parentId": "root",
              "depth": 1, "prompt": sub_prompt})

        msgs = []
        effective_ctx = ctx if ctx is not None else ""
        if effective_ctx:
            truncated = (
                effective_ctx[:ctx_limit]
                + ("\n[context truncated]" if len(effective_ctx) > ctx_limit else "")
            )
            msgs.append({"role": "system",
                         "content": f"You are a helpful assistant.\n\nContext:\n{truncated}"})
        msgs.append({"role": "user", "content": sub_prompt})

        response = _chat_completion(client, model, msgs, timeout=120)
        push({"type": "node_complete", "nodeId": node_id, "response": response})
        return response

    def _sub_llm_batched(prompts: list, ctx=None) -> list:
        with concurrent.futures.ThreadPoolExecutor() as executor:
            futures = [executor.submit(_sub_llm_call, p, ctx) for p in prompts]
            return [f.result() for f in futures]

    # ── REPL special functions ─────────────────────────────────────────────────

    def _FINAL(answer):
        repl_final[0] = str(answer)
        return answer

    def _FINAL_VAR(var_name: str):
        val = repl_namespace.get(var_name)
        if val is not None:
            repl_final[0] = str(val)
            return val
        return f"[variable '{var_name}' not found]"

    def _SHOW_VARS():
        return {k: type(v).__name__ for k, v in repl_namespace.items()
                if not k.startswith("_") and k not in PROTECTED_KEYS}

    repl_namespace: dict = {
        "context": context,
        "llm_query": _sub_llm_call,
        "llm_query_batched": _sub_llm_batched,
        "SHOW_VARS": _SHOW_VARS,
        "FINAL": _FINAL,
        "FINAL_VAR": _FINAL_VAR,
        "__builtins__": __builtins__,
    }

    def _restore_protected():
        """Restore namespace vars the model may have accidentally overwritten."""
        repl_namespace["context"] = context
        repl_namespace["llm_query"] = _sub_llm_call
        repl_namespace["llm_query_batched"] = _sub_llm_batched
        repl_namespace["SHOW_VARS"] = _SHOW_VARS
        repl_namespace["FINAL"] = _FINAL
        repl_namespace["FINAL_VAR"] = _FINAL_VAR

    # ── Build initial conversation ─────────────────────────────────────────────

    try:
        context_type = type(json.loads(context)).__name__
    except (json.JSONDecodeError, ValueError):
        context_type = "str"

    metadata_msg = f"Your context is a {context_type} with {len(context)} total characters."

    initial_user_prompt = (
        f"You have been asked: {prompt}\n\n"
        "IMPORTANT RULES:\n"
        "1. The `context` variable already contains the document/data. Do NOT reassign it.\n"
        "2. Chunk the context before passing to llm_query() — never pass the full context in one call.\n"
        "3. Start by inspecting: `print(len(context))` and `print(context[:3000])`\n\n"
        "You have not interacted with the REPL environment yet. "
        "Your first action should be to inspect the context and plan your approach. "
        "Do not provide a final answer yet.\n\nYour next action:"
    )

    conversation = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "assistant", "content": metadata_msg},
        {"role": "user", "content": initial_user_prompt},
    ]

    # ── Main loop ──────────────────────────────────────────────────────────────

    final_answer = None
    MAX_REPL_OUTPUT = 10_000

    for iteration in range(max_iterations):
        push({"type": "iteration_start", "iteration": iteration})

        response = _chat_completion(client, model, conversation, timeout=180)
        if not response or response.startswith("[LLM error"):
            push({"type": "error", "error": response or "Empty response from root LLM"})
            break

        push({"type": "llm_response", "iteration": iteration, "text": response})

        repl_blocks = _extract_repl_blocks(response)
        repl_outputs = []

        for code in repl_blocks:
            push({"type": "repl_exec", "iteration": iteration, "code": code})
            repl_final[0] = None  # reset per block
            stdout, stderr = _exec_repl_block(code, repl_namespace)
            _restore_protected()

            output = stdout + (f"\n[stderr]: {stderr}" if stderr else "")
            repl_outputs.append({"code": code, "output": output})

            truncated_out = (
                output if len(output) <= 4000
                else output[:4000] + f"\n... [{len(output)} chars total]"
            )
            push({"type": "repl_output", "iteration": iteration,
                  "code": code, "output": truncated_out})

            if repl_final[0] is not None:
                final_answer = repl_final[0]
                break

        if final_answer is not None:
            break

        conversation.append({"role": "assistant", "content": response})

        # Check for FINAL() / FINAL_VAR() written outside code blocks
        final_answer = _extract_final(response, repl_namespace)
        if final_answer is not None:
            break

        # Build the next user turn: REPL output + continuation prompt
        repl_str = ""
        for block in repl_outputs:
            out = block["output"]
            if len(out) > MAX_REPL_OUTPUT:
                out = (out[:MAX_REPL_OUTPUT]
                       + f"\n... [truncated — {len(block['output'])} chars total. "
                       "Use llm_query() to analyse large variables instead of print()]")
            repl_str += f"```\n{out}\n```\n"

        next_user = ""
        if repl_str:
            next_user += f"REPL output:\n{repl_str}\n\n"
        next_user += (
            f"Continue working toward answering: \"{prompt}\".\n"
            "Your REPL variables from previous iterations are still available — "
            "do NOT re-read the context or redo previous work. Build on what you have.\n"
            "Your next action:"
        )
        conversation.append({"role": "user", "content": next_user})

    # ── Synthesis ──────────────────────────────────────────────────────────────
    # One final sub-LM call to convert raw REPL output into a clean human-readable answer.

    push({"type": "synthesis_start"})
    MAX_RAW = 8_000

    if final_answer:
        raw = final_answer[:MAX_RAW] + ("..." if len(final_answer) > MAX_RAW else "")
        synth_prompt = (
            f"Original question: {prompt}\n\n"
            f"Research findings:\n{raw}\n\n"
            f"Provide a clear, complete, well-formatted answer to the original question. "
            f"Interpret any raw data (lists, numbers, etc.) in context of the question."
        )
    else:
        recent = "\n\n".join(
            f"[{m['role'].upper()}]: {m['content'][:1000]}"
            for m in conversation[-6:]
        )[:MAX_RAW]
        synth_prompt = (
            f"Original question: {prompt}\n\n"
            f"Recent research steps:\n{recent}\n\n"
            f"Based on the research done, provide the best possible answer to the original question."
        )

    synthesized = _sub_llm_call(synth_prompt)
    if synthesized and not synthesized.startswith("[LLM error"):
        final_answer = synthesized

    result = final_answer or "No answer could be determined."
    push({"type": "session_end", "nodeId": "root", "parentId": None, "response": result})


# ─── FastAPI endpoint ──────────────────────────────────────────────────────────

class RLMRequest(BaseModel):
    prompt: str
    model: str = "llama3.1-8b"
    context: str = ""
    max_iterations: int = 10


@app.post("/rlm-query")
async def rlm_query(body: RLMRequest):
    event_queue: sync_queue.Queue = sync_queue.Queue()

    def run():
        try:
            run_rlm_loop(
                prompt=body.prompt,
                model=body.model,
                context=body.context,
                push=lambda e: event_queue.put(e),
                max_iterations=body.max_iterations,
            )
        except Exception as e:
            event_queue.put({"type": "error", "error": str(e)})
        finally:
            event_queue.put(None)  # sentinel to end the stream

    thread = threading.Thread(target=run, daemon=True)
    thread.start()

    async def generate():
        loop = asyncio.get_event_loop()
        while True:
            # Block in executor so we don't stall the event loop
            event = await loop.run_in_executor(None, event_queue.get)
            if event is None:
                break
            yield json.dumps(event) + "\n"

    return StreamingResponse(generate(), media_type="text/event-stream")


@app.get("/health")
async def health():
    return {"status": "ok"}


if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("RLM_PORT", "8000"))
    uvicorn.run(app, host="0.0.0.0", port=port)
