import os
from typing import Optional, Tuple, List, Dict
from django.utils import timezone
from .models import ChatSession, Usuario

# LlamaIndex + Ollama
from llama_index.llms.ollama import Ollama
from llama_index.core.llms import ChatMessage, MessageRole


SYSTEM_PROMPT = (
    "Eres MunayBot, un agente de viajes de Bolivia. Hablas en español de forma amable y concisa. "
    "Ayudas a planificar itinerarios, recomendar hoteles y lugares turísticos en Bolivia. "
    "Haz preguntas de clarificación cuando falte información (fechas, presupuesto, intereses) y entrega respuestas estructuradas."
)


def _get_llm() -> Ollama:
    base_url = os.getenv("OLLAMA_BASE_URL", "http://host.docker.internal:11434")
    model = os.getenv("OLLAMA_MODEL", "llama3")
    return Ollama(model=model, base_url=base_url, request_timeout=120.0)


def _history_to_messages(history: List[Dict]) -> List[ChatMessage]:
    messages: List[ChatMessage] = [ChatMessage(role=MessageRole.SYSTEM, content=SYSTEM_PROMPT)]
    for item in history:
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
    """
    Send a user prompt and get assistant reply.
    Returns (reply, chat_id).
    """
    if chat_id:
        try:
            session = ChatSession.objects.get(id=chat_id)
        except ChatSession.DoesNotExist:
            session = ChatSession.objects.create(usuario=usuario)
    else:
        session = ChatSession.objects.create(usuario=usuario)

    # update history with user message
    _append_history(session, "user", prompt)

    # build messages
    messages = _history_to_messages(session.history)

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

    # append assistant reply
    _append_history(session, "assistant", reply)

    return reply, str(session.id)


# Backwards-compatible wrapper
def get_llm_response(prompt: str) -> str:
    reply, _ = send_message(prompt)
    return reply