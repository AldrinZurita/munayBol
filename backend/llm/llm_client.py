import os
import re
import json
import logging
import unicodedata
import requests
from typing import List, Dict, Any, Tuple, Optional

logger = logging.getLogger(__name__)

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_FILE_PATH = os.path.join(BASE_DIR, 'data', 'munaybol_data.json')

# Configuración de Ollama desde variables de entorno
OLLAMA_URL = os.getenv("OLLAMA_BASE_URL", "http://ollama:11434")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "llama3.1:latest")

_DATA: Dict[str, Any] = {}
_DEPTOS: List[Dict[str, Any]] = []
_HOTELS: List[Dict[str, Any]] = []
_PLACES: List[Dict[str, Any]] = []
_HOTEL_INDEX: Dict[str, Dict[str, Any]] = {}
_PLACE_INDEX: Dict[str, Dict[str, Any]] = {}

def load_data():
    global _DATA, _DEPTOS, _HOTELS, _PLACES, _HOTEL_INDEX, _PLACE_INDEX
    try:
        with open(DATA_FILE_PATH, 'r', encoding='utf-8') as f:
            _DATA = json.load(f)
        _DEPTOS = _DATA.get("departamentos", []) or []
        _HOTELS = _DATA.get("hoteles", []) or []
        _PLACES = _DATA.get("lugares_turisticos", []) or []
        base_info = _DATA.get("info_base_datos", {})
        logger.info(
            f"MunayBol JSON v{base_info.get('version')} actualizado "
            f"{base_info.get('ultima_actualizacion')}: deptos={len(_DEPTOS)} hoteles={len(_HOTELS)} lugares={len(_PLACES)}"
        )
        def norm(s: str) -> str:
            if not s: return ""
            s = unicodedata.normalize("NFD", s)
            s = "".join(c for c in s if unicodedata.category(c) != "Mn")
            s = re.sub(r"[^a-zA-Z0-9]+", " ", s).strip().lower()
            return s
        _HOTEL_INDEX = {norm(h.get("nombre","")): h for h in _HOTELS if h.get("nombre")}
        _PLACE_INDEX = {norm(p.get("nombre","")): p for p in _PLACES if p.get("nombre")}
    except Exception as e:
        logger.error(f"Error cargando JSON: {e}")
        _DATA = {}
        _DEPTOS = []
        _HOTELS = []
        _PLACES = []
        _HOTEL_INDEX = {}
        _PLACE_INDEX = {}

load_data()

def _strip_accents(s: str) -> str:
    return "".join(c for c in unicodedata.normalize("NFD", s) if unicodedata.category(c) != "Mn")

def _soft(v: Optional[str], fb: Optional[str] = None) -> Optional[str]:
    if v is None: return fb
    if isinstance(v, (int,float)): return str(v)
    t = v.strip()
    if t.lower() in ("", "n/d", "nd"): return fb
    return t

def _dep_name_from_query(query: str) -> str:
    q = _strip_accents(query.lower())
    for d in _DEPTOS:
        nombre = _strip_accents((d.get('nombre') or '').lower())
        if nombre and (nombre in q or q in nombre or nombre.startswith(q)):
            return d.get('nombre') or ''
    return ''

def _get_dep(dep_name: str) -> Optional[Dict[str, Any]]:
    for d in _DEPTOS:
        if (d.get('nombre') or '').lower() == (dep_name or '').lower():
            return d
    return None

def _filter_by_department(items: List[Dict[str, Any]], dep: str, dep_field: str) -> List[Dict[str, Any]]:
    if not dep: return []
    dep_norm = _strip_accents(dep.lower().replace(" ", ""))
    out=[]
    for it in items or []:
        val = _strip_accents((it.get(dep_field) or '').lower().replace(" ", ""))
        if val == dep_norm:
            out.append(it)
    return out

def _norm_key(s:str)->str:
    if not s: return ""
    s = unicodedata.normalize("NFD", s)
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    s = re.sub(r"[^a-zA-Z0-9]+"," ",s).strip().lower()
    return s

