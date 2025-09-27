from transformers import AutoTokenizer, AutoModelForCausalLM

# Carga el modelo fine-tuned y el tokenizer
model_name = "./gptneo-llm"
tokenizer = AutoTokenizer.from_pretrained(model_name)
model = AutoModelForCausalLM.from_pretrained(model_name)

# Si el tokenizer no tiene pad_token, usa eos_token
if tokenizer.pad_token is None:
    tokenizer.pad_token = tokenizer.eos_token

# Prompt de ejemplo (puedes cambiar este texto)
prompt = "Usuario: Quiero viajar a Bolivia en diciembre ¿qué lugares turísticos me recomiendas?\nBot:"

# Tokeniza el prompt
inputs = tokenizer(prompt, return_tensors="pt")

# Genera la respuesta del modelo
outputs = model.generate(
    **inputs,
    max_length=128,
    pad_token_id=tokenizer.eos_token_id,
    do_sample=True,            # Para respuestas más variadas
    top_p=0.95,
    temperature=0.8,
    num_return_sequences=1
)

# Decodifica y muestra la respuesta
response = tokenizer.decode(outputs[0], skip_special_tokens=True)
print(response)