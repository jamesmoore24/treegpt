#!/usr/bin/env python3
"""
RLM Python harness — faithful implementation of the paper's multi-turn REPL approach.

The root LM writes code in ```repl``` blocks, sees the execution output, and
iterates until it writes FINAL(...) or FINAL_VAR(...) outside a code block.
Sub-LMs (llm_query / llm_query_batched) answer directly at depth=1.
"""
import os
import sys
import json
import re
import io
import contextlib
import concurrent.futures
import requests

SESSION_ID = os.environ.get("SESSION_ID", "")
NEXT_JS_URL = os.environ.get("NEXT_JS_URL", "http://localhost:3000")
MODEL = os.environ.get("MODEL", "llama3.1-8b")
PROMPT = os.environ.get("PROMPT", "")
MAX_ITERATIONS = int(os.environ.get("MAX_ITERATIONS", "10"))

# Read context from file to avoid ARG_MAX env var size limits
_context_file = os.environ.get("CONTEXT_FILE", "")
if _context_file and os.path.exists(_context_file):
    with open(_context_file, "r", encoding="utf-8") as _f:
        CONTEXT = _f.read()
    sys.stderr.write(f"[rlm_repl] CONTEXT loaded from file: {len(CONTEXT)} chars\n")
else:
    CONTEXT = ""
    sys.stderr.write(f"[rlm_repl] CONTEXT_FILE={_context_file!r} not found or empty, context is empty\n")

_call_counter = [0]


# ─── HTTP helpers ─────────────────────────────────────────────────────────────

def _push_event(event: dict):
    try:
        requests.post(
            f"{NEXT_JS_URL}/api/rlm-push-event",
            json={"sessionId": SESSION_ID, "event": event},
            timeout=10,
        )
    except Exception as e:
        sys.stderr.write(f"[push_event error]: {e}\n")


def _root_llm_call(messages: list) -> str:
    """Call the root LLM with the full conversation history."""
    try:
        resp = requests.post(
            f"{NEXT_JS_URL}/api/rlm-root-call",
            json={"messages": messages, "model": MODEL},
            timeout=180,
        )
        return resp.json().get("response", "")
    except Exception as e:
        sys.stderr.write(f"[root_llm_call error]: {e}\n")
        return ""


def _sub_llm_call(prompt: str, ctx=None) -> str:
    """Direct LLM answer for llm_query() sub-calls (depth=1)."""
    _call_counter[0] += 1
    node_id = f"node_{_call_counter[0]}"
    effective_ctx = ctx if ctx is not None else CONTEXT

    _push_event({
        "type": "node_start",
        "nodeId": node_id,
        "parentId": "root",
        "depth": 1,
        "prompt": prompt,
    })

    try:
        resp = requests.post(
            f"{NEXT_JS_URL}/api/llm-answer",
            json={"prompt": prompt, "context": effective_ctx, "model": MODEL},
            timeout=120,
        )
        response = resp.json().get("response", "")
    except Exception as e:
        response = f"[llm_query error]: {e}"

    _push_event({"type": "node_complete", "nodeId": node_id, "response": response})
    return response


def _sub_llm_batched(prompts: list, ctx=None) -> list:
    """Concurrent llm_query calls — much faster than sequential for independent queries."""
    with concurrent.futures.ThreadPoolExecutor() as executor:
        futures = [executor.submit(_sub_llm_call, p, ctx) for p in prompts]
        return [f.result() for f in futures]


# ─── REPL execution ───────────────────────────────────────────────────────────

def _exec_repl_block(code: str, namespace: dict) -> tuple[str, str]:
    """Execute a repl block in the shared namespace; return (stdout, stderr)."""
    stdout_buf = io.StringIO()
    stderr_buf = io.StringIO()
    try:
        with contextlib.redirect_stdout(stdout_buf), contextlib.redirect_stderr(stderr_buf):
            exec(code, namespace)
    except Exception as e:
        stderr_buf.write(f"Error: {e}\n")
    return stdout_buf.getvalue(), stderr_buf.getvalue()


def _extract_repl_blocks(text: str) -> list[str]:
    """Extract code from ```repl ... ``` blocks in LLM response."""
    return re.findall(r"```repl\n(.*?)```", text, re.DOTALL)


def _extract_final(text: str, namespace: dict):
    """
    Detect FINAL(...) or FINAL_VAR(...) written by the LLM outside code blocks.
    Returns the final answer string, or None if not found.
    """
    # Strip repl blocks so we don't match inside code
    stripped = re.sub(r"```repl\n.*?```", "", text, flags=re.DOTALL)

    m = re.search(r"FINAL_VAR\((\w+)\)", stripped)
    if m:
        var_name = m.group(1)
        val = namespace.get(var_name)
        if val is not None:
            return str(val)
        return f"[variable '{var_name}' not found in REPL namespace]"

    m = re.search(r"FINAL\((.+?)\)", stripped, re.DOTALL)
    if m:
        return m.group(1).strip().strip("\"'")

    return None


