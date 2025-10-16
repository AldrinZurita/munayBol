#!/bin/bash
ollama pull llama3.2:1b
ollama serve &
sleep 5
curl -X POST http://localhost:11434/api/load -d '{"model":"llama3.2:1b"}'
wait