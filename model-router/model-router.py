import os
from typing import List, Optional
from pydantic import BaseModel
import numpy as np
import torch
from torch import nn
from torch.nn import functional as F
from fastapi import FastAPI, HTTPException
from openai import OpenAI
from dotenv import load_dotenv
from safetensors.torch import load_file

import torch
from huggingface_hub import PyTorchModelHubMixin

load_dotenv()
OPENAI_CLIENT = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

app = FastAPI()

MODEL_IDS = {
    "RWKV-4-Raven-14B": 0,
    "alpaca-13b": 1,
    "chatglm-6b": 2,
    "chatglm2-6b": 3,
    "chatglm3-6b": 4,
    "claude-1": 5,
    "claude-2.0": 6,
    "claude-2.1": 7,
    "claude-instant-1": 8,
    "codellama-34b-instruct": 9,
    "deepseek-llm-67b-chat": 10,
    "dolly-v2-12b": 11,
    "dolphin-2.2.1-mistral-7b": 12,
    "falcon-180b-chat": 13,
    "fastchat-t5-3b": 14,
    "gemini-pro": 15,
    "gemini-pro-dev-api": 16,
    "gpt-3.5-turbo-0125": 17,
    "gpt-3.5-turbo-0314": 18,
    "gpt-3.5-turbo-0613": 19,
    "gpt-3.5-turbo-1106": 20,
    "gpt-4-0125-preview": 21,
    "gpt-4-0314": 22,
    "gpt-4-0613": 23,
    "gpt-4-1106-preview": 24,
    "gpt4all-13b-snoozy": 25,
    "guanaco-33b": 26,
    "koala-13b": 27,
    "llama-13b": 28,
    "llama-2-13b-chat": 29,
    "llama-2-70b-chat": 30,
    "llama-2-7b-chat": 31,
    "llama2-70b-steerlm-chat": 32,
    "mistral-7b-instruct": 33,
    "mistral-7b-instruct-v0.2": 34,
    "mistral-medium": 35,
    "mixtral-8x7b-instruct-v0.1": 36,
    "mpt-30b-chat": 37,
    "mpt-7b-chat": 38,
    "nous-hermes-2-mixtral-8x7b-dpo": 39,
    "oasst-pythia-12b": 40,
    "openchat-3.5": 41,
    "openchat-3.5-0106": 42,
    "openhermes-2.5-mistral-7b": 43,
    "palm-2": 44,
    "pplx-70b-online": 45,
    "pplx-7b-online": 46,
    "qwen-14b-chat": 47,
    "qwen1.5-4b-chat": 48,
    "qwen1.5-72b-chat": 49,
    "qwen1.5-7b-chat": 50,
    "solar-10.7b-instruct-v1.0": 51,
    "stablelm-tuned-alpha-7b": 52,
    "starling-lm-7b-alpha": 53,
    "stripedhyena-nous-7b": 54,
    "tulu-2-dpo-70b": 55,
    "vicuna-13b": 56,
    "vicuna-33b": 57,
    "vicuna-7b": 58,
    "wizardlm-13b": 59,
    "wizardlm-70b": 60,
    "yi-34b-chat": 61,
    "zephyr-7b-alpha": 62,
    "zephyr-7b-beta": 63,
}


class MFModel(torch.nn.Module, PyTorchModelHubMixin):
    def __init__(
        self,
        dim,
        num_models,
        text_dim,
        num_classes,
        use_proj,
    ):
        super().__init__()
        self._name = "TextMF"
        self.use_proj = use_proj
        self.P = torch.nn.Embedding(num_models, dim)

        self.embedding_model = "text-embedding-3-small"

        if self.use_proj:
            self.text_proj = torch.nn.Sequential(
                torch.nn.Linear(text_dim, dim, bias=False)
            )
        else:
            assert (
                text_dim == dim
            ), f"text_dim {text_dim} must be equal to dim {dim} if not using projection"

        self.classifier = torch.nn.Sequential(
            torch.nn.Linear(dim, num_classes, bias=False)
        )

    def get_device(self):
        return self.P.weight.device

    def forward(self, model_id, prompt):
        model_id = torch.tensor(model_id, dtype=torch.long).to(self.get_device())

        model_embed = self.P(model_id)
        model_embed = torch.nn.functional.normalize(model_embed, p=2, dim=1)

        prompt_embed = (
            OPENAI_CLIENT.embeddings.create(input=[prompt], model=self.embedding_model)
            .data[0]
            .embedding
        )
        prompt_embed = torch.tensor(prompt_embed, device=self.get_device())
        prompt_embed = self.text_proj(prompt_embed)

        return self.classifier(model_embed * prompt_embed).squeeze()

    @torch.no_grad()
    def pred_win_rate(self, model_a, model_b, prompt):
        logits = self.forward([model_a, model_b], prompt)
        winrate = torch.sigmoid(logits[0] - logits[1]).item()
        print(winrate)
        return winrate

    def load(self, path):
        self.load_state_dict(load_file(path))


# Initialize model with the same dimensions as the saved model
model = MFModel(
    dim=128,           # Changed from 100 to 128 to match saved weights
    num_models=64,     # Changed from 100 to 64 to match saved weights
    text_dim=1536,     # OpenAI embedding dimension
    num_classes=1,
    use_proj=True
)



# Load the state dict
try:
    # Load the corrected state dict
    model.load("model.safetensors")
    print("Model weights loaded successfully")
except Exception as e:
    print(f"Error loading model weights: {e}")
    print("No saved weights found, using initialized weights")

# FastAPI models
class PredictionRequest(BaseModel):
    model_win: int
    model_loss: int
    prompt: str

class PredictionResponse(BaseModel):
    prediction: bool
    recommended_model: str

@app.post("/predict", response_model=PredictionResponse)
async def predict(request: PredictionRequest):
    try:
        win_rate = model.pred_win_rate(
            request.model_win,
            request.model_loss,
            request.prompt
        )
        
        prediction = win_rate > 0.1159
        recommended_model = "gpt-4-1106-preview" if prediction else "mixtral-8x7b-instruct-v0.1"
        
        return PredictionResponse(
            prediction=prediction,
            recommended_model=recommended_model
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/health")
async def health_check():
    return {"status": "healthy"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
