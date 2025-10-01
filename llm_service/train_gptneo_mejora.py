from transformers import (
    AutoTokenizer, 
    AutoModelForCausalLM, 
    get_linear_schedule_with_warmup, 
    DataCollatorWithPadding
)
from datasets import load_dataset
from torch.utils.data import DataLoader
import torch
from torch.optim import AdamW
import numpy as np

# ==== Hiperparámetros  ====
MODEL_PATH = "./gptneo-llm"   
BATCH_SIZE = 8
MAX_LENGTH = 192         
NUM_EPOCHS = 8
LEARNING_RATE = 2e-5
WEIGHT_DECAY = 0.01
PATIENCE = 4
GRADIENT_ACCUMULATION_STEPS = 2
WARMUP_STEPS = 200
SEED = 42

device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
torch.manual_seed(SEED)
np.random.seed(SEED)

# ==== Dataset & Preprocesamiento ====
dataset = load_dataset("json", data_files="datos_turismo.jsonl")

def get_history(example):
    return example["prompt"].strip()

def combine_fields(example):
    history = get_history(example)
    return {"text": history + " " + example["completion"].strip()}

dataset = dataset.map(combine_fields)
split_dataset = dataset["train"].train_test_split(test_size=0.2, seed=SEED)
train_data = split_dataset["train"]
val_data = split_dataset["test"]

tokenizer = AutoTokenizer.from_pretrained(MODEL_PATH, padding_side="right")
if tokenizer.pad_token is None:
    tokenizer.pad_token = tokenizer.eos_token

def tokenize_function(example):
    return tokenizer(
        example["text"],
        truncation=True,
        max_length=MAX_LENGTH,
        padding="max_length"
    )

train_data = train_data.map(tokenize_function, batched=True, remove_columns=train_data.column_names)
val_data = val_data.map(tokenize_function, batched=True, remove_columns=val_data.column_names)

train_dataset = train_data.with_format("torch")
val_dataset = val_data.with_format("torch")

data_collator = DataCollatorWithPadding(tokenizer, padding="longest")

train_dataloader = DataLoader(
    train_dataset,
    batch_size=BATCH_SIZE,
    shuffle=True,
    collate_fn=data_collator
)
val_dataloader = DataLoader(
    val_dataset,
    batch_size=BATCH_SIZE,
    shuffle=False,
    collate_fn=data_collator
)

model = AutoModelForCausalLM.from_pretrained(MODEL_PATH)
model.to(device)
model.train()

optimizer = AdamW(model.parameters(), lr=LEARNING_RATE, weight_decay=WEIGHT_DECAY)

total_steps = (len(train_dataloader) // GRADIENT_ACCUMULATION_STEPS) * NUM_EPOCHS
scheduler = get_linear_schedule_with_warmup(
    optimizer,
    num_warmup_steps=WARMUP_STEPS,
    num_training_steps=total_steps
)

best_val_loss = float("inf")
patience_counter = 0
global_step = 0

for epoch in range(NUM_EPOCHS):
    total_loss = 0.0
    model.train()
    for batch_idx, batch in enumerate(train_dataloader):
        input_ids = batch["input_ids"].to(device)
        attention_mask = batch["attention_mask"].to(device)
        labels = input_ids.clone()

        outputs = model(
            input_ids=input_ids,
            attention_mask=attention_mask,
            labels=labels
        )
        loss = outputs.loss / GRADIENT_ACCUMULATION_STEPS
        loss.backward()
        total_loss += loss.item()

        if (batch_idx + 1) % GRADIENT_ACCUMULATION_STEPS == 0:
            optimizer.step()
            scheduler.step()
            optimizer.zero_grad()

        global_step += 1

    avg_loss = total_loss / len(train_dataloader)

    model.eval()
    val_total_loss = 0.0
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
            val_total_loss += outputs.loss.item()
    avg_val_loss = val_total_loss / len(val_dataloader)

    print(f"Epoch {epoch+1}/{NUM_EPOCHS}, Train Loss: {avg_loss:.4f}, Val Loss: {avg_val_loss:.4f}")

    if avg_val_loss < best_val_loss:
        best_val_loss = avg_val_loss
        patience_counter = 0
        model.save_pretrained(MODEL_PATH)
        tokenizer.save_pretrained(MODEL_PATH)
        print("Nuevo mejor modelo guardado.")
    else:
        patience_counter += 1
        if patience_counter >= PATIENCE:
            print("Early stopping activado: no mejora en validación.")
            break

print(f"Entrenamiento finalizado. El mejor modelo está en {MODEL_PATH}")