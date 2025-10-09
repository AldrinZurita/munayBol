import os
from typing import Optional, List
from django.db.models import QuerySet

from .models import Hotel, LugarTuristico

# LlamaIndex core + embeddings
from llama_index.core import Document, VectorStoreIndex, Settings
from llama_index.embeddings.ollama import OllamaEmbedding


_INDEX: Optional[VectorStoreIndex] = None


def _build_documents() -> List[Document]:
    docs: List[Document] = []

    # Hoteles
    hoteles: QuerySet[Hotel] = Hotel.objects.filter(estado=True)
    for h in hoteles:
        content = (
            f"[Hotel]\n"
            f"Nombre: {h.nombre}\n"
            f"Departamento: {h.departamento}\n"
            f"Ubicación: {h.ubicacion}\n"
            f"Calificación: {h.calificacion}\n"
            f"URL: {h.url}\n"
        )
        meta = {"tipo": "hotel", "id_hotel": str(h.id_hotel)}
        docs.append(Document(text=content, metadata=meta))

    # Lugares turísticos
    lugares: QuerySet[LugarTuristico] = LugarTuristico.objects.filter(estado=True)
    for l in lugares:
        content = (
            f"[Lugar Turístico]\n"
            f"Nombre: {l.nombre}\n"
            f"Departamento: {l.departamento}\n"
            f"Ubicación: {l.ubicacion}\n"
            f"Tipo: {l.tipo}\n"
            f"Horario: {l.horario}\n"
            f"Descripción: {l.descripcion}\n"
        )
        meta = {"tipo": "lugar", "id_lugar": str(l.id_lugar)}
        docs.append(Document(text=content, metadata=meta))

    return docs


def init_index(force_rebuild: bool = False) -> VectorStoreIndex:
    global _INDEX
    if _INDEX is not None and not force_rebuild:
        return _INDEX

    # Configure embeddings from Ollama
    base_url = os.getenv("OLLAMA_BASE_URL", "http://host.docker.internal:11434")
    embed_model = OllamaEmbedding(model_name="nomic-embed-text", base_url=base_url)
    Settings.embed_model = embed_model

    documents = _build_documents()
    _INDEX = VectorStoreIndex.from_documents(documents)
    return _INDEX


def retrieve_context(query: str, top_k: int = 4) -> str:
    index = init_index()
    retriever = index.as_retriever(similarity_top_k=top_k)
    nodes = retriever.retrieve(query)
    if not nodes:
        return ""
    # Format concise context block in Spanish
    lines: List[str] = ["Contexto factual relevante:"]
    for n in nodes:
        md = n.metadata or {}
        tipo = md.get("tipo", "")
        lines.append(f"- ({tipo}) {n.text.strip()[:500]}")
    return "\n".join(lines)
