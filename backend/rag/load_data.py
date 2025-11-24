import os
import json
import logging
from typing import List

import weaviate
from llama_index.core import Document, VectorStoreIndex
from llama_index.vector_stores.weaviate import WeaviateVectorStore
from llama_index.embeddings.ollama import OllamaEmbedding

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

WEAVIATE_HOST = os.getenv("WEAVIATE_HOST", "weaviate")
WEAVIATE_PORT = int(os.getenv("WEAVIATE_PORT", "8080"))
WEAVIATE_GRPC_PORT = int(os.getenv("WEAVIATE_GRPC_PORT", "50051"))
INDEX_NAME = os.getenv("INDEX_NAME", "MunayBol")

OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://ollama:11434")
EMBED_MODEL_NAME = "nomic-embed-text"

DATA_PATH = os.path.join(os.path.dirname(__file__), "..", "data", "munaybol_data.json")
DATA_PATH = os.path.abspath(DATA_PATH)

def _load_items() -> List[dict]:
    with open(DATA_PATH, "r", encoding="utf-8") as f:
        data = json.load(f)
    if isinstance(data, dict):
        items = []
        for v in data.values():
            if isinstance(v, list):
                items.extend(v)
        return items
    return data if isinstance(data, list) else []

def main():
    logger.info("Conectando a Weaviate para carga...")
    client = None
    try:
        client = weaviate.connect_to_custom(
            http_host=WEAVIATE_HOST, http_port=WEAVIATE_PORT, http_secure=False,
            grpc_host=WEAVIATE_HOST, grpc_port=WEAVIATE_GRPC_PORT, grpc_secure=False
        )

        # Ping
        _ = client.collections.list_all()

        # Vector store + embedding model
        vector_store = WeaviateVectorStore(weaviate_client=client, index_name=INDEX_NAME)
        embed_model = OllamaEmbedding(model_name=EMBED_MODEL_NAME, base_url=OLLAMA_BASE_URL)

        items = _load_items()
        logger.info(f"Items a indexar: {len(items)}")

        docs: List[Document] = []
        for obj in items:
            nombre = (obj.get("nombre") or "").strip()
            desc = (obj.get("descripcion") or "").strip()
            text = (nombre + "\n\n" + desc).strip() or json.dumps(obj, ensure_ascii=False)
            docs.append(Document(text=text, metadata=obj))

        logger.info("Indexando documentos en Weaviate...")
        VectorStoreIndex.from_documents(docs, vector_store=vector_store, embed_model=embed_model)
        logger.info("Carga completada.")
    finally:
        if client:
            try:
                client.close()
            except Exception:
                pass

if __name__ == "__main__":
    main()