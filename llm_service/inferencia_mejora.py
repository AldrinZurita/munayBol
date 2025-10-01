from transformers import AutoTokenizer, AutoModelForCausalLM
import torch

class ConversationalMemory:
    def __init__(self, max_turns=3): 
        self.max_turns = max_turns
        self.history = []

    def append(self, user_message, bot_reply=None):
        self.history.append(f"Usuario: {user_message}")
        if bot_reply is not None:
            self.history.append(f"Bot: {bot_reply}")
        # Limita la memoria a los N últimos intercambios
        if len(self.history) > self.max_turns * 2:
            self.history = self.history[-self.max_turns * 2:]

    def get_prompt(self, new_user_message):
        # Ensambla el prompt con la memoria + la nueva pregunta
        context = "\n".join(self.history)
        prompt = f"{context}\nUsuario: {new_user_message}\nBot:"
        return prompt

# Cambia aquí la ruta al modelo entrenado:
model_name = "./gptneo-llm"
tokenizer = AutoTokenizer.from_pretrained(model_name, padding_side='left')
model = AutoModelForCausalLM.from_pretrained(model_name)

if tokenizer.pad_token is None:
    tokenizer.pad_token = tokenizer.eos_token

device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
model.to(device)
model.eval()

memory = ConversationalMemory(max_turns=3) 

user_turns = [
    "¿Qué festivales culturales se celebran en La Paz?",
    "¿Cuándo se celebra el Gran Poder?",
    "¿Dónde puedo hospedarme cerca del centro?"
]

bot_responses = []

for user_input in user_turns:
    prompt = memory.get_prompt(user_input)
    inputs = tokenizer(
        prompt,
        truncation=True,
        max_length=192, 
        padding="max_length",
        return_tensors="pt"
    )
    input_ids = inputs["input_ids"].to(device)
    attention_mask = inputs["attention_mask"].to(device)
    with torch.no_grad():
        output = model.generate(
            input_ids=input_ids,
            attention_mask=attention_mask,
            max_new_tokens=64,
            pad_token_id=tokenizer.eos_token_id,
            do_sample=True,
            top_p=0.95,
            temperature=0.8,
            num_return_sequences=1
        )
    response_full = tokenizer.decode(output[0], skip_special_tokens=True)
    # Extrae solo lo generado después de la última ocurrencia de 'Bot:'
    response = response_full.split("Bot:")[-1].strip()
    print(f"Usuario: {user_input}")
    print(f"Bot: {response}\n")
    bot_responses.append(response)
    memory.append(user_input, response)