def _match_hotels(prompt:str)->List[Dict[str,Any]]:
    nk = _norm_key(prompt)
    return [h for k,h in _HOTEL_INDEX.items() if k and (k in nk or nk in k)][:1]  # solo el más relevante

def _match_places(prompt:str)->List[Dict[str,Any]]:
    nk = _norm_key(prompt)
    return [p for k,p in _PLACE_INDEX.items() if k and (k in nk or nk in k)][:1]  # solo el más relevante

EXCLUDE_NON_BOLIVIAN_DISHES = {
    "papa a la huancaina","papas a la huancaina","papas arrugadas","papas arrugadas con queso"
}
DEPT_FESTIVALS_DEFAULTS = {
    "La Paz":["Fiesta del 16 de Julio","Gran Poder","Alasitas"],
    "Cochabamba":["Virgen de Urcupiña","Aniversario departamental"],
    "Santa Cruz":["Carnaval cruceño","Aniversario de Santa Cruz"],
    "Oruro":["Carnaval de Oruro"],
    "Chuquisaca":["Aniversario de Chuquisaca","Fiesta de San Roque"],
    "Tarija":["Fiesta de la Vendimia","Aniversario departamental"],
    "Potosí":["Aniversario de Potosí","Tata Qolla"],
    "Beni":["Fiestas de Moxos"],
    "Pando":["Aniversario departamental"],
}
def _normalize_dish_name(name:str)->str:
    if not name: return ""
    n=_strip_accents(name.lower().strip())
    n=re.sub(r"[\.\,\-\–\—\(\)\[\]\!]+"," ",n)
    n=re.sub(r"\s+"," ",n).strip()
    return n

def _normalize_gastronomy(dep:Dict[str,Any])->Tuple[str,List[Dict[str,str]]]:
    pt=_soft(dep.get("comida_tradicional"),"Plato típico")
    extras_raw=dep.get("platos_adicionales") or []
    extras=[]
    for e in extras_raw:
        nombre=_soft(e.get("nombre"),None)
        if not nombre: continue
        norm=_normalize_dish_name(nombre)
        if norm in EXCLUDE_NON_BOLIVIAN_DISHES: continue
        costo=_soft(str(e.get("costo_aprox_bs")) if e.get("costo_aprox_bs") is not None else None,"consultar en sitio")
        extras.append({"nombre":nombre,"costo_aprox_bs":costo})
    return pt, extras[:4]

def _festivities(dep:Dict[str,Any])->List[str]:
    defaults=DEPT_FESTIVALS_DEFAULTS.get(dep.get("nombre",""),[]) if dep else []
    fest_raw=dep.get("festividades_principales") or []
    fest=[]; seen=set()
    for f in fest_raw:
        nombre=_soft(f.get("nombre"),None)
        if not nombre: continue
        clean=_strip_accents(nombre.lower())
        if "feria internacional" in clean or "festival de música" in clean: continue
        if nombre not in seen: fest.append(nombre); seen.add(nombre)
    for d in defaults:
        if d not in seen: fest.append(d); seen.add(d)
    return fest[:4]

def _dato_curioso(dep_name:str)->str:
    mapping={
        "La Paz":"La Paz opera una red de teleféricos urbanos única que conecta barrios a gran altura.",
        "Cochabamba":"Cochabamba es considerada la capital gastronómica de Bolivia.",
        "Santa Cruz":"Santa Cruz es el motor económico del país y puerta a la Amazonía.",
        "Oruro":"El Carnaval de Oruro es Patrimonio Oral e Intangible de la Humanidad (UNESCO).",
        "Chuquisaca":"Sucre (Chuquisaca) es cuna de la independencia boliviana.",
        "Tarija":"Tarija destaca por sus vinos de altura y la producción de singani.",
        "Potosí":"Potosí fue una de las ciudades más ricas por la plata del Cerro Rico.",
        "Beni":"Beni alberga gran biodiversidad amazónica y tradiciones misionales.",
        "Pando":"Pando comparte frontera con Brasil y concentra selva amazónica y ríos.",
    }
    return mapping.get(dep_name,"Bolivia ofrece diversidad cultural y natural excepcional en cada departamento.")

