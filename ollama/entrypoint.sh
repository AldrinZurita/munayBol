#!/bin/bash

echo "Iniciando Ollama entrypoint personalizado..."

# 1. Iniciar el servidor de Ollama en segundo plano
ollama serve &

# Capturar el PID del proceso en segundo plano
pid=$!

echo "Servidor Ollama iniciado en segundo plano (PID: $pid). Esperando a que esté listo..."

# 2. Bucle de espera para que el servidor esté listo
# Intentar durante 60 segundos (12 reintentos * 5 segundos)
attempts=0
max_attempts=12
while [ $attempts -lt $max_attempts ]; do
    # Usar curl para verificar que el servidor responde
    if curl -f http://localhost:11434/api/version > /dev/null 2>&1; then
        echo "Servidor Ollama está listo."
        break
    fi
    attempts=$((attempts+1))
    echo "Esperando a Ollama (intento $attempts/$max_attempts)..."
    sleep 5
done

if [ $attempts -eq $max_attempts ]; then
    echo "Error: Ollama no se inició a tiempo."
    kill $pid # Matar el proceso en segundo plano si falla
    exit 1
fi

# 3. Pre-cargar los modelos AHORA que el servidor está corriendo
echo "Servidor listo. Descargando modelo de chat: llama3.1:8b-instruct-q4_K_M..."
ollama pull llama3.1:8b-instruct-q4_K_M

echo "Descargando modelo de embedding: nomic-embed-text..."
ollama pull nomic-embed-text

echo "Modelos descargados. El contenedor está listo y sirviendo."

# 4. Traer el proceso del servidor al primer plano
# Esto es crucial para que el contenedor no se cierre
wait $pid
```

---

### Siguientes Pasos

1.  **Guarda** el `ollama/Dockerfile` actualizado.
2.  **Vuelve a ejecutar** tu comando de compilación:

    ```bash
    docker compose up --build