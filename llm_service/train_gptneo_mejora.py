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
import argparse
import math
from datetime import datetime

SPECIAL_TOKENS = ["<|INSTRUCTION|>", "<|CONTEXT|>", "<|RESPONSE|>", "<|END|>"]

# ==================
# CLI (se procesa primero para que afecte todo el flujo)
# ==================
def build_arg_parser():
    p = argparse.ArgumentParser(description="Fine-tune modelo turístico instruccional (GPT-Neo)")
    p.add_argument('--model-path', type=str, default='./gptneo-llm', help='Ruta modelo base (y donde guardar)')
    p.add_argument('--output-dir', type=str, default=None, help='Directorio de salida (por defecto = model-path)')
    p.add_argument('--data-files', type=str, nargs='*', default=[
        'dataset_instrucciones_ejemplo.jsonl',
        'dataset_sintetico.jsonl',
        'datos_turismo.jsonl'
    ], help='Lista de archivos JSONL a combinar')
    p.add_argument('--epochs', type=int, default=4)
    p.add_argument('--batch-size', type=int, default=4, help='Batch size por paso (antes de grad accumulation)')
    p.add_argument('--grad-accum', type=int, default=4, help='Pasos de acumulación de gradiente')
    p.add_argument('--max-length', type=int, default=384, help='Longitud máxima de tokens')
    p.add_argument('--lr', type=float, default=2e-5)
    p.add_argument('--weight-decay', type=float, default=0.01)
    p.add_argument('--warmup-ratio', type=float, default=0.05)
    p.add_argument('--patience', type=int, default=2, help='Paciencia early stopping')
    p.add_argument('--seed', type=int, default=42)
    p.add_argument('--max-train-examples', type=int, default=None)
    p.add_argument('--max-val-examples', type=int, default=None)
    p.add_argument('--fp16', action='store_true', help='Activar entrenamiento mixto FP16 (AMP)')
    p.add_argument('--gradient-checkpointing', action='store_true', help='Activar gradient checkpointing (menos VRAM, más tiempo)')
    p.add_argument('--save-every', type=int, default=None, help='Guardar checkpoint cada N pasos de optimización')
    p.add_argument('--eval-every', type=int, default=None, help='Evaluar cada N pasos (además de cada epoch)')
    p.add_argument('--no-save-best', action='store_true', help='No guardar solo el mejor, sobrescribir siempre al final de cada epoch')
    p.add_argument('--print-every', type=int, default=50, help='Frecuencia de logs de loss (steps)')
    p.add_argument('--require-gpu', action='store_true', help='Fallar si no hay GPU disponible (previene fallback silencioso)')
    return p


def set_seed(seed: int):
    torch.manual_seed(seed)
    np.random.seed(seed)
    if torch.cuda.is_available():
        torch.cuda.manual_seed_all(seed)


def load_and_prepare_datasets(data_files, seed, max_train=None, max_val=None):
    loaded = []
    for f in data_files:
        if os.path.exists(f):
            try:
                ds = load_dataset('json', data_files=f)['train']
                ds = ds.add_column('__source__', [f]*len(ds))
                loaded.append(ds)
            except Exception as e:
                print(f'[WARN] No se pudo cargar {f}: {e}')
        else:
            print(f'[INFO] Archivo {f} no existe, se omite')
    if not loaded:
        raise SystemExit('No se cargaron datasets. Verifica archivos.')
    raw_dataset = concatenate_datasets(loaded)
    print(f'Ejemplos totales combinados: {len(raw_dataset)}')

    def normalize(example):
        instruction = example.get('instruction') or example.get('prompt') or ''
        response = example.get('response') or example.get('completion') or ''
        context = example.get('context') or ''
        text = (
            f"<|INSTRUCTION|>\n{instruction.strip()}\n"
            f"<|CONTEXT|>\n{context.strip() if context else 'N/A'}\n"
            f"<|RESPONSE|>\n{response.strip()}\n<|END|>"
        )
        return {'text': text}

    processed = raw_dataset.map(normalize, remove_columns=raw_dataset.column_names)
    split = processed.train_test_split(test_size=0.15, seed=seed)
    train_data = split['train']
    val_data = split['test']

    if max_train:
        train_data = train_data.select(range(min(max_train, len(train_data))))
    if max_val:
        val_data = val_data.select(range(min(max_val, len(val_data))))

    print(f'Train: {len(train_data)} | Val: {len(val_data)}')
    return train_data, val_data


def tokenize_datasets(train_data, val_data, tokenizer, max_length, batch_size):
    def tokenize_fn(batch):
        return tokenizer(batch['text'], truncation=True, max_length=max_length, padding='max_length')

    train_tok = train_data.map(tokenize_fn, batched=True, remove_columns=['text'])
    val_tok = val_data.map(tokenize_fn, batched=True, remove_columns=['text'])
    train_ds = train_tok.with_format('torch')
    val_ds = val_tok.with_format('torch')
    collator = DataCollatorForLanguageModeling(tokenizer, mlm=False)
    train_loader = DataLoader(train_ds, batch_size=batch_size, shuffle=True, collate_fn=collator, num_workers=0)
    val_loader = DataLoader(val_ds, batch_size=batch_size, shuffle=False, collate_fn=collator, num_workers=0)
    return train_loader, val_loader


def evaluate(model, val_loader, device):
    model.eval()
    val_loss = 0.0
    with torch.no_grad():
        for batch in val_loader:
            input_ids = batch['input_ids'].to(device)
            attention_mask = batch['attention_mask'].to(device)
            out = model(input_ids=input_ids, attention_mask=attention_mask, labels=input_ids)
            val_loss += out.loss.item()
    return val_loss / max(1, len(val_loader))


