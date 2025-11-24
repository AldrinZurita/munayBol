# -*- coding: utf-8 -*-
import os
import json
import logging
import requests
from typing import List, Dict, Any, Tuple

logger = logging.getLogger(__name__)

# --- CONFIGURACIÓN DE RUTAS ---
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_FILE_PATH = os.path.join(BASE_DIR, 'data', 'munaybol_data.json')

# --- ENV: Configuración de Alto Rendimiento ---
OLLAMA_BASE_URL        = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
OLLAMA_MODEL           = os.getenv("OLLAMA_MODEL", "qwen2.5:3b")
OLLAMA_MAX_TOKENS      = int(os.getenv("OLLAMA_MAX_TOKENS", "1500"))
OLLAMA_TEMPERATURE     = float(os.getenv("OLLAMA_TEMPERATURE", "0.3")) # Precisión máxima
OLLAMA_NUM_CTX         = int(os.getenv("OLLAMA_NUM_CTX", "4096"))
OLLAMA_TIMEOUT         = float(os.getenv("OLLAMA_TIMEOUT", "180"))
OLLAMA_NUM_GPU         = int(os.getenv("OLLAMA_NUM_GPU", "99"))

# --- HEADERS: Solamente lo necesario. Se elimina 'ngrok-skip-browser-warning'
# para evitar conflictos de enrutamiento interno.
REQUIRED_HEADERS = {
    "Content-Type": "application/json"
}

# --- 1. CARGA DE DATOS ESTRUCTURADA ---
_DATA_DEPARTAMENTOS = []
_DATA_HOTELES = []
_DATA_LUGARES = []

def load_data():
    """Carga los datos clasificando Hoteles, Lugares y Departamentos."""
    global _DATA_DEPARTAMENTOS, _DATA_HOTELES, _DATA_LUGARES
    try:
        if os.path.exists(DATA_FILE_PATH):
            with open(DATA_FILE_PATH, 'r', encoding='utf-8') as f:
                raw_content = json.load(f)

                data_list = []
                if isinstance(raw_content, list):
                    data_list = raw_content
                elif isinstance(raw_content, dict):
                    # Manejar la estructura si viene con la clave "departamentos"
                    # como en el JSON que generaste previamente
                    if "departamentos_bolivia" in raw_content:
                        _DATA_DEPARTAMENTOS = raw_content["departamentos_bolivia"]
                    elif "departamentos" in raw_content:
                        _DATA_DEPARTAMENTOS = raw_content["departamentos"]

                    # Consolidar todos los elementos en una sola lista para clasificar
                    for key, value in raw_content.items():
                        if key not in ["departamentos", "departamentos_bolivia"] and isinstance(value, list):
                            data_list.extend(value)
                        elif isinstance(value, list):
                            data_list.extend(value) # Captura hoteles/lugares de la estructura antigua

                # Clasificar elementos individuales que puedan estar en el array raíz
                for item in data_list:
                    if 'id_hotel' in item:
                        _DATA_HOTELES.append(item)
                    elif 'id_lugar' in item:
                        _DATA_LUGARES.append(item)
                    elif 'fecha_aniversario' in item and 'comida_tradicional' in item and item not in _DATA_DEPARTAMENTOS:
                        _DATA_DEPARTAMENTOS.append(item)


            logger.info(f"✅ Datos Cargados: Deptos={len(_DATA_DEPARTAMENTOS)}, Hoteles={len(_DATA_HOTELES)}, Lugares={len(_DATA_LUGARES)}.")
        else:
            logger.warning(f"⚠️ Archivo no encontrado: {DATA_FILE_PATH}")
    except Exception as e:
        logger.error(f"❌ Error cargando JSON: {e}")

load_data()


# --- 2. BÚSQUEDA INTELIGENTE POR DEPARTAMENTO ---
def find_official_data(query: str) -> Tuple[str, str]:
    """Busca datos oficiales (Aniversario, Comida) y el nombre del dpto."""
    query_lower = query.lower()

    # Iterar sobre la lista cargada de departamentos
    for dpto in _DATA_DEPARTAMENTOS:
        nombre = dpto.get('nombre', '').lower()
        if nombre in query_lower or query_lower in nombre:
            info = (
                f"DATOS OFICIALES DE {dpto.get('nombre').upper()}:\n"
                f"- Aniversario: {dpto.get('fecha_aniversario', 'N/D')}\n"
                f"- Plato Tradicional: {dpto.get('comida_tradicional', 'N/D')}\n"
                f"IMPORTANTE: Usa este plato y fecha con prioridad ABSOLUTA."
            )
            return info, dpto.get('nombre')
    return "", ""

def find_contextual_data(query: str, dpto_name: str) -> str:
    """Busca Hoteles y Lugares por departamento para el RAG."""
    dpto_lower = dpto_name.lower()
    results = []

    # 1. Hoteles (Filtro estricto por departamento)
    hotels = [h for h in _DATA_HOTELES if h.get('departamento', '').lower() == dpto_lower]
    if hotels:
        hotel_data = json.dumps([{"nombre": h["nombre"], "ubicacion": h["ubicacion"], "calificacion": h["calificacion"]} for h in hotels[:3]], ensure_ascii=False)
        results.append(f"HOTELES EN {dpto_name.upper()}: {hotel_data}")

    # 2. Lugares Turísticos (Filtro por departamento + palabra clave)
    lugares = [l for l in _DATA_LUGARES if l.get('departamento', '').lower() == dpto_lower]
    if lugares:
        lugar_data = json.dumps([{"nombre": l["nombre"], "tipo": l["tipo"], "descripcion": l["descripcion"][:100] + "..."} for l in lugares[:5]], ensure_ascii=False)
        results.append(f"LUGARES TURÍSTICOS EN {dpto_name.upper()}: {lugar_data}")

    if results:
        return "\n---\n".join(results)
    return ""