def _is_itinerary_request(prompt:str)->bool:
    q=prompt.lower()
    return any(k in q for k in ["itinerario","ruta","plan","agenda","días","dias","sugerencias","recomiendame","recomiéndame"])

def _is_greeting(prompt:str)->bool:
    q=prompt.strip().lower()
    return len(q)<=28 and any(g in q for g in ["hola","buenas","buenos dias","buenos días","saludos","hey","hello","hi","qué tal","que tal"])

def _build_itinerary(dep:Dict[str,Any])->Dict[str,Any]:
    dep_name=dep.get("nombre") or "Destino"
    costos=dep.get("costos_promedio") or {}
    comida_cost=costos.get("comida_local_bs","20–40")
    return {
        "titulo":f"Itinerario sugerido: {dep_name} (3 días)",
        "dias":[
            {"dia":1,"maniana":f"City tour y mercado. Almuerzo (Bs. {comida_cost}).","tarde":"Mirador/teleférico; plazas históricas."},
            {"dia":2,"maniana":"Excursión a atractivo principal (tour Bs. 60–150).","tarde":"Museo/Parque; cena típica."},
            {"dia":3,"maniana":"Barrio cultural y compras.","tarde":"Actividad libre / retorno."},
        ],
        "notas":"Ajusta actividades según clima y festividades locales."
    }

def _maybe_images_for_dep(dep: Dict[str, Any]) -> List[Dict[str, str]]:
    imgs = dep.get("imagenes") or dep.get("images") or []
    out=[]
    for im in imgs[:4]:
        url = im.get("url") or im.get("src") or ""
        alt = im.get("alt") or dep.get("nombre") or "Imagen"
        if url: out.append({"url": url, "alt": alt})
    return out

def _maybe_images_for_item(item: Dict[str, Any], fallback_alt: str) -> List[Dict[str, str]]:
    imgs = item.get("imagenes") or item.get("images") or []
    out=[]
    for im in imgs[:6]:
        url = im.get("url") or im.get("src") or ""
        alt = im.get("alt") or fallback_alt
        if url: out.append({"url": url, "alt": alt})
    return out

