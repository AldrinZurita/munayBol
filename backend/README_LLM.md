# LLM integration (Ollama + LlamaIndex)

This backend now uses Ollama (running on your host) via LlamaIndex for the travel agent. GPT-Neo and the `llm_service` container were removed.

## Requirements
- Docker Desktop running the backend and frontend services.
- Ollama installed locally on Windows. By default it serves at http://localhost:11434 and stores models under `D:\\ollama_models`.

## Configuration
The backend container is configured to reach your host's Ollama at `http://host.docker.internal:11434`.

Environment variables (set in docker-compose):
- `OLLAMA_BASE_URL` (default `http://host.docker.internal:11434`)
- `OLLAMA_MODEL` (default `llama3`) — you can also use `llama3:instruct` or any other installed model.

## First-time setup
1) Ensure the model is available in Ollama:
   - PowerShell:
     - `ollama pull llama3`

2) Rebuild and start containers so the backend picks up dependency changes:
   - `docker compose build`
   - `docker compose up -d`

3) Apply Django migrations (adds chat memory table):
   - `docker compose exec backend python manage.py makemigrations core`
   - `docker compose exec backend python manage.py migrate`

## API usage
POST `/api/llm/generate/`
- Body JSON:
  - `prompt`: string (user message)
  - `chat_id` (optional): previously returned chat session ID to continue the conversation
- Response JSON:
  - `result`: assistant reply
  - `chat_id`: session ID to use for subsequent messages

## Removing old GPT-Neo assets
The old `llm_service/` folder and embedded model files are no longer used. Due to their size, delete them manually if you want to reclaim disk space:
- You can safely remove the entire `llm_service/` directory from the repository/workspace.

## Notes
- Conversations are persisted in the `core_chatsession` table with a JSON history. You can reset a conversation by omitting `chat_id` when calling the endpoint.
- The assistant is prompted as a Bolivian travel agent (see `core/llm_client.py`).
