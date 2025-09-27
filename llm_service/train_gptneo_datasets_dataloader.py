from transformers import AutoTokenizer, AutoModelForCausalLM
from datasets import load_dataset
from torch.utils.data import DataLoader
import torch
from torch.optim import AdamW

# Carga el dataset JSONL
dataset = load_dataset("json", data_files="datos_turismo.jsonl")

# Une prompt y completion en un solo campo de texto
def combine_fields(example):
    return {"text": example["prompt"] + " " + example["completion"]}

dataset = dataset.map(combine_fields)

# Divide en entrenamiento y validación (80/20)
split_dataset = dataset["train"].train_test_split(test_size=0.2, seed=42)
train_data = split_dataset["train"]
val_data = split_dataset["test"]

# Tokeniza el campo "text"
model_name = "EleutherAI/gpt-neo-125M"
tokenizer = AutoTokenizer.from_pretrained(model_name)

if tokenizer.pad_token is None:
    tokenizer.pad_token = tokenizer.eos_token

def tokenize_function(example):
    return tokenizer(
        example["text"],
        truncation=True,
        max_length=128,
        padding="max_length"
    )

train_data = train_data.map(tokenize_function, batched=True, remove_columns=train_data.column_names)
val_data = val_data.map(tokenize_function, batched=True, remove_columns=val_data.column_names)

# Convierte datasets a formato PyTorch
train_dataset = train_data.with_format("torch")
val_dataset = val_data.with_format("torch")

# DataLoader para cargar en lotes desde disco
train_dataloader = DataLoader(
    train_dataset,
    batch_size=4,
    shuffle=True
)
val_dataloader = DataLoader(
    val_dataset,
    batch_size=4,
    shuffle=False
)

# Carga el modelo
model = AutoModelForCausalLM.from_pretrained(model_name)
model.train()

# Optimizer
optimizer = AdamW(model.parameters(), lr=5e-5)

# Early stopping config
num_epochs = 4
patience = 3
best_val_loss = float("inf")
patience_counter = 0
device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
model.to(device)

for epoch in range(num_epochs):
    total_loss = 0
    model.train()
    for batch in train_dataloader:
        input_ids = batch["input_ids"].to(device)
        attention_mask = batch["attention_mask"].to(device)
        labels = input_ids.clone()
        outputs = model(
            input_ids=input_ids,
            attention_mask=attention_mask,
            labels=labels
        )
        loss = outputs.loss
        loss.backward()
        optimizer.step()
        optimizer.zero_grad()
        total_loss += loss.item()
    avg_loss = total_loss / len(train_dataloader)

    # Validación
    model.eval()
    val_total_loss = 0
    with torch.no_grad():
        for batch in val_dataloader:
            input_ids = batch["input_ids"].to(device)
            attention_mask = batch["attention_mask"].to(device)
            labels = input_ids.clone()
            outputs = model(
                input_ids=input_ids,
                attention_mask=attention_mask,
                labels=labels
            )
            loss = outputs.loss
            val_total_loss += loss.item()
    avg_val_loss = val_total_loss / len(val_dataloader)

    print(f"Epoch {epoch+1}/{num_epochs}, Train Loss: {avg_loss:.4f}, Val Loss: {avg_val_loss:.4f}")

    # Early stopping logic
    if avg_val_loss < best_val_loss:
        best_val_loss = avg_val_loss
        patience_counter = 0
        # Guarda el mejor modelo hasta ahora
        model.save_pretrained("./gptneo-llm")
        tokenizer.save_pretrained("./gptneo-llm")
        print("Nuevo mejor modelo guardado.")
    else:
        patience_counter += 1
        if patience_counter >= patience:
            print("Early stopping activado: no mejora en validación.")
            break

print("Entrenamiento finalizado. El mejor modelo está en ./gptneo-llm")