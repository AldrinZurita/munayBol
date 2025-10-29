import os
import json
import re
import unicodedata
from typing import Optional, Tuple, List, Dict
from django.utils import timezone

from llama_index.core import Document, VectorStoreIndex, Settings
from llama_index.vector_stores.weaviate import WeaviateVectorStore
from llama_index.llms.ollama import Ollama
from llama_index.core.llms import ChatMessage, MessageRole
import weaviate

from .models import ChatSession, Usuario

# === CONFIGURACIÓN ===
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
OLLAMA_TIMEOUT = float(os.getenv("OLLAMA_TIMEOUT", "60"))
OLLAMA_MAX_TOKENS = int(os.getenv("OLLAMA_MAX_TOKENS", "512"))
OLLAMA_TEMPERATURE = float(os.getenv("OLLAMA_TEMPERATURE", "0.3"))
WEAVIATE_URL = os.getenv("WEAVIATE_URL", "http://weaviate:8080")

_INDEX: Optional[VectorStoreIndex] = None
_DATA_CACHE: Optional[Dict] = None


def _load_data() -> Dict:
    global _DATA_CACHE
    if _DATA_CACHE is None:
        with open(DATA_PATH, 'r', encoding='utf-8') as f:
            _DATA_CACHE = json.load(f)
    return _DATA_CACHE or {}


def _norm(text: str) -> str:
    if not text:
        return ""
    text = unicodedata.normalize('NFD', text)
    text = ''.join(ch for ch in text if unicodedata.category(ch) != 'Mn')
    return text.lower().strip()


def _known_departamentos() -> List[str]:
    data = _load_data()
    deps = set()
    for h in data.get("hoteles", []):
        d = h.get("departamento", "")
        if h.get("estado", False) and d:
            deps.add(d)
    for l in data.get("lugares_turisticos", []):
        d = l.get("departamento", "")
        if l.get("estado", True) and d:
            deps.add(d)
    return sorted(deps)


def _detect_departamento(prompt: str) -> Optional[str]:
    p = _norm(prompt)
    for dep in _known_departamentos():
        if _norm(dep) in p:
            return dep
    return None


def _filter_hoteles(dep: Optional[str], limit: int = 3) -> List[Dict]:
    data = _load_data()
    hoteles = [h for h in data.get("hoteles", []) if h.get("estado", False)]
    if dep:
        hoteles = [h for h in hoteles if _norm(h.get("departamento", "")) == _norm(dep)]
    hoteles.sort(key=lambda x: x.get("calificacion", 0), reverse=True)
    return hoteles[:limit]


def _filter_lugares(dep: Optional[str], limit: int = 2) -> List[Dict]:
    data = _load_data()
    lugares = [l for l in data.get("lugares_turisticos", []) if l.get("estado", True)]
    if dep:
        lugares = [l for l in lugares if _norm(l.get("departamento", "")) == _norm(dep)]
    return lugares[:limit]


def _dataset_answer(prompt: str) -> Optional[str]:
    pnorm = _norm(prompt)
    es_hoteles = any(k in pnorm for k in ["hotel", "hospedaje", "alojamiento"])
    es_lugares = any(k in pnorm for k in ["lugar", "lugares", "visitar", "itinerario", "ruta", "qué ver", "que ver"])
    if not (es_hoteles or es_lugares):
        return None

    dep = _detect_departamento(prompt)
    seccion: List[str] = []
    if es_hoteles:
        hoteles = _filter_hoteles(dep, limit=3)
        if not hoteles:
            return ""
        titulo = f"## Hoteles sugeridos{f' en {dep}' if dep else ''}"
        seccion.append(titulo)
        for h in hoteles[:5]:
            seccion.append(f"- {h.get('nombre')} — {h.get('ubicacion')} ({h.get('departamento')}) · ⭐ {h.get('calificacion')}")
    if es_lugares:
        lugares = _filter_lugares(dep, limit=3)
        if not lugares and not es_hoteles:
            return ""
        titulo = f"## Lugares para visitar{f' en {dep}' if dep else ''}"
        seccion.append(titulo)
        for l in lugares[:8]:
            seccion.append(f"- {l.get('nombre')} — {l.get('tipo')} · {l.get('ubicacion')}")
    seccion.append("\n> Datos obtenidos directamente de la base interna (CSV).")
    return "\n".join(seccion).strip()


