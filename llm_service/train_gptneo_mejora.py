from transformers import (
    AutoTokenizer,
    AutoModelForCausalLM,
    get_linear_schedule_with_warmup,
    DataCollatorForLanguageModeling
)
from datasets import load_dataset, concatenate_datasets
from torch.utils.data import DataLoader
import torch
from torch.optim import AdamW
import numpy as np
import os

# ==================
# Configuración
# ==================
MODEL_PATH = "./gptneo-llm"
DATA_FILES = [
    "dataset_instrucciones_ejemplo.jsonl",  # ejemplos manuales
    "dataset_sintetico.jsonl",              # generado por build_dataset.py
    "datos_turismo.jsonl"                   # legacy (prompt/completion)
]
OUTPUT_DIR = MODEL_PATH  # guardamos sobre el mismo para simplicidad (puedes cambiarlo)

BATCH_SIZE = 4              # reducir para VRAM baja
MAX_LENGTH = 384            # más alto para contexto+respuesta
NUM_EPOCHS = 4              # comenzar pequeño
LEARNING_RATE = 2e-5
WEIGHT_DECAY = 0.01
PATIENCE = 2
GRADIENT_ACCUMULATION_STEPS = 4
WARMUP_RATIO = 0.05  # % dinámico
SEED = 42
FP16 = False  # activar más adelante si usas GPU compatible

SPECIAL_TOKENS = ["<|INSTRUCTION|>", "<|CONTEXT|>", "<|RESPONSE|>", "<|END|>"]

# ==================
# Semillas
# ==================
device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
torch.manual_seed(SEED)
np.random.seed(SEED)

# ==================
# Carga dataset(s)
# ==================
loaded = []
for f in DATA_FILES:
    if os.path.exists(f):
        try:
            ds = load_dataset("json", data_files=f)["train"]
            ds = ds.add_column("__source__", [f]*len(ds))
            loaded.append(ds)
        except Exception as e:
            print(f"[WARN] No se pudo cargar {f}: {e}")
    else:
        print(f"[INFO] Archivo {f} no existe, se omite")

if not loaded:
    raise SystemExit("No se cargaron datasets. Verifica archivos.")

raw_dataset = concatenate_datasets(loaded)
print(f"Ejemplos totales combinados: {len(raw_dataset)}")

# ==================
# Normalización de campos
# ==================
# Soportar formato legacy prompt/completion → instruction/response

def normalize(example):
    instruction = example.get("instruction") or example.get("prompt") or ""
    response = example.get("response") or example.get("completion") or ""
    context = example.get("context") or ""
    # Plantilla unify
    text = (
        f"<|INSTRUCTION|>\n{instruction.strip()}\n"
        f"<|CONTEXT|>\n{context.strip() if context else 'N/A'}\n"
        f"<|RESPONSE|>\n{response.strip()}\n<|END|>"
    )
    return {"text": text}

processed = raw_dataset.map(normalize, remove_columns=raw_dataset.column_names)

# ==================
# Split train/val
# ==================
split = processed.train_test_split(test_size=0.15, seed=SEED)
train_data = split["train"]
val_data = split["test"]
print(f"Train: {len(train_data)} | Val: {len(val_data)}")

# ==================
# Tokenizer + tokens especiales
# ==================
tokenizer = AutoTokenizer.from_pretrained(MODEL_PATH, padding_side="right")
added = tokenizer.add_special_tokens({"additional_special_tokens": SPECIAL_TOKENS})
if tokenizer.pad_token is None:
    tokenizer.pad_token = tokenizer.eos_token
print(f"Tokens especiales añadidos: {added}")

# ==================
# Tokenización
# ==================

def tokenize_fn(batch):
    return tokenizer(
        batch["text"],
        truncation=True,
        max_length=MAX_LENGTH,
        padding="max_length"
    )

train_tokenized = train_data.map(tokenize_fn, batched=True, remove_columns=["text"])
val_tokenized = val_data.map(tokenize_fn, batched=True, remove_columns=["text"])

train_dataset = train_tokenized.with_format("torch")
val_dataset = val_tokenized.with_format("torch")

# ==================
# Data collator para causal LM (enmascara automáticamente, no MLM)
# ==================
collator = DataCollatorForLanguageModeling(tokenizer, mlm=False)

train_loader = DataLoader(train_dataset, batch_size=BATCH_SIZE, shuffle=True, collate_fn=collator)
val_loader = DataLoader(val_dataset, batch_size=BATCH_SIZE, shuffle=False, collate_fn=collator)

# ==================
# Modelo
# ==================
model = AutoModelForCausalLM.from_pretrained(MODEL_PATH)
# Redimensionar embeddings si añadimos tokens
if added > 0:
    model.resize_token_embeddings(len(tokenizer))
model.to(device)

# ==================
# Optimizador y Scheduler
# ==================
optimizer = AdamW(model.parameters(), lr=LEARNING_RATE, weight_decay=WEIGHT_DECAY)
steps_per_epoch = max(1, len(train_loader) // GRADIENT_ACCUMULATION_STEPS)
total_steps = steps_per_epoch * NUM_EPOCHS
warmup_steps = int(total_steps * WARMUP_RATIO)
print(f"Total steps: {total_steps} | Warmup: {warmup_steps}")

scheduler = get_linear_schedule_with_warmup(optimizer, num_warmup_steps=warmup_steps, num_training_steps=total_steps)

best_val = float('inf')
patience_counter = 0

# ==================
# Loop de entrenamiento
# ==================
for epoch in range(1, NUM_EPOCHS+1):
    model.train()
    running = 0.0
    optimizer.zero_grad(set_to_none=True)
    for step, batch in enumerate(train_loader, 1):
        input_ids = batch["input_ids"].to(device)
        attention_mask = batch["attention_mask"].to(device)
        outputs = model(input_ids=input_ids, attention_mask=attention_mask, labels=input_ids)
        loss = outputs.loss / GRADIENT_ACCUMULATION_STEPS
        loss.backward()
        running += loss.item()

        if step % GRADIENT_ACCUMULATION_STEPS == 0:
            optimizer.step()
            scheduler.step()
            optimizer.zero_grad(set_to_none=True)

    avg_train = running / max(1, (step // GRADIENT_ACCUMULATION_STEPS))

    # Validación
    model.eval()
    val_loss = 0.0
    with torch.no_grad():
        for vb in val_loader:
            input_ids = vb["input_ids"].to(device)
            attention_mask = vb["attention_mask"].to(device)
            out = model(input_ids=input_ids, attention_mask=attention_mask, labels=input_ids)
            val_loss += out.loss.item()
    avg_val = val_loss / len(val_loader)

    print(f"Epoch {epoch} | Train Loss: {avg_train:.4f} | Val Loss: {avg_val:.4f}")

    if avg_val < best_val:
        best_val = avg_val
        patience_counter = 0
        model.save_pretrained(OUTPUT_DIR)
        tokenizer.save_pretrained(OUTPUT_DIR)
        print("-> Mejor modelo guardado")
    else:
        patience_counter += 1
        if patience_counter >= PATIENCE:
            print("Early stopping activado")
            break

print("Entrenamiento completado.")