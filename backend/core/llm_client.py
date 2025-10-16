import os
import json
import re
from typing import Optional, Tuple, List, Dict
from django.utils import timezone

from llama_index.core import Document, VectorStoreIndex, Settings
# from llama_index.embeddings.ollama import OllamaEmbedding  # ELIMINADO
from llama_index.vector_stores.weaviate import WeaviateVectorStore
from llama_index.llms.ollama import Ollama
from llama_index.core.llms import ChatMessage, MessageRole
import weaviate

from .models import ChatSession, Usuario

# === CONFIGURACIÓN ===
# Load a richer system prompt from file if available (contains instructions to ALWAYS respond in Markdown)
DEFAULT_SYSTEM_PROMPT = (
    "Eres MunayBot, un agente de viajes de Bolivia. Hablas en español de forma amable y concisa. "
    "Ayudas a planificar itinerarios, recomendar hoteles y lugares turísticos en Bolivia. "
    "Haz preguntas de clarificación cuando falte información (fechas, presupuesto, intereses) y entrega respuestas estructuradas."
)

try:
    SYSTEM_PROMPT_PATH = os.path.join(os.path.dirname(__file__), 'system_prompt.md')
    if os.path.exists(SYSTEM_PROMPT_PATH):
        with open(SYSTEM_PROMPT_PATH, 'r', encoding='utf-8') as f:
            SYSTEM_PROMPT = f.read().strip()
    else:
        SYSTEM_PROMPT = DEFAULT_SYSTEM_PROMPT
except Exception:
    SYSTEM_PROMPT = DEFAULT_SYSTEM_PROMPT
DATA_PATH = os.path.join(os.path.dirname(__file__), '../data/munaybol_data.json')
OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://ollama:11434")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "llama3.2:1b")
OLLAMA_TIMEOUT = float(os.getenv("OLLAMA_TIMEOUT", "90"))
OLLAMA_MAX_TOKENS = int(os.getenv("OLLAMA_MAX_TOKENS", "40"))
OLLAMA_TEMPERATURE = float(os.getenv("OLLAMA_TEMPERATURE", "0.2"))
WEAVIATE_URL = os.getenv("WEAVIATE_URL", "http://weaviate:8080")

# === CACHE GLOBAL DE ÍNDICE ===
_INDEX: Optional[VectorStoreIndex] = None

# === FUNCIONES DE DOCUMENTOS ===
def _build_documents_from_json() -> List[Document]:
    with open(DATA_PATH, 'r', encoding='utf-8') as f:
        data = json.load(f)
    docs = []
    for hotel in data.get("hoteles", []):
        if hotel.get("estado", False):
            content = (
                f"[Hotel]\n"
                f"Nombre: {hotel['nombre']}\n"
                f"Departamento: {hotel['departamento']}\n"
                f"Ubicación: {hotel['ubicacion']}\n"
                f"Calificación: {hotel['calificacion']}\n"
            )
            meta = {"tipo": "hotel", "id_hotel": str(hotel["id_hotel"])}
            docs.append(Document(text=content, metadata=meta))
    for lugar in data.get("lugares_turisticos", []):
        if lugar.get("estado", False):
            content = (
                f"[Lugar Turístico]\n"
                f"Nombre: {lugar['nombre']}\n"
                f"Departamento: {lugar['departamento']}\n"
                f"Ubicación: {lugar['ubicacion']}\n"
                f"Tipo: {lugar['tipo']}\n"
                f"Descripción: {lugar['descripcion']}\n"
            )
            meta = {"tipo": "lugar", "id_lugar": str(lugar["id_lugar"])}
            docs.append(Document(text=content, metadata=meta))
    return docs

# === INICIALIZACIÓN DEL ÍNDICE (SOLO 1ra VEZ) ===
def init_index(force_rebuild: bool = False) -> VectorStoreIndex:
    global _INDEX
    if _INDEX is not None and not force_rebuild:
        return _INDEX
    # ELIMINADO: embed_model = OllamaEmbedding(model_name="nomic-embed-text", base_url=OLLAMA_BASE_URL)
    # ELIMINADO: Settings.embed_model = embed_model

    client = weaviate.Client(WEAVIATE_URL)
    vector_store = WeaviateVectorStore(weaviate_client=client, index_name="munaybol")

    documents = _build_documents_from_json()
    _INDEX = VectorStoreIndex.from_documents(
        documents,
        vector_store=vector_store
    )
    return _INDEX

# === RETRIEVAL DE CONTEXTO CON RAG ===
def retrieve_context(query: str, top_k: int = 1) -> str:
    index = init_index()
    retriever = index.as_retriever(similarity_top_k=top_k)
    nodes = retriever.retrieve(query)
    if not nodes:
        return ""
    lines: List[str] = ["Contexto factual relevante:"]
    for n in nodes:
        md = n.metadata or {}
        tipo = md.get("tipo", "")
        lines.append(f"- ({tipo}) {n.text.strip()[:300]}")
    return "\n".join(lines)

