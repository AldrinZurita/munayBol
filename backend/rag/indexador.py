import os
import json
import logging
from typing import List, Dict

import weaviate
from llama_index.core import Document
from llama_index.vector_stores.weaviate import WeaviateVectorStore
from llama_index.core import VectorStoreIndex, StorageContext
from llama_index.embeddings.ollama import OllamaEmbedding

WEAVIATE_HOST = os.getenv("WEAVIATE_HOST", "localhost")
WEAVIATE_PORT = int(os.getenv("WEAVIATE_PORT", "8080"))
WEAVIATE_GRPC_PORT = int(os.getenv("WEAVIATE_GRPC_PORT", "50051"))
INDEX_NAME = "MunayBol"
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
BACKEND_DIR = os.path.abspath(os.path.join(SCRIPT_DIR, '..'))
DATA_PATH = os.path.join(BACKEND_DIR, 'data', 'munaybol_data.json')
EMBED_MODEL_NAME = "nomic-embed-text"
OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
embed_model = OllamaEmbedding(
    model_name=EMBED_MODEL_NAME,
    base_url=OLLAMA_BASE_URL
)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def load_data(path: str) -> List[Dict]:
    try:
        with open(path, 'r', encoding='utf-8') as f:
            raw = json.load(f)
        data = []
        if isinstance(raw, list):
            data = raw
        elif isinstance(raw, dict):
            if "hoteles" in raw and isinstance(raw["hoteles"], list):
                data.extend(raw.get("hoteles", []))
            if "lugares_turisticos" in raw and isinstance(raw["lugares_turisticos"], list):
                data.extend(raw.get("lugares_turisticos", []))
            if "paquetes" in raw and isinstance(raw["paquetes"], list):
                data.extend(raw.get("paquetes", []))

        print("DEBUG LOAD (primeros 2):", data[:2])
        print("DEBUG LOAD COUNT:", len(data))
        logger.info(f"Cargados {len(data)} items desde {path}")
        return data
    except Exception as e:
        logger.error(f"Error cargando {path}: {e}")
        return []

def create_documents(data: List[Dict]) -> List[Document]:
    print(f"DEBUG: Entrando a create_documents con {len(data)} items")
    documents = []
    for item in data:
        content_parts = []
        metadata = {}
        item_type = "desconocido"
        item_id = None
        if 'id_hotel' in item:
            item_type = "Hotel"
            item_id = item.get('id_hotel')
        elif 'id_lugar' in item:
            item_type = "Lugar Turistico"
            item_id = item.get('id_lugar')
        elif 'id_paquete' in item:
            item_type = "Paquete"
            item_id = item.get('id_paquete')

        text_fields = ['nombre', 'tipo', 'departamento', 'ubicacion', 'caracteristicas', 'descripcion']
        content_parts.append(f"Tipo: {item_type}")

        for key, value in item.items():
            if value is not None and str(value).strip() != '':
                if key in text_fields:
                    content_parts.append(f"{key}: {value}")
                metadata[key] = value

        text_content = "\n".join(content_parts).strip()
        doc_id = str(item_id or hash(text_content))
        if not text_content or not isinstance(text_content, str):
            print(f"**ADVERTENCIA**: item ignorado por texto vacío o nulo, id: {item_id}, item: {json.dumps(item, ensure_ascii=False)}")
            continue
        print(f"CREANDO Documento: id: {item_id}, text_content: '{text_content[:60]}...'")
        # La mejora: aseguramos que tanto 'text' como 'content' y 'text' en metadata llevan el texto
        doc = Document(
            text=text_content,
            metadata={**metadata, 'content': text_content, 'text': text_content},
            doc_id=doc_id,
            excluded_embed_metadata_keys=["url_imagen_hotel", "url_image_lugar_turistico", "url"],
            excluded_llm_metadata_keys=["url_imagen_hotel", "url_image_lugar_turistico", "url"]
        )
        documents.append(doc)

    logger.info(f"Creados {len(documents)} documentos para indexar.")
    return documents

def main():
    print("DEBUG: usando DATA_PATH =", DATA_PATH)
    data_items = load_data(DATA_PATH)
    if not data_items:
        logger.error("No hay datos para indexar. Verifique la ruta DATA_PATH.")
        return
    documents = create_documents(data_items)
    print(f"DEBUG: {len(documents)} documentos creados, ejemplo: {documents[0] if documents else 'NINGUNO'}")
    if not documents:
        logger.error("No se generaron documentos válidos para indexar.")
        return

    try:
        client = weaviate.connect_to_custom(
            http_host=WEAVIATE_HOST,
            http_port=WEAVIATE_PORT,
            http_secure=False,
            grpc_host=WEAVIATE_HOST,
            grpc_port=WEAVIATE_GRPC_PORT,
            grpc_secure=False
        )
        if client.collections.exists(INDEX_NAME):
            logger.warning(f"El índice '{INDEX_NAME}' ya existe. Se eliminará y se volverá a crear.")
            client.collections.delete(INDEX_NAME)
            logger.info(f"Índice '{INDEX_NAME}' eliminado.")
        vector_store = WeaviateVectorStore(
            weaviate_client=client,
            index_name=INDEX_NAME,
            text_key="content"
        )
        storage_context = StorageContext.from_defaults(vector_store=vector_store)
        logger.info(f"Creando índice '{INDEX_NAME}' en Weaviate...")
        index = VectorStoreIndex.from_documents(
            documents,
            storage_context=storage_context,
            embed_model=embed_model,
            show_progress=True
        )
        logger.info(f"¡Éxito! Índice '{INDEX_NAME}' creado/actualizado.")
    except Exception as e:
        logger.error(f"Error al indexar documentos: {e}")
    finally:
        client.close()

if __name__ == "__main__":
    main()