from flask import Flask, request, jsonify
from transformers import AutoTokenizer, AutoModelForCausalLM
import os
import subprocess
import sys

app = Flask(__name__)

LOCAL_DIR = "./gptneo-llm"
DEFAULT_MODEL = os.environ.get("MODEL_NAME", "EleutherAI/gpt-neo-125m")


def ensure_model():
    # Si ya existen pesos (pytorch_model.bin o model.safetensors) no descargar
    has_weights = any(
        os.path.isfile(os.path.join(LOCAL_DIR, f))
        for f in ["pytorch_model.bin", "model.safetensors"]
    )
    if has_weights:
        print(f"[LLM] Pesos detectados en {LOCAL_DIR}, saltando descarga.")
        return
    print(f"[LLM] No se encontraron pesos. Descargando modelo {DEFAULT_MODEL}...")
    try:
        subprocess.check_call([sys.executable, "download_model.py"])  # Usa el script existente
    except Exception as e:
        print(f"[LLM] Error descargando el modelo: {e}")
        raise


ensure_model()

tokenizer = AutoTokenizer.from_pretrained(LOCAL_DIR, padding_side="left")
model = AutoModelForCausalLM.from_pretrained(LOCAL_DIR)


@app.route("/generate", methods=["POST"])
def generate():
    data = request.get_json() or {}
    prompt = data.get("prompt", "")
    if not prompt:
        return jsonify({"error": "prompt vacío"}), 400
    inputs = tokenizer(prompt, return_tensors="pt", truncation=True, max_length=256)
    outputs = model.generate(
        **inputs,
        max_new_tokens=80,
        pad_token_id=tokenizer.eos_token_id,
        do_sample=True,
        top_p=0.95,
        temperature=0.8,
    )
    response = tokenizer.decode(outputs[0], skip_special_tokens=True)
    # Opcional: remover eco del prompt
    if response.startswith(prompt):
        response = response[len(prompt) :].lstrip()
    return jsonify({"result": response})


@app.route("/health", methods=["GET"])
def health():
    return {"status": "ok", "model": DEFAULT_MODEL}


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000)