# === LLM CLIENT ===
def _get_llm() -> Ollama:
    return Ollama(
        model=OLLAMA_MODEL,
        base_url=OLLAMA_BASE_URL,
        request_timeout=OLLAMA_TIMEOUT,
        temperature=OLLAMA_TEMPERATURE,
        max_tokens=OLLAMA_MAX_TOKENS,
        top_p=0.8
    )

def _history_to_messages(history: List[Dict]) -> List[ChatMessage]:
    messages: List[ChatMessage] = [ChatMessage(role=MessageRole.SYSTEM, content=SYSTEM_PROMPT)]
    # Solo el último mensaje para máxima rapidez
    for item in history[-1:]:
        role = item.get("role", "user")
        content = item.get("content", "")
        if not content:
            continue
        if role == "assistant":
            messages.append(ChatMessage(role=MessageRole.ASSISTANT, content=content))
        else:
            messages.append(ChatMessage(role=MessageRole.USER, content=content))
    return messages

def _append_history(session: ChatSession, role: str, content: str) -> None:
    session.history.append({
        "role": role,
        "content": content,
        "ts": timezone.now().isoformat(),
    })
    session.save(update_fields=["history", "updated_at"])

def start_chat(usuario: Optional[Usuario] = None) -> str:
    session = ChatSession.objects.create(usuario=usuario)
    return str(session.id)

def send_message(prompt: str, chat_id: Optional[str] = None, usuario: Optional[Usuario] = None) -> Tuple[str, str]:
    if not prompt.strip():
        return "Por favor, escribe tu pregunta o mensaje.", chat_id or ""

    if chat_id:
        try:
            session = ChatSession.objects.get(id=chat_id)
        except ChatSession.DoesNotExist:
            session = ChatSession.objects.create(usuario=usuario)
    else:
        session = ChatSession.objects.create(usuario=usuario)

    _append_history(session, "user", prompt)

    messages = _history_to_messages(session.history)
    try:
        context_block = retrieve_context(prompt, top_k=1)
    except Exception:
        context_block = ""
    if context_block:
        messages.append(ChatMessage(role=MessageRole.SYSTEM, content=context_block))

    llm = _get_llm()
    try:
        resp = llm.chat(messages)
        reply = resp.message.content if hasattr(resp, "message") else str(resp)
        # Enforce brevity limits if configured
        max_chars = int(os.getenv("MUNAY_MAX_CHARS", "0") or 0)
        max_lines = int(os.getenv("MUNAY_MAX_LINES", "0") or 0)
        if max_lines and reply:
            lines = reply.splitlines()
            if len(lines) > max_lines:
                reply = "\n".join(lines[:max_lines]).rstrip() + "\n…"
        if max_chars and reply and len(reply) > max_chars:
            reply = reply[:max_chars].rstrip() + "…"
    except Exception as e:
        reply = (
            "Lo siento, no puedo responder ahora mismo. "
            "Verifica que Ollama esté ejecutándose y que el modelo esté disponible. "
            f"Detalle: {e}"
        )
    # Normalize common non-markdown markers the model may insert (BBCode-like tags, simple list markers)
    def _normalize_reply(text: str) -> str:
        if not text:
            return text
        # BBCode-like bold/italic -> Markdown
        text = re.sub(r"\[b\](.*?)\[/b\]", r"**\1**", text, flags=re.IGNORECASE | re.DOTALL)
        text = re.sub(r"\[i\](.*?)\[/i\]", r"*\1*", text, flags=re.IGNORECASE | re.DOTALL)
        # Unescape common escaped markdown characters (\* \_ \`)
        text = re.sub(r"\\([*_`~])", r"\1", text)
        # Convert common list bullets (•, ·, ◦) at start of line to markdown '- '
        text = re.sub(r"^[ \t]*[•·◦]\s+", "- ", text, flags=re.MULTILINE)
        # Convert [ul][li]...[/li][/ul] patterns to markdown lists
        text = re.sub(r"\[li\](.*?)\[/li\]", r"- \1", text, flags=re.IGNORECASE | re.DOTALL)
        # Replace HTML <br> with newline
        text = re.sub(r"<br\s*/?>", "\n", text, flags=re.IGNORECASE)
        # Trim repeated empty lines
        text = re.sub(r"\n{3,}", "\n\n", text)
        return text.strip()

    reply = _normalize_reply(reply)

    _append_history(session, "assistant", reply)
    return reply, str(session.id)

def get_llm_response(prompt: str) -> str:
    reply, _ = send_message(prompt)
    return reply