# ─── System prompt (copied verbatim from paper's rlm/utils/prompts.py) ────────

SYSTEM_PROMPT = """You are tasked with answering a query with associated context. You can access, transform, and analyze this context interactively in a REPL environment that can recursively query sub-LLMs, which you are strongly encouraged to use as much as possible. You will be queried iteratively until you provide a final answer.

The REPL environment is initialized with:
1. A `context` variable that contains extremely important information about your query. You should check the content of the `context` variable to understand what you are working with. Make sure you look through it sufficiently as you answer your query.
2. A `llm_query` function that allows you to query an LLM (that can handle around 500K chars) inside your REPL environment.
3. A `llm_query_batched` function that allows you to query multiple prompts concurrently: `llm_query_batched(prompts: List[str]) -> List[str]`. This is much faster than sequential `llm_query` calls when you have multiple independent queries. Results are returned in the same order as the input prompts.
4. A `SHOW_VARS()` function that returns all variables you have created in the REPL. Use this to check what variables exist before using FINAL_VAR.
5. The ability to use `print()` statements to view the output of your REPL code and continue your reasoning.

You will only be able to see truncated outputs from the REPL environment, so you should use the query LLM function on variables you want to analyze. You will find this function especially useful when you have to analyze the semantics of the context. Use these variables as buffers to build up your final answer.
Make sure to explicitly look through the entire context in REPL before answering your query. An example strategy is to first look at the context and figure out a chunking strategy, then break up the context into smart chunks, and query an LLM per chunk with a particular question and save the answers to a buffer, then query an LLM with all the buffers to produce your final answer.

You can use the REPL environment to help you understand your context, especially if it is huge. Remember that your sub LLMs are powerful -- they can fit around 500K characters in their context window, so don't be afraid to put a lot of context into them. For example, a viable strategy is to feed 10 documents per sub-LLM query. Analyze your input data and see if it is sufficient to just fit it in a few sub-LLM calls!

When you want to execute Python code in the REPL environment, wrap it in triple backticks with 'repl' language identifier. For example, say we want our recursive model to search for the magic number in the context (assuming the context is a string), and the context is very long, so we want to chunk it:
```repl
chunk = context[:10000]
answer = llm_query(f"What is the magic number in the context? Here is the chunk: {chunk}")
print(answer)
```

As an example, suppose you're trying to answer a question about a book. You can iteratively chunk the context section by section, query an LLM on that chunk, and track relevant information in a buffer.
```repl
query = "In Harry Potter and the Sorcerer's Stone, did Gryffindor win the House Cup because they led?"
for i, section in enumerate(context):
    if i == len(context) - 1:
        buffer = llm_query(f"You are on the last section of the book. So far you know that: {buffers}. Gather from this last section to answer {query}. Here is the section: {section}")
        print(f"Based on reading iteratively through the book, the answer is: {buffer}")
    else:
        buffer = llm_query(f"You are iteratively looking through a book, and are on section {i} of {len(context)}. Gather information to help answer {query}. Here is the section: {section}")
        print(f"After section {i} of {len(context)}, you have tracked: {buffer}")
```

As another example, when the context isn't that long (e.g. >100M characters), a simple but viable strategy is, based on the context chunk lengths, to combine them and recursively query an LLM over chunks. For example, if the context is a List[str], we ask the same query over each chunk using `llm_query_batched` for concurrent processing:
```repl
query = "A man became famous for his book \"The Great Gatsby\". How many jobs did he have?"
# Suppose our context is ~1M chars, and we want each sub-LLM query to be ~0.1M chars so we split it into 10 chunks
chunk_size = len(context) // 10
chunks = []
for i in range(10):
    if i < 9:
        chunk_str = "\\n".join(context[i*chunk_size:(i+1)*chunk_size])
    else:
        chunk_str = "\\n".join(context[i*chunk_size:])
    chunks.append(chunk_str)

# Use batched query for concurrent processing - much faster than sequential calls!
prompts = [f"Try to answer the following query: {query}. Here are the documents:\\n{chunk}. Only answer if you are confident in your answer based on the evidence." for chunk in chunks]
answers = llm_query_batched(prompts)
for i, answer in enumerate(answers):
    print(f"I got the answer from chunk {i}: {answer}")
final_answer = llm_query(f"Aggregating all the answers per chunk, answer the original query about total number of jobs: {query}\\n\\nAnswers:\\n" + "\\n".join(answers))
```

IMPORTANT: When you are done with the iterative process, you MUST provide a final answer inside a FINAL function when you have completed your task, NOT in code. Do not use these tags unless you have completed your task. You have two options:
1. Use FINAL(your final answer here) to provide the answer directly
2. Use FINAL_VAR(variable_name) to return a variable you have created in the REPL environment as your final output

WARNING - COMMON MISTAKE: FINAL_VAR retrieves an EXISTING variable. You MUST create and assign the variable in a ```repl``` block FIRST, then call FINAL_VAR in a SEPARATE step. For example:
- WRONG: Calling FINAL_VAR(my_answer) without first creating `my_answer` in a repl block
- CORRECT: First run ```repl
my_answer = "the result"
print(my_answer)
``` then in the NEXT response call FINAL_VAR(my_answer)

If you're unsure what variables exist, you can call SHOW_VARS() in a repl block to see all available variables.

Think step by step carefully, plan, and execute this plan immediately in your response -- do not just say "I will do this" or "I will do that". Output to the REPL environment and recursive LLMs as much as possible. Remember to explicitly answer the original query in your final answer."""

