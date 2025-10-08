# Fusión de LoRA y exportación a GGUF

Este documento da una guía general (ajusta comandos a tu entorno):

1) Fusionar LoRA sobre el modelo base en Transformers
- Usa `peft` o utilidades de Axolotl para fusionar los pesos y obtener un modelo completo en HF format.

2) Convertir a GGUF para Ollama (llama.cpp)
- Usa `llama.cpp` tools:
  - `convert-hf-to-gguf.py` con el checkpoint fusionado.
  - Elige un quantization (p.ej., Q4_K_M) para servir en CPU o GPU liviana.

3) Crear Modelfile
```
FROM ./llama3-munaybol.Q4_K_M.gguf
PARAMETER temperature 0.7
PARAMETER num_ctx 4096
SYSTEM """
Eres MunayBot, un agente de viajes de Bolivia. Hablas en español de forma amable y concisa...
"""
```

4) Registrar en Ollama
```
ollama create munaybol-llama3 -f finetune/Modelfile
ollama run munaybol-llama3 "Itinerario de 3 días por Sucre"
```
