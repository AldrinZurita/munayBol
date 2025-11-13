import os
import re
import json
import logging
from typing import Optional, List, Dict, Any, Generator
import httpx
import ollama
import weaviate
from llama_index.core import Document, VectorStoreIndex
from llama_index.vector_stores.weaviate import WeaviateVectorStore
from llama_index.llms.ollama import Ollama as LlamaIndexOllama
from llama_index.core.llms import ChatMessage, MessageRole
from llama_index.embeddings.ollama import OllamaEmbedding

logger = logging.getLogger(__name__)

try:
    SYSTEM_PROMPT_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'system_prompt.md')
    SYSTEM_PROMPT_PATH = os.path.abspath(SYSTEM_PROMPT_PATH)
    if os.path.exists(SYSTEM_PROMPT_PATH):
        with open(SYSTEM_PROMPT_PATH, 'r', encoding='utf-8') as f:
            SYSTEM_PROMPT = f.read().strip()
            logger.info("System prompt cargado desde system_prompt.md")
    else:
        SYSTEM_PROMPT = "Eres MunayBot, un asistente de viajes experto en Bolivia. Responde siempre en español y solo con información del contexto."
        logger.warning("No se encontró system_prompt.md, usando prompt por defecto.")
except Exception as e:
    SYSTEM_PROMPT = "Eres MunayBot, un asistente de viajes experto en Bolivia. Responde siempre en español y solo con información del contexto."
    logger.error(f"Error al cargar system_prompt.md: {e}")

OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "llama3.1:8b-instruct-q4_K_M")
OLLAMA_MAX_TOKENS = int(os.getenv("OLLAMA_MAX_TOKENS", "512"))
OLLAMA_TEMPERATURE = float(os.getenv("OLLAMA_TEMPERATURE", "0.3"))
OLLAMA_NUM_CTX = int(os.getenv("OLLAMA_NUM_CTX", "4096"))
OLLAMA_TIMEOUT = float(os.getenv("OLLAMA_TIMEOUT", "600.0"))

CONNECT_TIMEOUT = float(os.getenv("OLLAMA_CONNECT_TIMEOUT", "10.0"))
READ_TIMEOUT = float(os.getenv("OLLAMA_READ_TIMEOUT", str(OLLAMA_TIMEOUT)))
WRITE_TIMEOUT = float(os.getenv("OLLAMA_WRITE_TIMEOUT", "10.0"))
POOL_TIMEOUT = float(os.getenv("OLLAMA_POOL_TIMEOUT", "10.0"))
HTTPX_TIMEOUT = httpx.Timeout(
    connect=CONNECT_TIMEOUT,
    read=READ_TIMEOUT,
    write=WRITE_TIMEOUT,
    pool=POOL_TIMEOUT,
)

WEAVIATE_HOST = os.getenv("WEAVIATE_HOST", "localhost")
WEAVIATE_PORT = int(os.getenv("WEAVIATE_PORT", "8080"))
WEAVIATE_GRPC_PORT = int(os.getenv("WEAVIATE_GRPC_PORT", "50051"))
RAG_TOP_K = int(os.getenv("RAG_TOP_K", "15"))  # subir a 15 para tener más chance de filtrar bien
INDEX_NAME = "MunayBol"

EMBED_MODEL_NAME = "nomic-embed-text"
embed_model = OllamaEmbedding(
    model_name=EMBED_MODEL_NAME,
    base_url=OLLAMA_BASE_URL
)

_INDEX: Optional[VectorStoreIndex] = None

ollama_llm = LlamaIndexOllama(
    model=OLLAMA_MODEL,
    base_url=OLLAMA_BASE_URL,
    temperature=OLLAMA_TEMPERATURE,
    context_window=OLLAMA_NUM_CTX,
    timeout=OLLAMA_TIMEOUT,
    additional_kwargs={"num_thread": int(os.getenv("OLLAMA_NUM_THREADS", "4"))}
)

ollama_client = ollama.Client(
    host=OLLAMA_BASE_URL,
    timeout=HTTPX_TIMEOUT
)

def _get_index() -> Optional[VectorStoreIndex]:
    global _INDEX
    if _INDEX is None:
        try:
            client = weaviate.connect_to_custom(
                http_host=WEAVIATE_HOST,
                http_port=WEAVIATE_PORT,
                http_secure=False,
                grpc_host=WEAVIATE_HOST,
                grpc_port=WEAVIATE_GRPC_PORT,
                grpc_secure=False
            )
            client.is_ready()
            vector_store = WeaviateVectorStore(
                weaviate_client=client,
                index_name=INDEX_NAME
            )
            _INDEX = VectorStoreIndex.from_vector_store(
                vector_store,
                embed_model=embed_model
            )
            logger.info(f"Conectado a Weaviate (v4) y VectorStoreIndex cargado para '{INDEX_NAME}'.")
        except Exception as e:
            logger.error(f"Error al conectar con Weaviate (v4): {e}")
            logger.warning("RAG estará deshabilitado. Dependiendo solo del LLM.")
            return None
    return _INDEX

def _extract_ciudad_departamento(user_query: str) -> str:
    # Busca la ciudad/departamento después de "en", "de", "del", "para", etc.
    patron = re.compile(r"\b(?:en|de|para|por|del|sobre|acerca de|a)\s+([A-ZÁÉÍÓÚÑ][^\d.,?\n]+)", re.IGNORECASE)
    match = patron.search(user_query)
    if match:
        raw = match.group(1).strip()
        partes = raw.split()
        partes_filtradas = [p for p in partes if len(p) > 1 and p[0].isalpha()]
        return " ".join(partes_filtradas).lower()
    return ""