def _build_structured(
        dep:Dict[str,Any],
        hotels:List[Dict[str,Any]],
        places:List[Dict[str,Any]],
        is_itinerary:bool,
        matched_hotels:List[Dict[str,Any]],
        matched_places:List[Dict[str,Any]]
)->Dict[str,Any]:
    nombre_dep=dep.get("nombre") or ""
    pt,extras=_normalize_gastronomy(dep)
    festividades=_festivities(dep)
    resumen=_soft(dep.get("descripcion_cultural"),"Descripción cultural en preparación.")
    info_practica={"clima":_soft(dep.get("clima"),None),"mejor_epoca_visita":_soft(dep.get("mejor_epoca_visita"),None)}
    costos=dep.get("costos_promedio") or {}
    transporte=dep.get("transporte") or {}
    seguridad=_soft(dep.get("seguridad_consejos"),"Precaución básica y cuidado de pertenencias.")
    dato_c=_dato_curioso(nombre_dep)

    lugares_list=[]
    for p in places[:5]:
        costo_obj=p.get("costo_aprox_bs")
        if isinstance(costo_obj,dict):
            costos_det={k:v for k,v in costo_obj.items()}
        else:
            costos_det={"general":_soft(str(costo_obj) if costo_obj else None,"consultar en sitio")}
        lugares_list.append({
            "nombre":_soft(p.get("nombre"),"Lugar destacado"),
            "descripcion":_soft(p.get("descripcion"),"Descripción pendiente."),
            "horario":_soft(p.get("horario"),None),
            "costos":costos_det
        })
    if not lugares_list:
        for n in dep.get("lugares_destacados",[])[:4]:
            lugares_list.append({"nombre":n,"descripcion":"Información en preparación.","horario":None,"costos":{"general":"consultar en sitio"}})

    hoteles_list=[]
    for h in hotels[:3]:
        hoteles_list.append({
            "nombre":_soft(h.get("nombre"),"Hotel"),
            "ubicacion":_soft(h.get("ubicacion"),"Ubicación"),
            "calificacion":h.get("calificacion"),
            "rango_precios_bs":_soft(h.get("rango_precios_bs"),None)
        })

    itinerary=_build_itinerary(dep) if is_itinerary and nombre_dep else None

    hotel_consulta=None
    hotel_images=[]
    if matched_hotels:
        h=matched_hotels[0]
        hotel_consulta={
            "nombre":_soft(h.get("nombre"),"Hotel"),
            "departamento":_soft(h.get("departamento"),""),
            "ubicacion":_soft(h.get("ubicacion"),"Ubicación"),
            "calificacion":h.get("calificacion"),
            "rango_precios_bs":_soft(h.get("rango_precios_bs"),"N/D"),
            "descripcion":_soft(h.get("descripcion"), "Hotel recomendado dentro del destino.")
        }
        hotel_images = _maybe_images_for_item(h, h.get("nombre") or "Hotel")

    lugar_consulta=None
    lugar_images=[]
    if matched_places:
        p=matched_places[0]
        costo_obj=p.get("costo_aprox_bs")
        if isinstance(costo_obj,dict):
            costos_det={k:v for k,v in costo_obj.items()}
        else:
            costos_det={"general":_soft(str(costo_obj) if costo_obj else None,"consultar en sitio")}
        lugar_consulta={
            "nombre":_soft(p.get("nombre"),"Lugar turístico"),
            "departamento":_soft(p.get("departamento"),""),
            "descripcion":_soft(p.get("descripcion"),"Descripción pendiente."),
            "horario":_soft(p.get("horario"),"N/D"),
            "costos":costos_det
        }
        lugar_images = _maybe_images_for_item(p, p.get("nombre") or "Lugar turístico")

    dep_images = _maybe_images_for_dep(dep) if nombre_dep else []

    only_specific = (not nombre_dep) and (bool(hotel_consulta) or bool(lugar_consulta))

    return {
        "departamento":nombre_dep,
        "resumen":resumen,
        "lugares_turisticos":lugares_list,
        "hoteles":hoteles_list,
        "gastronomia":{"plato_tradicional":pt,"extras":extras},
        "historia_cultura_festividades":{"aniversario":_soft(dep.get("fecha_aniversario"),"N/D"),"festividades":festividades},
        "informacion_practica":info_practica,
        "costos_promedio":costos,
        "transporte":transporte,
        "seguridad":seguridad,
        "dato_curioso":dato_c,
        "itinerario":itinerary,
        "hotel_consulta":hotel_consulta,
        "lugar_consulta":lugar_consulta,
        "only_specific":only_specific,
        "images": {
            "departamento": dep_images,
            "hotel_consulta": hotel_images,
            "lugar_consulta": lugar_images
        },
        "meta":{"version_datos":(_DATA.get("info_base_datos") or {}).get("version","N/D"),
                "actualizado":(_DATA.get("info_base_datos") or {}).get("ultima_actualizacion","N/D")}
    }

def _final_html_polish(html:str)->str:
    s=re.sub(r"<pre[^>]*>.*?</pre>","",html,flags=re.DOTALL)
    s=re.sub(r"```.*?```","",s,flags=re.DOTALL)
    s=re.sub(r"(?:<hr>\s*){2,}","<hr>",s)
    s=re.sub(r"</section>\s*<section","</section>\n<section",s)
    return s

