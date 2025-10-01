from transformers import AutoTokenizer, AutoModelForCausalLM

MODEL_NAME = "EleutherAI/gpt-neo-125m"
TARGET_DIR = "./gptneo-llm"

print(f"Descargando modelo y tokenizer '{MODEL_NAME}' en '{TARGET_DIR}'...")

tokenizer = AutoTokenizer.from_pretrained(MODEL_NAME)
tokenizer.save_pretrained(TARGET_DIR)

model = AutoModelForCausalLM.from_pretrained(MODEL_NAME)
model.save_pretrained(TARGET_DIR)

print("¡Modelo y tokenizer descargados y guardados localmente en './gptneo-llm'!")