def _user_requested_days(prompt: str) -> Optional[int]:
    p = _norm(prompt)
    m = re.search(r"(\d+)\s*d[ií]as", p)
    if m:
        try:
            return int(m.group(1))
        except Exception:
            return None
    if "semana" in p:
        return 7
    return None


def _cap_itinerary_days_if_needed(prompt: str, reply: str, max_days: int = 3) -> str:
    requested = _user_requested_days(prompt)
    if requested and requested > max_days:
        return reply
    lines = reply.splitlines()
    out = []
    skipping_block = False
    day_pattern = re.compile(r"^\s*(d[ií]a|day)\s*(\d+)", re.IGNORECASE)
    for i, line in enumerate(lines):
        m = day_pattern.match(line)
        if m:
            n = 0
            try:
                n = int(m.group(2))
            except Exception:
                n = 0
            if n > max_days:
                skipping_block = True
                continue
            else:
                skipping_block = False
        if line.strip().startswith("## "):
            skipping_block = False
        if any(line.strip().lower().startswith(k) for k in ["presupuesto", "tips", "preguntas", "conclusión", "conclusion"]):
            skipping_block = False
        if skipping_block:
            continue
        out.append(line)
    return "\n".join(out)


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


def init_index(force_rebuild: bool = False) -> VectorStoreIndex:
    global _INDEX
    if _INDEX is not None and not force_rebuild:
        return _INDEX

    client = weaviate.Client(WEAVIATE_URL)
    vector_store = WeaviateVectorStore(weaviate_client=client, index_name="munaybol")

    documents = _build_documents_from_json()
    _INDEX = VectorStoreIndex.from_documents(
        documents,
        vector_store=vector_store
    )
    return _INDEX


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
    # Use last 3 exchanges (6 messages) for better context without overloading
    for item in history[-6:]:
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
    now_iso = timezone.now().isoformat()
    session.history.append({
        "role": role,
        "content": content,
        "ts": now_iso,
    })
    # Mantener metadatos actualizados
    session.messages_count = (session.messages_count or 0) + 1
    session.last_message_at = timezone.now()
    if not session.title and role == "user":
        txt = (content or "").strip()
        if txt:
            session.title = (txt[:60] + ("…" if len(txt) > 60 else ""))
    session.save(update_fields=["history", "messages_count", "last_message_at", "title", "updated_at"])


