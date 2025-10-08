# Fine-tuning MunayBol (LoRA/QLoRA + Ollama)

Este directorio contiene una guía mínima para entrenar un adaptador LoRA/QLoRA sobre Llama 3 Instruct y empaquetarlo para servir con Ollama.

## Requisitos
- GPU con 12–24 GB VRAM (7B/8B) o cloud con GPU.
- Python 3.10+, drivers CUDA, y un entorno para entrenamiento (Linux/WSL2 recomendado).
- Herramientas sugeridas: [Axolotl](https://github.com/OpenAccess-AI-Collective/axolotl) (Transformers + PEFT) o [llama.cpp](https://github.com/ggerganov/llama.cpp) finetune.

## Flujo recomendado (Axolotl)
1) Prepara dataset en `finetune/dataset/data.jsonl` (formato Alpaca/ShareGPT; ver `dataset/README.md`).
2) Ajusta `configs/q_lora_llama3.yml` a tu entorno (ruta del dataset, batch size, epochs, etc.).
3) Entrena LoRA:
   - Linux/WSL2:
     - `conda create -n munaybol_ft python=3.10 -y && conda activate munaybol_ft`
     - `pip install axolotl[flash-attn]` (o según doc oficial)
     - `accelerate config`
     - `axolotl train finetune/configs/q_lora_llama3.yml`
4) Fusiona y exporta a GGUF (script de ejemplo en `scripts/merge_and_export.md`).
5) Crea un `Modelfile` y registra el modelo en Ollama:
   - `ollama create munaybol-llama3 -f finetune/Modelfile`

## Flujo alternativo (llama.cpp finetune)
- Entrena SFT/LoRA directamente con llama.cpp y produce un GGUF listo para Ollama.

## Integración
- En `docker-compose.yml`, define `OLLAMA_MODEL=munaybol-llama3` y reinicia el backend.

## Evaluación
- Crea un set de prompts de prueba (itinerarios, FAQ). Ajusta dataset y reentrena según resultados.