def _format_node_to_markdown(node: Document) -> str:
    md = []
    md.append(f"- **Nombre:** {node.metadata.get('nombre', 'N/D')}")
    ubicacion = node.metadata.get('ubicacion')
    if ubicacion:
        md.append(f"  - 📍 _Ubicación:_ {ubicacion}")
    calificacion = node.metadata.get('calificacion')
    if calificacion:
        md.append(f"  - ⭐️ _Calificación:_ {calificacion}")
    depa = node.metadata.get('departamento')
    if depa:
        md.append(f"  - 🏙️ _Departamento:_ {depa}")
    desc = node.metadata.get('descripcion')
    if desc:
        md.append(f"  - 📝 _Descripción:_ {desc}")
    img = node.metadata.get('url_imagen_hotel') or node.metadata.get('url_image_lugar_turistico')
    if img:
        md.append(f"  - 🖼️ _Imagen:_ [Ver imagen]({img})")
    return "\n".join(md)

def _build_rag_query(prompt: str) -> str:
    index = _get_index()
    if not index:
        return ""  # Sin contexto si RAG falla

    try:
        retriever = index.as_retriever(similarity_top_k=RAG_TOP_K)
        nodes = retriever.retrieve(prompt)

        ciudad_o_dpto = _extract_ciudad_departamento(prompt)
        def matches_ciudad(nodo):
            nombre = str(nodo.metadata.get("departamento", "")).lower()
            ubic = str(nodo.metadata.get("ubicacion", "")).lower()
            desc = str(nodo.metadata.get("descripcion", "")).lower()
            return (ciudad_o_dpto in nombre) or (ciudad_o_dpto in ubic) or (ciudad_o_dpto in desc)

        if ciudad_o_dpto:
            filtered_nodes = [n for n in nodes if matches_ciudad(n)]
        else:
            filtered_nodes = nodes

        if not filtered_nodes:
            noinfo = f"No tengo hoteles ni lugares específicos en '{ciudad_o_dpto.title() if ciudad_o_dpto else 'esa ciudad/departamento'}'. ¿Quieres buscar en otra ciudad o departamento?"
            logger.info(f"Sin resultados relevantes para '{ciudad_o_dpto}' en contexto.")
            return noinfo

        markdown_items = [_format_node_to_markdown(node) for node in filtered_nodes[:5]]
        context_str = (
                "## 🏨 Hoteles y lugares hallados\n\n" +
                "\n\n".join(markdown_items) +
                "\n\n¿Quieres ajustar tu búsqueda, filtrar por servicio, fecha u otra ciudad? 🙂"
        )
        logger.debug(f"Contexto RAG filtrado:\n{context_str}")
        return context_str
    except Exception as e:
        logger.error(f"Error durante la recuperación RAG: {e}")
        return ""

def send_message(
        prompt: str,
        chat_id: str,
        usuario: Any,
        historial: List[Dict[str, str]] = []
) -> (str, List[Dict[str, str]]):
    logger.info(f"Procesando chat para chat_id: {chat_id} (Usuario: {getattr(usuario, 'id', 'N/A')})")

    rag_context = _build_rag_query(prompt)

    messages = [ChatMessage(role=MessageRole.SYSTEM, content=SYSTEM_PROMPT)]
    if rag_context:
        messages.append(ChatMessage(role=MessageRole.SYSTEM, content=rag_context))
    else:
        messages.append(ChatMessage(role=MessageRole.SYSTEM, content="Recuerda que solo puedes responder con información del contexto, nunca inventes ni detalles ni lugares."))

    contexto_historial = []
    for item in historial:
        role_str = item.get('role')
        role = MessageRole.USER if role_str == 'user' else MessageRole.ASSISTANT
        messages.append(ChatMessage(role=role, content=item.get('content', '')))
        contexto_historial.append({"role": role_str, "content": item.get('content', '')})

    messages.append(ChatMessage(role=MessageRole.USER, content=prompt))
    contexto_historial.append({"role": "user", "content": prompt})

    try:
        response = ollama_llm.chat(messages, max_tokens=OLLAMA_MAX_TOKENS)
        respuesta_texto = response.message.content
        logger.debug(f"Respuesta generada: {respuesta_texto}")
        return respuesta_texto, contexto_historial
    except Exception as e:
        logger.error(f"Error en LlamaIndexOllama.chat: {e}")
        try:
            respuesta_fallback = chat_streaming_fallback(messages)
            return respuesta_fallback, contexto_historial
        except Exception as e_fallback:
            logger.error(f"Error en fallback de streaming: {e_fallback}")
            error_msg = "Lo siento, tuve un problema al procesar tu solicitud. Error: " + str(e_fallback)
            return error_msg, contexto_historial

def chat_streaming_fallback(messages: List[ChatMessage]) -> str:
    logger.warning("Usando fallback de streaming directo de 'ollama'.")

    ollama_messages = [
        {"role": "system", "content": SYSTEM_PROMPT}
    ]

    last_user_prompt = messages[-1].content if messages else "Hola"
    ollama_messages.append({"role": "user", "content": last_user_prompt})

    stream = ollama_client.chat(
        model=OLLAMA_MODEL,
        messages=ollama_messages,
        stream=True,
        options={
            "temperature": OLLAMA_TEMPERATURE,
            "num_ctx": OLLAMA_NUM_CTX,
            "num_predict": OLLAMA_MAX_TOKENS
        }
    )

    respuesta_completa = ""
    for chunk in stream:
        if 'message' in chunk and 'content' in chunk['message']:
            respuesta_completa += chunk['message']['content']

    return respuesta_completa