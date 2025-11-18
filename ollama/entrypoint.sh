#!/usr/bin/env bash
set -euo pipefail

echo "Iniciando Ollama entrypoint personalizado..."

ollama serve &
SERVE_PID=$!
echo "Servidor Ollama iniciado (PID: ${SERVE_PID}). Esperando disponibilidad..."

for i in {1..12}; do
  if curl -sf http://localhost:11434/api/version >/dev/null; then
    echo "Servidor Ollama está listo."
    break
  fi
  echo "Esperando Ollama (${i}/12)..."
  sleep 1
done

CHAT_MODEL="${OLLAMA_MODEL:-qwen2.5:3b-instruct-q4_K_M}"
EMBED_MODEL="${OLLAMA_EMBED_MODEL:-nomic-embed-text}"

have_model() { ollama show "$1" >/dev/null 2>&1; }

if ! have_model "${CHAT_MODEL}"; then
  echo "Descargando modelo de chat: ${CHAT_MODEL}..."
  curl -sS -X POST http://localhost:11434/api/pull -d "{\"name\":\"${CHAT_MODEL}\"}" >/dev/null
fi

if ! have_model "${EMBED_MODEL}"; then
  echo "Descargando modelo de embedding: ${EMBED_MODEL}..."
  curl -sS -X POST http://localhost:11434/api/pull -d "{\"name\":\"${EMBED_MODEL}\"}" >/dev/null
fi

echo "Modelos verificados. Servidor listo."
wait ${SERVE_PID}