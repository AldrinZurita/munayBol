from transformers import AutoTokenizer, AutoModelForCausalLM

# Cambia la ruta si tu carpeta tiene un nombre o ruta diferente
tokenizer = AutoTokenizer.from_pretrained("./gptneo-llm")
model = AutoModelForCausalLM.from_pretrained("./gptneo-llm")
print("Modelo y tokenizer cargados correctamente.")
