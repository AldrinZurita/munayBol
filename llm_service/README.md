# LLM Service (GPT-Neo 125M Fine-Tune)

Este servicio carga y/o entrena un modelo causal (GPT-Neo 125M) adaptado a recomendaciones turísticas usando formato instruccional.

## Estructura principal

- `app.py`: Servidor Flask para inferencia HTTP.
- `train_gptneo_mejora.py`: Script de fine-tuning con soporte GPU / FP16 / gradient checkpointing.
- `build_dataset.py`: Genera dataset sintético (ejemplos turismo) en JSONL.
- `dataset_instrucciones_ejemplo.jsonl`: Ejemplos manuales de formato instruccional.
- `dataset_sintetico.jsonl`: Dataset sintético generado.
- `infer_sample.py`: Script de inferencia local rápido.
- `gpu_diag.py`: Diagnóstico de instalación CUDA / torch.
- `gptneo-llm/`: Carpeta del modelo base y pesos ajustados.

## Formato Instruccional
Cada ejemplo se normaliza a una plantilla:
```
<|INSTRUCTION|>
<texto de la instrucción>
<|CONTEXT|>
<contenido o N/A>
<|RESPONSE|>
<respuesta esperada>
<|END|>
```
Tokens especiales añadidos: `<|INSTRUCTION|>`, `<|CONTEXT|>`, `<|RESPONSE|>`, `<|END|>`.

## Requisitos
Instalar dependencias (GPU):
```powershell
pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu124
pip install -r llm_service/requirements.txt
```

Si se instaló una wheel CPU-only, reinstalar usando el índice anterior.

### Verificación GPU
```powershell
python gpu_diag.py
```
Salida esperada incluye `CUDA dispon?: True` y nombre de la GPU.

## Fine-Tuning (Entrenamiento)
Ejemplo de entrenamiento rápido (smoke test) en GPU:
```powershell
python train_gptneo_mejora.py `
  --require-gpu `
  --fp16 `
  --gradient-checkpointing `
  --epochs 1 `
  --batch-size 6 `
  --grad-accum 4 `
  --max-train-examples 400 `
  --max-val-examples 80 `
  --print-every 25
```
Parámetros clave:
- `--require-gpu`: Falla si no hay CUDA (evita usar CPU sin querer).
- `--fp16`: AMP (reduce VRAM y acelera).
- `--gradient-checkpointing`: Menor VRAM a costa de algo de tiempo.
- `--max-train-examples / --max-val-examples`: Subset para pruebas rápidas.
- `--save-every N`: Guardar checkpoint periódico.
- `--eval-every N`: Evaluación intermedia.

Entrenamiento completo sugerido:
```powershell
python train_gptneo_mejora.py --require-gpu --fp16 --gradient-checkpointing --epochs 3 --batch-size 8 --grad-accum 4 --print-every 50
```

## Inferencia Local
Uso rápido:
```powershell
python infer_sample.py
```
Prompt personalizado:
```powershell
python infer_sample.py --prompt "<|INSTRUCTION|>\nRecomiéndame 2 días en Potosí con minas y museos.\n<|CONTEXT|>\nN/A\n<|RESPONSE|>\n" --max-new-tokens 160
```

## Servir el Modelo (Flask)
Asegura que los pesos existen dentro de `gptneo-llm/`. Luego:
```powershell
python app.py
```
Endpoint de prueba:
```
GET http://localhost:5000/health
POST http://localhost:5000/generate {"prompt": "<|INSTRUCTION|>..."}
```

## Actualización de Dataset
1. Editar / añadir nuevos JSONL (mismo formato).
2. Reentrenar usando `--epochs` y parámetros deseados.
3. Confirmar que `model.save_pretrained()` sobrescribe `gptneo-llm/`.

## Solución de Problemas
| Problema | Causa probable | Solución |
|----------|----------------|----------|
| `cuda? False` | Wheel CPU-only | Reinstalar torch con índice cu124 |
| `ModuleNotFoundError: huggingface_hub` | Dependencia faltante | `pip install -r requirements.txt` |
| OOM (out of memory) | Batch demasiado grande | Bajar `--batch-size` o subir `--grad-accum` |
| Respuestas incoherentes | Muy pocas epochs | Aumentar epochs / mejorar dataset |
| Tokens especiales ausentes | No se añadieron embeddings | Confirmar log “Tokens especiales añadidos” en entrenamiento |

## Próximos Pasos (roadmap interno)
- Endpoint `/api/recomendaciones` en backend consumiendo este servicio.
- RAG: indexar puntos turísticos y hoteles para contexto dinámico.
- Métricas automáticas básicas (longitud, cobertura de entidades). 

## Licencias / Consideraciones
Modelo base GPT-Neo 125M (EleutherAI). Verifica licencias de datasets propios antes de distribuir modelos fine-tune.

---
Documento generado automáticamente como base; puedes ampliarlo con detalles de despliegue Docker y versión de drivers.