# --- 3. GENERACIÓN ---
def _chat_generate(messages: List[Dict[str, str]], options: Dict[str, Any]) -> str:
    url = f"{OLLAMA_BASE_URL}/api/chat"
    payload = {
        "model": OLLAMA_MODEL,
        "messages": messages,
        "stream": False,
        "options": options
    }
    try:
        # AQUI ES DONDE SE ELIMINA el encabezado NGROK que causaba el conflicto.
        resp = requests.post(url, json=payload, headers=REQUIRED_HEADERS, timeout=OLLAMA_TIMEOUT)

        if resp.status_code != 200:
            logger.error(f"Ollama HTTP {resp.status_code}: {resp.text[:200]}")
            return ""

        response_json = resp.json()
        if 'message' in response_json:
            return response_json['message']['content'].strip()
        return ""
    except Exception as e:
        logger.error(f"Error conexión Ollama: {e}")
        return ""

def send_message(
        prompt: str,
        chat_id: str,
        usuario: Any,
        historial: List[Dict[str, str]] = [],
) -> Tuple[str, List[Dict[str, str]]]:

    logger.info("Chat %s", chat_id)

    # 1. Obtener Datos y Contexto
    official_data, detected_dpto = find_official_data(prompt)
    context_data = find_contextual_data(prompt, detected_dpto)

    # 2. Prompt Estructura y Fidelidad (El Contrato)

    # Identificar si el usuario pide un itinerario
    is_itinerary_request = any(word in prompt.lower() for word in ["itinerario", "plan", "ruta", "días", "diario"])

    if is_itinerary_request and detected_dpto:
        # Prompt específico para Itinerario
        system_content = (
            f"Eres MunayBot, un guía de viajes experto. El usuario ha solicitado un itinerario para el departamento de {detected_dpto}. "
            f"Tu respuesta DEBE ser un plan de 3 días (Día 1, Día 2, Día 3) con actividades de mañana y tarde, e incluir costos aproximados para actividades y comidas. "
            f"El formato debe ser elegante, con negritas, listas y emojis."
            f"Basate EXCLUSIVAMENTE en la siguiente información de Lugares y Gastronomía:\n"
            f"{context_data}\n{official_data}"
        )

    else:
        # Prompt estándar (Información detallada del departamento)
        system_content = (
            "Eres MunayBot, un experto guía turístico de Bolivia. "
            "Tu respuesta DEBE SER COMPLETA, DETALLADA y PRECISA. NO DEBE CORTARSE. "
            "El formato de salida debe ser elegante, limpio, profesional y usar Markdown de forma rica (negritas, listas, emojis).\n\n"
            "1. Prioriza la 'INFORMACIÓN OFICIAL' y 'CONTEXTUAL' provista abajo.\n"
            "2. NUNCA mezcles geografía (Ej: Si es Cochabamba, no hables de La Paz).\n"
            "3. **COSTOS APROXIMADOS:** Incluye un costo estimado (en Bs. - Bolivianos) para cada lugar turístico y plato gastronómico.\n"
            "4. Estructura tu respuesta utilizando los encabezados de marcador exactos.\n\n"
            "4. Estructura de Respuesta Obligatoria:\n"
            "   📍 **Lugares Turísticos**\n"
            "   (Menciona 3 lugares, con descripción y *Costo Aprox.*)\n"
            "   🏨 **Hoteles Recomendados**\n"
            "   (Menciona 3 hoteles de la lista local si existen, o sugiere zonas)\n"
            "   🏛️ **Historia Breve**\n"
            "   🍽️ **Gastronomía Típica**\n"
            "   (Plato Tradicional y 2 extras, con *Costo Aprox. de un plato en Bs.*)\n"
            "   🎭 **Cultura y Festividades**\n"
            "   💡 **Dato Curioso**\n"
        )

    if official_data and not is_itinerary_request:
        system_content += f"\n\n### DATOS OFICIALES DEL DEPARTAMENTO (USO OBLIGATORIO):\n{official_data}"
    if context_data and not is_itinerary_request:
        system_content += f"\n\n### INFORMACIÓN CONTEXTUAL (Hoteles/Lugares):\n{context_data}"

    messages_payload = [{"role": "system", "content": system_content}]

    for msg in historial[-1:]:
        role = msg.get('role', 'user').lower()
        content = msg.get('content', '')
        if content:
            messages_payload.append({"role": role, "content": content})

    messages_payload.append({"role": "user", "content": prompt})

    options = {
        "num_gpu": OLLAMA_NUM_GPU,
        "temperature": OLLAMA_TEMPERATURE,
        "num_ctx": OLLAMA_NUM_CTX,
        "num_predict": OLLAMA_MAX_TOKENS,
    }

    text = _chat_generate(messages_payload, options)

    if not text:
        return "Hubo un problema generando la respuesta. Por favor intenta de nuevo.", [{"role": "user", "content": prompt}]

    return text, [{"role": "user", "content": prompt}]