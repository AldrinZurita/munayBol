import os
<<<<<<< HEAD
import json
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
=======
from typing import Optional, Tuple, List, Dict
from django.utils import timezone
from .models import ChatSession, Usuario
from .rag_index import retrieve_context

# LlamaIndex + Ollama
from llama_index.llms.ollama import Ollama
from llama_index.core.llms import ChatMessage, MessageRole


>>>>>>> f78c6c5bb8367f99105b0b5bd6e7c0939a4d0a5a
SYSTEM_PROMPT = (
    "Eres MunayBot, un agente de viajes de Bolivia. Hablas en español de forma amable y concisa. "
    "Ayudas a planificar itinerarios, recomendar hoteles y lugares turísticos en Bolivia. "
    "Haz preguntas de clarificación cuando falte información (fechas, presupuesto, intereses) y entrega respuestas estructuradas."
)
<<<<<<< HEAD
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
=======


def _get_llm() -> Ollama:
    base_url = os.getenv("OLLAMA_BASE_URL", "http://host.docker.internal:11434")
    model = os.getenv("OLLAMA_MODEL", "llama3")
    return Ollama(model=model, base_url=base_url, request_timeout=120.0)


def _history_to_messages(history: List[Dict]) -> List[ChatMessage]:
    messages: List[ChatMessage] = [ChatMessage(role=MessageRole.SYSTEM, content=SYSTEM_PROMPT)]
    for item in history:
>>>>>>> f78c6c5bb8367f99105b0b5bd6e7c0939a4d0a5a
        role = item.get("role", "user")
        content = item.get("content", "")
        if not content:
            continue
        if role == "assistant":
            messages.append(ChatMessage(role=MessageRole.ASSISTANT, content=content))
        else:
            messages.append(ChatMessage(role=MessageRole.USER, content=content))
    return messages

<<<<<<< HEAD
=======

>>>>>>> f78c6c5bb8367f99105b0b5bd6e7c0939a4d0a5a
def _append_history(session: ChatSession, role: str, content: str) -> None:
    session.history.append({
        "role": role,
        "content": content,
        "ts": timezone.now().isoformat(),
    })
    session.save(update_fields=["history", "updated_at"])

<<<<<<< HEAD
=======

>>>>>>> f78c6c5bb8367f99105b0b5bd6e7c0939a4d0a5a
def start_chat(usuario: Optional[Usuario] = None) -> str:
    session = ChatSession.objects.create(usuario=usuario)
    return str(session.id)

<<<<<<< HEAD
def send_message(prompt: str, chat_id: Optional[str] = None, usuario: Optional[Usuario] = None) -> Tuple[str, str]:
    if not prompt.strip():
        return "Por favor, escribe tu pregunta o mensaje.", chat_id or ""

=======

def send_message(prompt: str, chat_id: Optional[str] = None, usuario: Optional[Usuario] = None) -> Tuple[str, str]:
    """
    Send a user prompt and get assistant reply.
    Returns (reply, chat_id).
    """
>>>>>>> f78c6c5bb8367f99105b0b5bd6e7c0939a4d0a5a
    if chat_id:
        try:
            session = ChatSession.objects.get(id=chat_id)
        except ChatSession.DoesNotExist:
            session = ChatSession.objects.create(usuario=usuario)
    else:
        session = ChatSession.objects.create(usuario=usuario)

<<<<<<< HEAD
    _append_history(session, "user", prompt)

    messages = _history_to_messages(session.history)
    try:
        context_block = retrieve_context(prompt, top_k=1)
=======
    # update history with user message
    _append_history(session, "user", prompt)

    # build messages with RAG context
    messages = _history_to_messages(session.history)
    try:
        context_block = retrieve_context(prompt, top_k=4)
>>>>>>> f78c6c5bb8367f99105b0b5bd6e7c0939a4d0a5a
    except Exception:
        context_block = ""
    if context_block:
        messages.append(ChatMessage(role=MessageRole.SYSTEM, content=context_block))

    llm = _get_llm()
    try:
        resp = llm.chat(messages)
        reply = resp.message.content if hasattr(resp, "message") else str(resp)
    except Exception as e:
        reply = (
            "Lo siento, no puedo responder ahora mismo. "
            "Verifica que Ollama esté ejecutándose y que el modelo esté disponible. "
            f"Detalle: {e}"
        )

<<<<<<< HEAD
    _append_history(session, "assistant", reply)
    return reply, str(session.id)

=======
    # append assistant reply
    _append_history(session, "assistant", reply)

    return reply, str(session.id)


# Backwards-compatible wrapper
>>>>>>> f78c6c5bb8367f99105b0b5bd6e7c0939a4d0a5a
def get_llm_response(prompt: str) -> str:
    reply, _ = send_message(prompt)
    return reply