if not PROMPT:
    sys.stderr.write("[rlm_repl] No PROMPT provided\n")
    sys.exit(1)

# ─── Build initial conversation ───────────────────────────────────────────────

context_len = len(CONTEXT)
context_type = "str"

metadata_prompt = f"Your context is a {context_type} with {context_len} total characters."

initial_user_prompt = (
    f"You have been asked: {PROMPT}\n\n"
    "Think step-by-step on what to do using the REPL environment (which contains the context) "
    "to answer the prompt. You have not interacted with the REPL environment or seen your "
    "context yet. Your next action should be to look through and figure out how to answer the "
    "prompt, so don't just provide a final answer yet.\n\nYour next action:"
)

conversation = [
    {"role": "system", "content": SYSTEM_PROMPT},
    {"role": "assistant", "content": metadata_prompt},
    {"role": "user", "content": initial_user_prompt},
]

# ─── REPL namespace ──────────────────────────────────────────────────────────

_repl_locals: dict = {}


def SHOW_VARS():
    return {k: type(v).__name__ for k, v in _repl_locals.items()}


repl_namespace: dict = {
    "context": CONTEXT,
    "llm_query": _sub_llm_call,
    "llm_query_batched": _sub_llm_batched,
    "SHOW_VARS": SHOW_VARS,
    "__builtins__": __builtins__,
}

# ─── Multi-turn REPL loop ────────────────────────────────────────────────────

final_answer = None

for iteration in range(MAX_ITERATIONS):
    _push_event({"type": "iteration_start", "iteration": iteration})

    response = _root_llm_call(conversation)
    if not response:
        break

    _push_event({"type": "llm_response", "iteration": iteration, "text": response})

    # Extract and execute all ```repl``` blocks
    repl_blocks = _extract_repl_blocks(response)
    repl_outputs: list[dict] = []

    for code in repl_blocks:
        _push_event({"type": "repl_exec", "iteration": iteration, "code": code})
        stdout, stderr = _exec_repl_block(code, repl_namespace)
        # Sync any new variables back to _repl_locals for SHOW_VARS / FINAL_VAR
        _repl_locals.update({
            k: v for k, v in repl_namespace.items()
            if not k.startswith("_")
            and k not in ("context", "llm_query", "llm_query_batched", "SHOW_VARS")
        })
        output = stdout
        if stderr:
            output += f"[stderr]: {stderr}"
        repl_outputs.append({"code": code, "output": output})
        # Truncate output for push event to avoid oversized payloads
        push_output = output if len(output) <= 4000 else output[:4000] + f"\n... [truncated, {len(output)} chars total]"
        _push_event({"type": "repl_output", "iteration": iteration, "code": code, "output": push_output})

    # Add assistant turn to conversation
    conversation.append({"role": "assistant", "content": response})

    # Check for FINAL / FINAL_VAR in the LLM's text response
    final_answer = _extract_final(response, repl_namespace)
    if final_answer is not None:
        break

    # Build next user message: REPL output + continuation prompt
    # Truncate each block's output to keep conversation within model context limits
    MAX_REPL_OUTPUT = 3000
    repl_str = ""
    for block in repl_outputs:
        out = block['output']
        if len(out) > MAX_REPL_OUTPUT:
            out = out[:MAX_REPL_OUTPUT] + f"\n... [output truncated — {len(block['output'])} chars total. Use llm_query() to analyse large variables instead of print()]"
        repl_str += f"```\n{out}\n```\n"

    next_user = ""
    if repl_str:
        next_user += f"REPL output:\n{repl_str}\n\n"
    next_user += (
        f"Think step-by-step on what to do using the REPL environment (which contains the context) "
        f"to answer the original prompt: \"{PROMPT}\".\n\n"
        "Continue using the REPL environment, which has the `context` variable, and querying "
        "sub-LLMs by writing to ```repl``` tags, and determine your answer. Your next action:"
    )
    conversation.append({"role": "user", "content": next_user})

# ─── Output final result ──────────────────────────────────────────────────────

if final_answer is not None:
    print(json.dumps({"type": "FINAL", "result": final_answer}), flush=True)
else:
    print(json.dumps({"type": "FINAL", "result": "Max iterations reached without a final answer."}), flush=True)