def start_chat(usuario: Optional[Usuario] = None) -> str:
    session = ChatSession.objects.create(usuario=usuario)
    session.history = []
    session.messages_count = 0
    session.last_message_at = None
    session.save(update_fields=["history", "messages_count", "last_message_at"])
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

    try:
        ds_reply = _dataset_answer(prompt)
    except Exception:
        ds_reply = None
    if ds_reply:
        ds_reply = _cap_itinerary_days_if_needed(prompt, ds_reply, max_days=3)
        _append_history(session, "assistant", ds_reply)
        return ds_reply, str(session.id)

    nuevo_dep = _detect_departamento(prompt)
    ultimo_dep = None
    if len(session.history) > 1:
        for h in reversed(session.history):
            if h["role"] == "user":
                ultimo_dep = _detect_departamento(h["content"])
                if ultimo_dep:
                    break
    if nuevo_dep and (nuevo_dep != ultimo_dep or f"viajar a {nuevo_dep.lower()}" in _norm(prompt)):
        messages = [ChatMessage(role=MessageRole.SYSTEM, content=SYSTEM_PROMPT), ChatMessage(role=MessageRole.USER, content=prompt)]
    else:
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

        with open(DATA_PATH, encoding="utf-8") as f:
            data = json.load(f)
            hoteles_validos = {h["nombre"].strip().lower() for h in data.get("hoteles", []) if h.get("estado", False)}
            lugares_validos = {l["nombre"].strip().lower(): l.get("departamento", "") for l in data.get("lugares_turisticos", []) if l.get("estado", True)}

        dep_solicitado = _detect_departamento(prompt)

        def filtrar_lineas_lugares_departamento(lineas, lugares_validos, dep_solicitado):
            nuevas = []
            lugares_norm = {unicodedata.normalize('NFD', nombre).encode('ascii', 'ignore').decode('utf-8').lower().strip(): dep for nombre, dep in lugares_validos.items()}
            lugares_extranjeros = ["san pedro de atacama", "machu picchu", "cusco", "lima", "santiago", "quito", "buenos aires", "rio de janeiro", "bogotá", "caracas", "montevideo", "asunción", "guayaquil", "valparaíso", "cartagena", "medellín", "arequipa", "puno", "salta", "mendoza", "rosario", "cali", "mar del plata", "viña del mar", "antofagasta", "callao", "trujillo", "la serena", "valdivia", "chile", "perú", "argentina", "colombia", "ecuador", "venezuela", "brasil", "uruguay", "paraguay"]
            for linea in lineas:
                linea_norm = unicodedata.normalize('NFD', linea).encode('ascii', 'ignore').decode('utf-8').lower().strip()
                encontrado = None
                for nombre, dep in lugares_norm.items():
                    if nombre in linea_norm:
                        encontrado = (nombre, dep)
                        break
                extranjero = any(lugar in linea_norm for lugar in lugares_extranjeros)
                if extranjero:
                    continue
                elif ("lugar" in linea_norm or "valle" in linea_norm or "plaza" in linea_norm or "catedral" in linea_norm or "palacio" in linea_norm or "barrio" in linea_norm) and not encontrado:
                    continue
                elif dep_solicitado and encontrado and _norm(encontrado[1]) != _norm(dep_solicitado):
                    continue
                else:
                    nuevas.append(linea)
            return nuevas

        def filtrar_lineas_hoteles(lineas, hoteles_validos):
            nuevas = []
            for linea in lineas:
                encontrado = False
                for nombre in hoteles_validos:
                    if nombre and nombre in linea.lower():
                        encontrado = True
                        break
                if "hotel" in linea.lower() and not encontrado:
                    continue
                else:
                    nuevas.append(linea)
            return nuevas

        lineas = reply.splitlines()
        lineas = filtrar_lineas_hoteles(lineas, hoteles_validos)
        lineas = filtrar_lineas_lugares_departamento(lineas, lugares_validos, dep_solicitado)
        reply = "\n".join(lineas)

        reply = _cap_itinerary_days_if_needed(prompt, reply, max_days=3)

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

    def _normalize_reply(text: str) -> str:
        if not text:
            return text
        text = re.sub(r"\[b\](.*?)\[/b\]", r"**\1**", text, flags=re.IGNORECASE | re.DOTALL)
        text = re.sub(r"\[i\](.*?)\[/i\]", r"*\1*", text, flags=re.IGNORECASE | re.DOTALL)
        text = re.sub(r"\\([*_`~])", r"\1", text)
        text = re.sub(r"^[ \t]*[•·◦]\s+", "- ", text, flags=re.MULTILINE)
        text = re.sub(r"\[li\](.*?)\[/li\]", r"- \1", text, flags=re.IGNORECASE | re.DOTALL)
        text = re.sub(r"<br\s*/?>", "\n", text, flags=re.IGNORECASE)
        text = re.sub(r"\n{3,}", "\n\n", text)
        return text.strip()

    reply = _normalize_reply(reply)
    _append_history(session, "assistant", reply)
    return reply, str(session.id)


def get_llm_response(prompt: str) -> str:
    reply, _ = send_message(prompt)
    return reply