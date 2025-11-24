#!/bin/bash
set -e

# 1. Iniciar el servicio Ollama en segundo plano.
echo "Iniciando el servicio Ollama..."
/usr/bin/ollama serve &

# 2. Esperar un momento para asegurar que el servidor esté listo
sleep 5

# 3. Descargar el modelo necesario. Esto es seguro de ejecutar aquí
# porque el servidor ya está corriendo en segundo plano.
MODEL_NAME=${OLLAMA_MODEL:-qwen2.5:3b}
echo "Verificando y descargando modelo: ${MODEL_NAME}..."
ollama pull "$MODEL_NAME"

# 4. Esperar a que el proceso en background termine (en la práctica, esto
# mantendrá el script corriendo indefinidamente mientras el servidor Ollama esté vivo).
wait $(jobs -p)