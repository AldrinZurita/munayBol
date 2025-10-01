from flask import Flask, request, jsonify
from transformers import AutoTokenizer, AutoModelForCausalLM

app = Flask(__name__)

model_name = "./gptneo-llm"
tokenizer = AutoTokenizer.from_pretrained(model_name, padding_side='left')
model = AutoModelForCausalLM.from_pretrained(model_name)

@app.route("/generate", methods=["POST"])
def generate():
    data = request.get_json()
    prompt = data.get("prompt", "")
    inputs = tokenizer(prompt, return_tensors="pt", truncation=True, max_length=128)
    outputs = model.generate(**inputs, max_new_tokens=64, pad_token_id=tokenizer.eos_token_id, do_sample=True, top_p=0.95, temperature=0.8)
    response = tokenizer.decode(outputs[0], skip_special_tokens=True)
    return jsonify({"result": response})

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000)