def query_ollama(context: str, user_prompt: str, history: List[Dict[str, str]]) -> str:
    system_msg = (
        "Eres MunayBol, un asistente turístico experto en Bolivia. "
        "Tu objetivo es ayudar a los usuarios a descubrir destinos, hoteles y lugares turísticos de Bolivia. "
        "Usa la siguiente información de contexto (extraída de nuestra base de datos) para responder. "
        "Si la información no está en el contexto, usa tu conocimiento general pero prioriza el contexto. "
        "Responde siempre en español, de forma amable y entusiasta. "
        "IMPORTANTE: Tu respuesta debe estar formateada en HTML simple (sin etiquetas <html> ni <body>, solo <p>, <ul>, <li>, <strong>, <h2>). "
        "No uses Markdown (no uses **negrita**, usa <strong>). "
        f"\n\nCONTEXTO:\n{context}"
    )
    
    messages = [{"role": "system", "content": system_msg}]
    
    # Add limited history (last 2-3 turns) to maintain context
    for h in history[-3:]:
        role = h.get("role", "user")
        content = h.get("content", "")
        if role == "user":
            messages.append({"role": "user", "content": content})
        elif role == "assistant": 
             messages.append({"role": "assistant", "content": content})

    messages.append({"role": "user", "content": user_prompt})

    try:
        payload = {
            "model": OLLAMA_MODEL,
            "messages": messages,
            "stream": False,
            "options": {"temperature": 0.7}
        }
        response = requests.post(f"{OLLAMA_URL}/api/chat", json=payload, timeout=45)
        response.raise_for_status()
        return response.json().get("message", {}).get("content", "")
    except Exception as e:
        logger.error(f"Ollama Error: {e}")
        return "<p>Lo siento, no pude procesar tu solicitud en este momento. Por favor intenta más tarde.</p>"

def send_message(
        prompt:str,
        chat_id:str,
        usuario:Any,
        historial:List[Dict[str,str]]=[],
        output_format:str="html",
        postprocess_output:bool=True,
        format_guard:bool=True,
        max_gastronomy_items:int=5,
        structured_output:bool=True,
)->Tuple[str,List[Dict[str,str]]]:
    logger.info("MunayBol Chat %s", chat_id)

    # 1. Detect Context
    dep_name = _dep_name_from_query(prompt)
    
    # Fallback to history if no department detected in current prompt
    if not dep_name and historial:
        # Iterate backwards to find the last detected department
        for h in reversed(historial):
            if h.get("department_detected"):
                dep_name = h.get("department_detected")
                logger.info(f"Context recovered from history: {dep_name}")
                break

    dep = _get_dep(dep_name) if dep_name else None
    
    # Filter lists based on department if found
    hotels = _filter_by_department(_HOTELS, dep.get("nombre") if dep else "", "departamento")
    places = _filter_by_department(_PLACES, dep.get("nombre") if dep else "", "departamento")

    # Specific matches
    matched_hotels = _match_hotels(prompt)
    matched_places = _match_places(prompt)

    # 2. Build Structured Data (Context)
    is_itinerary = _is_itinerary_request(prompt)
    structured = _build_structured(dep or {}, hotels, places, is_itinerary, matched_hotels, matched_places)
    
    # Convert structured data to a string for the LLM
    context_str = json.dumps(structured, ensure_ascii=False, indent=2)

    # 3. Call LLM
    llm_response_html = query_ollama(context_str, prompt, historial)
    
    # 4. Append Images (Hard to get LLM to do this reliably with local URLs)
    imgs_html = ""
    img_dep = structured.get("images", {}).get("departamento") or []
    img_hotel = structured.get("images", {}).get("hotel_consulta") or []
    img_lugar = structured.get("images", {}).get("lugar_consulta") or []
    
    # Prioritize specific images
    images_to_show = img_hotel or img_lugar or img_dep
    
    if images_to_show:
        imgs_html = "<div class='image-grid'>"
        for im in images_to_show[:3]: # Limit to 3 images
             imgs_html += f"<figure><img src='{im['url']}' alt='{im['alt']}' loading='lazy'><figcaption>{im['alt']}</figcaption></figure>"
        imgs_html += "</div>"

    # Combine
    final_html = f"<div class='munaybol-response'>{llm_response_html}{imgs_html}</div>"
    final_html = _final_html_polish(final_html)

    # 5. Return
    history_item={
        "role":"user",
        "content":prompt,
        "response_formatted":final_html,
        "output_format":output_format,
        "format_guard":True,
        "structured_output":True,
        "department_detected":dep.get("nombre") if dep else "",
        "data_version":structured["meta"]["version_datos"],
        "data_updated_at":structured["meta"]["actualizado"]
    }
    
    return final_html, [history_item]