def train_epoch(args, model, train_loader, tokenizer, optimizer, scheduler, scaler, device, epoch, global_step):
    model.train()
    running = 0.0
    optimizer.zero_grad(set_to_none=True)
    for step, batch in enumerate(train_loader, 1):
        input_ids = batch['input_ids'].to(device)
        attention_mask = batch['attention_mask'].to(device)
        with torch.cuda.amp.autocast(enabled=args.fp16):
            outputs = model(input_ids=input_ids, attention_mask=attention_mask, labels=input_ids)
            loss = outputs.loss / args.grad_accum
        scaler.scale(loss).backward()
        running += loss.item()
        if step % args.grad_accum == 0:
            scaler.step(optimizer)
            scaler.update()
            scheduler.step()
            optimizer.zero_grad(set_to_none=True)
            global_step += 1
            if args.print_every and global_step % args.print_every == 0:
                print(f"[Epoch {epoch} | Step {global_step}] Loss(acum/prom-step): {running / max(1, global_step):.4f}")
            if args.save_every and global_step % args.save_every == 0:
                ckpt_dir = os.path.join(args.output_dir, f'checkpoint-step{global_step}')
                os.makedirs(ckpt_dir, exist_ok=True)
                model.save_pretrained(ckpt_dir)
                tokenizer.save_pretrained(ckpt_dir)
                print(f'[CKPT] Guardado checkpoint en {ckpt_dir}')
            if args.eval_every and global_step % args.eval_every == 0:
                # Evaluación intermedia minimal (no se retorna aquí para evitar interrumpir loop)
                pass
    return running, global_step


def main():
    args = build_arg_parser().parse_args()
    if args.output_dir is None:
        args.output_dir = args.model_path

    cuda_ok = torch.cuda.is_available()
    device = torch.device('cuda' if cuda_ok else 'cpu')
    print(f"[DEVICE] Usando: {device}")
    print(f"[CUDA] disponible={cuda_ok} | versión torch={torch.__version__} | cudnn={torch.backends.cudnn.version() if cuda_ok else 'N/A'}")
    if args.require_gpu and not cuda_ok:
        raise SystemExit("[ERROR] --require-gpu activado pero no se detecta CUDA. Verifica instalación de PyTorch con soporte GPU y drivers.")
    if device.type == 'cuda':
        print(f"[CUDA] GPU: {torch.cuda.get_device_name(0)} | Memoria total: {round(torch.cuda.get_device_properties(0).total_memory/1024**3,2)} GB")

    set_seed(args.seed)

    # Dataset
    train_data, val_data = load_and_prepare_datasets(
        args.data_files, args.seed, args.max_train_examples, args.max_val_examples
    )

    # Tokenizer
    tokenizer = AutoTokenizer.from_pretrained(args.model_path, padding_side='right')
    added = tokenizer.add_special_tokens({'additional_special_tokens': SPECIAL_TOKENS})
    if tokenizer.pad_token is None:
        tokenizer.pad_token = tokenizer.eos_token
    print(f'Tokens especiales añadidos: {added}')

    # DataLoaders
    train_loader, val_loader = tokenize_datasets(train_data, val_data, tokenizer, args.max_length, args.batch_size)

    # Modelo
    model = AutoModelForCausalLM.from_pretrained(args.model_path)
    if added > 0:
        model.resize_token_embeddings(len(tokenizer))
    if args.gradient_checkpointing:
        model.gradient_checkpointing_enable()
        print('[INFO] Gradient checkpointing ACTIVADO')
    model.to(device)

    optimizer = AdamW(model.parameters(), lr=args.lr, weight_decay=args.weight_decay)
    steps_per_epoch = math.ceil(len(train_loader) / max(1, args.grad_accum))
    total_steps = steps_per_epoch * args.epochs
    warmup_steps = int(total_steps * args.warmup_ratio)
    scheduler = get_linear_schedule_with_warmup(optimizer, warmup_steps, total_steps)
    print(f'Total steps: {total_steps} | Warmup: {warmup_steps}')

    scaler = torch.cuda.amp.GradScaler(enabled=args.fp16)
    best_val = float('inf')
    patience_counter = 0
    global_step = 0

    print(f"[CFG] epochs={args.epochs} batch={args.batch_size} grad_accum={args.grad_accum} lr={args.lr} fp16={args.fp16} max_len={args.max_length}")

    start_time = datetime.now()
    for epoch in range(1, args.epochs + 1):
        running, global_step = train_epoch(args, model, train_loader, tokenizer, optimizer, scheduler, scaler, device, epoch, global_step)

        avg_train = running / max(1, global_step)
        val_loss = evaluate(model, val_loader, device)
        print(f'Epoch {epoch} | Train Loss(prom acumulado): {avg_train:.4f} | Val Loss: {val_loss:.4f}')

        improved = val_loss < best_val
        if improved:
            best_val = val_loss
            patience_counter = 0
        else:
            patience_counter += 1

        # Guardado
        if improved and not args.no_save_best:
            model.save_pretrained(args.output_dir)
            tokenizer.save_pretrained(args.output_dir)
            print('-> Mejor modelo guardado')
        elif args.no_save_best:
            model.save_pretrained(args.output_dir)
            tokenizer.save_pretrained(args.output_dir)
            print('-> Modelo de epoch guardado (sin criterio de mejor)')

        if patience_counter >= args.patience:
            print('Early stopping activado')
            break

    elapsed = datetime.now() - start_time
    print(f'Entrenamiento completado en {elapsed}. Mejor Val Loss: {best_val:.4f}')


if __name__ == '__main__':
    main()