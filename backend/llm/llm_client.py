import os
import re
import json
import logging
import unicodedata
from typing import List, Dict, Any, Tuple, Optional

logger = logging.getLogger(__name__)

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_FILE_PATH = os.path.join(BASE_DIR, 'data', 'munaybol_data.json')

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

    user_name = ""
    try:
        if isinstance(usuario, dict):
            user_name = usuario.get("nombre") or usuario.get("name") or ""
        else:
            user_name = getattr(usuario, "nombre", "") or getattr(usuario, "name", "") or ""
    except:
        user_name = ""

    dep_name=_dep_name_from_query(prompt)
    dep=_get_dep(dep_name) if dep_name else None
    hotels=_filter_by_department(_HOTELS, dep.get("nombre") if dep else "", "departamento")
    places=_filter_by_department(_PLACES, dep.get("nombre") if dep else "", "departamento")

    matched_hotels=_match_hotels(prompt)
    matched_places=_match_places(prompt)

    # Saludo natural con nombre y sin tarjetas si no hay dep/hotel/lugar detectado
    if _is_greeting(prompt) and not dep and not matched_hotels and not matched_places:
        text = f"¡Hola{', ' + user_name if user_name else ''}! ¿Sobre qué departamento, hotel o lugar turístico de Bolivia te gustaría información? Puedo incluir imágenes y un plan de viaje."
        history_item={
            "role":"user","content":prompt,"response_formatted":text,
            "output_format":"text","format_guard":True,"structured_output":False,
            "department_detected":"","data_version":(_DATA.get("info_base_datos") or {}).get("version","N/D"),
            "data_updated_at":(_DATA.get("info_base_datos") or {}).get("ultima_actualizacion","N/D")
        }
        return text,[history_item]

    is_itinerary=_is_itinerary_request(prompt)
    structured=_build_structured(dep or {}, hotels, places, is_itinerary, matched_hotels, matched_places)

    sections_html: List[str] = []

    def section(h2_text:str, lines:List[str])->str:
        html_parts=[]; in_list=False
        for line in lines:
            l=line.strip()
            if not l:
                if in_list: html_parts.append("</ul>"); in_list=False
                continue
            if l.startswith("- "):
                if not in_list: html_parts.append("<ul>"); in_list=True
                html_parts.append(f"<li>{l[2:].strip()}</li>")
            elif l.startswith("  - "):
                if not in_list: html_parts.append("<ul>"); in_list=True
                html_parts.append(f"<li>{l[4:].strip()}</li>")
            else:
                if in_list: html_parts.append("</ul>"); in_list=False
                html_parts.append(f"<p>{l}</p>")
        if in_list: html_parts.append("</ul>")
        return f"<section aria-labelledby='{re.sub(r'[^a-z0-9]+','-',h2_text.lower())}'><h2>{h2_text}</h2><hr>{''.join(html_parts)}</section>"

    intro_html=""
    if dep_name or structured.get("hotel_consulta") or structured.get("lugar_consulta"):
        greeting = f"Hola{', ' + user_name if user_name else ''}."
        if dep_name:
            intro = f"{greeting} Aquí tienes información de {dep_name}."
        elif structured.get("hotel_consulta"):
            intro = f"{greeting} Te detallo el hotel solicitado."
        else:
            intro = f"{greeting} Te detallo el lugar turístico solicitado."
        intro_html = "<section aria-labelledby='intro'><h2>Conversación</h2><hr><p>"+intro+"</p></section>"

    imgs_block = []
    img_dep = structured.get("images", {}).get("departamento") or []
    img_hotel = structured.get("images", {}).get("hotel_consulta") or []
    img_lugar = structured.get("images", {}).get("lugar_consulta") or []
    imgs_any = (img_dep or img_hotel or img_lugar)
    if imgs_any:
        imgs_html = []
        for im in (img_hotel or img_lugar or img_dep):
            imgs_html.append(f"<figure><img src='{im['url']}' alt='{im['alt']}' loading='lazy'><figcaption>{im['alt']}</figcaption></figure>")
        sections_html.append("<section aria-labelledby='imagenes'><h2>Imágenes</h2><hr><div class='image-grid'>" + "".join(imgs_html) + "</div></section>")

    if structured.get("only_specific"):
        if structured.get("hotel_consulta"):
            h=structured["hotel_consulta"]
            ficha = [
                f"- Nombre: {h['nombre']}",
                f"- Departamento: {h['departamento']}" if h.get("departamento") else "",
                f"- Ubicación: {h['ubicacion']}",
                f"- Calificación: {h['calificacion']}/5" if h.get("calificacion") is not None else "",
                f"- Rango precios: {h['rango_precios_bs']}",
                f"- Nota: {h['descripcion']}"
            ]
            sections_html.append(section("🏨 Hotel Consultado", [x for x in ficha if x]))
        if structured.get("lugar_consulta"):
            p=structured["lugar_consulta"]
            costos=p.get("costos") or {}
            costos_md=", ".join([f"{k}: {v}" for k,v in costos.items()]) if costos else "consultar en sitio"
            ficha = [
                f"- Nombre: {p['nombre']}",
                f"- Departamento: {p['departamento']}" if p.get("departamento") else "",
                f"- Descripción: {p['descripcion']}",
                f"- Horario: {p['horario']}",
                f"- Costos: {costos_md}"
            ]
            sections_html.append(section("📍 Lugar Turístico Consultado", [x for x in ficha if x]))
    else:
        lines=[]
        for l in structured["lugares_turisticos"]:
            lines.append(f"- **{l['nombre']}**: {l['descripcion']}")
            if l.get("horario"): lines.append(f"  - Horario: {l['horario']}")
            costos=l.get("costos",{})
            if costos:
                first=", ".join([f"{k}: {v}" for k,v in list(costos.items())[:2]])
                lines.append(f"  - Costos: {first}")
        sections_html.append(section("📍 Lugares Turísticos", lines or ["- Información en preparación."]))
        lines=[]
        if structured["hoteles"]:
            for h in structured["hoteles"]:
                precio=f" | {h['rango_precios_bs']}" if h.get("rango_precios_bs") else ""
                lines.append(f"- **{h['nombre']}** — {h['ubicacion']} (Calificación: {h.get('calificacion','N/D')}/5{precio})")
        else:
            lines.append("- Información en preparación.")
        sections_html.append(section("🏨 Hoteles Recomendados", lines))
        g=structured["gastronomia"]
        lines=[f"- Plato tradicional: {g['plato_tradicional']}"] + [f"- {e['nombre']} — Bs. {e['costo_aprox_bs']}" for e in g["extras"]]
        sections_html.append(section("🍽️ Gastronomía Típica", lines))
        hc=structured["historia_cultura_festividades"]
        lines=[f"- Aniversario: {hc['aniversario']}"]
        if hc["festividades"]:
            lines.append("- Festividades:")
            for f in hc["festividades"]:
                lines.append(f"  - {f}")
        sections_html.append(section("🏛️ Historia y Festividades", lines))
        info=structured["informacion_practica"]
        lines=[]
        if info.get("clima"): lines.append(f"- Clima: {info['clima']}")
        if info.get("mejor_epoca_visita"): lines.append(f"- Mejor época de visita: {info['mejor_epoca_visita']}")
        sections_html.append(section("ℹ️ Información Práctica", lines or ["- Consultar en sitio."]))
        costos=structured["costos_promedio"]
        lines=[]
        if costos:
            for k,v in costos.items():
                label=k.replace("_"," ").replace("bs","").strip().capitalize()
                lines.append(f"- {label}: Bs. {v}")
        else:
            lines.append("- Consultar en sitio.")
        sections_html.append(section("💰 Costos Promedio", lines))
        tr=structured["transporte"]
        lines=[]
        if tr.get("acceso"): lines.append(f"- Acceso: {tr['acceso']}")
        if tr.get("movilidad_urbana"): lines.append(f"- Movilidad urbana: {tr['movilidad_urbana']}")
        sections_html.append(section("🚍 Transporte", lines or ["- Consultar en sitio."]))
        sections_html.append(section("🛡️ Consejos de Seguridad", [f"- {structured['seguridad']}"]))
        sections_html.append(section("💡 Dato Curioso", [f"- {structured['dato_curioso']}"]))
        if structured.get("itinerario"):
            it=structured["itinerario"]
            lines=[f"- {it['titulo']}"]
            for d in it["dias"]:
                lines.append(f"  - Día {d['dia']}: Mañana: {d['maniana']} | Tarde: {d['tarde']}")
            if it.get("notas"): lines.append(f"  - Notas: {it['notas']}")
            sections_html.append(section("🗺️ Itinerario Sugerido", lines))

    html_full="<div class='munaybol-response'>" + (intro_html+"\n" if intro_html else "") + "\n".join(sections_html) + "</div>"
    html_full=_final_html_polish(html_full)

    json_embed=f"<script id='munaybol-structured' type='application/json'>{json.dumps(structured, ensure_ascii=False)}</script>"

    formatted = html_full + json_embed if output_format=="html" else html_full

    history_item={
        "role":"user",
        "content":prompt,
        "response_formatted":formatted,
        "output_format":output_format,
        "format_guard":True,
        "structured_output":True,
        "department_detected":dep.get("nombre") if dep else "",
        "data_version":structured["meta"]["version_datos"],
        "data_updated_at":structured["meta"]["actualizado"]
    }
    return formatted,[history_item]