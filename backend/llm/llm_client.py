import os
import re
import json
import logging
import unicodedata
from typing import List, Dict, Any, Tuple, Optional

logger = logging.getLogger(__name__)

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_FILE_PATH = os.path.join(BASE_DIR, 'data', 'munaybol_data.json')

# Datos cache
_DATA: Dict[str, Any] = {}
_DEPTOS: List[Dict[str, Any]] = []
_HOTELS: List[Dict[str, Any]] = []
_PLACES: List[Dict[str, Any]] = []

def load_data():
    global _DATA, _DEPTOS, _HOTELS, _PLACES
    try:
        with open(DATA_FILE_PATH, 'r', encoding='utf-8') as f:
            _DATA = json.load(f)
        _DEPTOS = _DATA.get("departamentos", []) or []
        _HOTELS = _DATA.get("hoteles", []) or []
        _PLACES = _DATA.get("lugares_turisticos", []) or []
        base_info = _DATA.get("info_base_datos", {})
        logger.info(f"MunayBol JSON v{base_info.get('version')} actualizado {base_info.get('ultima_actualizacion')}: deptos={len(_DEPTOS)} hoteles={len(_HOTELS)} lugares={len(_PLACES)}")
    except Exception as e:
        logger.error(f"Error cargando JSON: {e}")
        _DATA = {}
        _DEPTOS = []
        _HOTELS = []
        _PLACES = []

load_data()
def _strip_accents(s: str) -> str:
    return "".join(c for c in unicodedata.normalize("NFD", s) if unicodedata.category(c) != "Mn")

def _soft_value(v: Optional[str], fallback: Optional[str] = None) -> Optional[str]:
    if v is None:
        return fallback
    if isinstance(v, (int, float)):
        return str(v)
    if v.strip().lower() in ("", "n/d", "nd"):
        return fallback
    return v.strip()

def _dep_name_from_query(query: str) -> str:
    q = _strip_accents(query.lower())
    for d in _DEPTOS:
        nombre = _strip_accents((d.get('nombre') or '').lower())
        if not nombre:
            continue
        if nombre in q or q in nombre or nombre.startswith(q):
            return d.get('nombre') or ''
    return ''

def _get_dep(dep_name: str) -> Optional[Dict[str, Any]]:
    for d in _DEPTOS:
        if (d.get('nombre') or '').lower() == (dep_name or '').lower():
            return d
    return None

def _filter_by_department(items: List[Dict[str, Any]], dep: str, dep_field: str) -> List[Dict[str, Any]]:
    if not dep:
        return []
    dep_norm = _strip_accents(dep.lower().replace(" ", ""))
    out = []
    for it in items or []:
        val = _strip_accents((it.get(dep_field) or '').lower().replace(" ", ""))
        if val == dep_norm:
            out.append(it)
    return out

EXCLUDE_NON_BOLIVIAN_DISHES = {
    "papa a la huancaina", "papas a la huancaina", "papas arrugadas", "papas arrugadas con queso"
}
DEPT_FESTIVALS_DEFAULTS = {
    "La Paz": ["Fiesta del 16 de Julio", "Gran Poder", "Alasitas"],
    "Cochabamba": ["Virgen de Urcupiña", "Aniversario departamental"],
    "Santa Cruz": ["Carnaval cruceño", "Aniversario de Santa Cruz"],
    "Oruro": ["Carnaval de Oruro"],
    "Chuquisaca": ["Aniversario de Chuquisaca", "Fiesta de San Roque"],
    "Tarija": ["Fiesta de la Vendimia", "Aniversario departamental"],
    "Potosí": ["Aniversario de Potosí", "Tata Qolla"],
    "Beni": ["Fiestas de Moxos"],
    "Pando": ["Aniversario departamental"],
}

def _normalize_dish_name(name: str) -> str:
    if not name: return ""
    n = _strip_accents(name.lower().strip())
    n = re.sub(r"[\.\,\-\–\—\(\)\[\]\!]+", " ", n)
    n = re.sub(r"\s+", " ", n).strip()
    return n

def _normalize_gastronomy(dep: Dict[str, Any]) -> Tuple[str, List[Dict[str, str]]]:
    pt = _soft_value(dep.get("comida_tradicional"), "Plato típico")
    extras_raw = dep.get("platos_adicionales") or []
    extras: List[Dict[str, str]] = []
    for e in extras_raw:
        nombre = _soft_value(e.get("nombre"), None)
        if not nombre:
            continue
        norm = _normalize_dish_name(nombre)
        if norm in EXCLUDE_NON_BOLIVIAN_DISHES:
            continue
        costo_val = e.get("costo_aprox_bs")
        costo = _soft_value(str(costo_val) if costo_val is not None else None, "consultar en sitio")
        extras.append({"nombre": nombre, "costo_aprox_bs": costo})
    return pt, extras[:4]

def _festividades_for_dep(dep: Dict[str, Any]) -> List[str]:
    defaults = DEPT_FESTIVALS_DEFAULTS.get(dep.get("nombre", ""), []) if dep else []
    fest_raw = dep.get("festividades_principales") or []
    fest = []
    seen = set()
    for f in fest_raw:
        nombre = _soft_value(f.get("nombre"), None)
        if not nombre:
            continue
        clean = _strip_accents(nombre.lower())
        if "feria internacional" in clean or "festival de música" in clean:
            continue
        if nombre not in seen:
            fest.append(nombre); seen.add(nombre)
    for d in defaults:
        if d not in seen:
            fest.append(d); seen.add(d)
    return fest[:4]

def _dato_curioso(dep_name: str) -> str:
    mapping = {
        "La Paz": "La Paz opera una red de teleféricos urbanos única que conecta barrios a gran altura.",
        "Cochabamba": "Cochabamba es considerada la capital gastronómica de Bolivia.",
        "Santa Cruz": "Santa Cruz es el motor económico del país y puerta a la Amazonía.",
        "Oruro": "El Carnaval de Oruro es Patrimonio Oral e Intangible de la Humanidad (UNESCO).",
        "Chuquisaca": "Sucre, capital de Chuquisaca, es cuna de la independencia boliviana.",
        "Tarija": "Tarija destaca por sus vinos de altura y la producción de singani.",
        "Potosí": "Potosí fue una de las ciudades más ricas por la plata del Cerro Rico.",
        "Beni": "Beni alberga gran biodiversidad amazónica y tradiciones misionales.",
        "Pando": "Pando comparte frontera con Brasil y concentra selva amazónica y ríos.",
    }
    return mapping.get(dep_name, "Bolivia ofrece diversidad cultural y natural excepcional en cada departamento.")

def _is_itinerary_request(prompt: str) -> bool:
    q = prompt.lower()
    return any(k in q for k in ["itinerario", "ruta", "plan", "agenda", "días", "dias", "sugerencias", "recomiendame", "recomiéndame"])

def _build_itinerary(dep: Dict[str, Any]) -> Dict[str, Any]:
    dep_name = dep.get("nombre") or "Destino"
    costos = dep.get("costos_promedio") or {}
    comida_cost = costos.get("comida_local_bs", "20–40")
    return {
        "titulo": f"Itinerario sugerido: {dep_name} (3 días)",
        "dias": [
            {"dia": 1, "maniana": f"City tour y mercado tradicional. Almuerzo local (Bs. {comida_cost}).", "tarde": "Teleférico o mirador; paseo por plazas históricas."},
            {"dia": 2, "maniana": "Excursión a lugar destacado cercano (tour Bs. 60–150).", "tarde": "Museo/Parque; cena típica."},
            {"dia": 3, "maniana": "Barrio cultural y compras; café local.", "tarde": "Actividad libre o tour corto; regreso."},
        ],
        "notas": "Ajusta actividades según clima y temporada; reserva con antelación en festividades."
    }

def _build_structured(dep: Dict[str, Any], hotels: List[Dict[str, Any]], places: List[Dict[str, Any]], is_itinerary: bool) -> Dict[str, Any]:
    nombre_dep = dep.get("nombre") or ""
    pt, extras = _normalize_gastronomy(dep)
    festividades = _festividades_for_dep(dep)
    resumen = _soft_value(dep.get("descripcion_cultural"), "Descripción cultural en preparación.")
    info_practica = {
        "clima": _soft_value(dep.get("clima"), None),
        "mejor_epoca_visita": _soft_value(dep.get("mejor_epoca_visita"), None)
    }
    costos = dep.get("costos_promedio") or {}
    transporte = dep.get("transporte") or {}
    seguridad = _soft_value(dep.get("seguridad_consejos"), "Precaución básica y cuidado de pertenencias.")
    dato_c = _dato_curioso(nombre_dep)

    lugares_list = []
    for p in places[:5]:
        costo_obj = p.get("costo_aprox_bs")
        if isinstance(costo_obj, dict):
            costos_det = {k: v for k, v in costo_obj.items()}
        else:
            costos_det = {"general": _soft_value(str(costo_obj) if costo_obj else None, "consultar en sitio")}
        lugares_list.append({
            "nombre": _soft_value(p.get("nombre"), "Lugar destacado"),
            "descripcion": _soft_value(p.get("descripcion"), "Descripción pendiente."),
            "horario": _soft_value(p.get("horario"), None),
            "costos": costos_det
        })

    if not lugares_list:
        for n in dep.get("lugares_destacados", [])[:4]:
            lugares_list.append({
                "nombre": n,
                "descripcion": "Información en preparación.",
                "horario": None,
                "costos": {"general": "consultar en sitio"}
            })

    hoteles_list = []
    for h in hotels[:3]:
        hoteles_list.append({
            "nombre": _soft_value(h.get("nombre"), "Hotel"),
            "ubicacion": _soft_value(h.get("ubicacion"), "Ubicación"),
            "calificacion": h.get("calificacion"),
            "rango_precios_bs": _soft_value(h.get("rango_precios_bs"), None)
        })

    itinerary = _build_itinerary(dep) if is_itinerary else None

    return {
        "departamento": nombre_dep,
        "resumen": resumen,
        "lugares_turisticos": lugares_list,
        "hoteles": hoteles_list,
        "gastronomia": {
            "plato_tradicional": pt,
            "extras": extras
        },
        "historia_cultura_festividades": {
            "aniversario": _soft_value(dep.get("fecha_aniversario"), "N/D"),
            "festividades": festividades
        },
        "informacion_practica": info_practica,
        "costos_promedio": costos,
        "transporte": transporte,
        "seguridad": seguridad,
        "dato_curioso": dato_c,
        "itinerario": itinerary,
        "meta": {
            "version_datos": (_DATA.get("info_base_datos") or {}).get("version", "N/D"),
            "actualizado": (_DATA.get("info_base_datos") or {}).get("ultima_actualizacion", "N/D")
        }
    }

def _markdown_from_structured(d: Dict[str, Any], prompt: str) -> str:
    md = []
    dep = d.get('departamento') or 'este destino'
    saludo = f"Hola 👋 Soy tu asistente de MunayBol. ¡Excelente elección! Te ayudo con {dep}. A continuación, te muestro lo más importante."
    md.append(saludo)
    md.append("")
    if d.get("resumen"):
        md.append(f"Resumen: {d['resumen']}")
        md.append("")

    if d.get("itinerario"):
        it = d["itinerario"]
        md.append(f"### {it['titulo']}")
        for dia in it["dias"]:
            md.append(f"- Día {dia['dia']}")
            md.append(f"  - Mañana: {dia['maniana']}")
            md.append(f"  - Tarde: {dia['tarde']}")
        if it.get("notas"):
            md.append(f"Nota: {it['notas']}")
        md.append("")

    md.append("## 📍 **Lugares Turísticos**")
    md.append("---")
    for l in d["lugares_turisticos"]:
        md.append(f"- **{l['nombre']}**: {l['descripcion']}")
        if l.get("horario"):
            md.append(f"  - Horario: {l['horario']}")
        costos = l.get("costos", {})
        if costos:
            primera = ", ".join([f"{k}: {v}" for k, v in list(costos.items())[:2]])
            md.append(f"  - Costos: {primera}")

    md.append("## 🏨 **Hoteles Recomendados**")
    md.append("---")
    if d["hoteles"]:
        for h in d["hoteles"]:
            precio = f" | {h['rango_precios_bs']}" if h.get("rango_precios_bs") else ""
            md.append(f"- **{h['nombre']}** — {h['ubicacion']} (Calificación: {h.get('calificacion', 'N/D')}/5{precio})")
    else:
        md.append("- Información en preparación.")

    md.append("## 🍽️ **Gastronomía Típica**")
    md.append("---")
    g = d["gastronomia"]
    md.append(f"- Plato Tradicional: **{g['plato_tradicional']}**")
    for e in g["extras"]:
        md.append(f"- {e['nombre']} — Costo aprox.: Bs. {e['costo_aprox_bs']}")

    md.append("## 🏛️ **Historia Breve, Cultura y Festividades**")
    md.append("---")
    hc = d["historia_cultura_festividades"]
    md.append(f"- Aniversario: {hc['aniversario']}")
    if hc["festividades"]:
        md.append("- Festividades:")
        for f in hc["festividades"]:
            md.append(f"  - {f}")

    md.append("## ℹ️ **Información Práctica**")
    md.append("---")
    info = d["informacion_practica"]
    if info.get("clima"):
        md.append(f"- Clima: {info['clima']}")
    if info.get("mejor_epoca_visita"):
        md.append(f"- Mejor época de visita: {info['mejor_epoca_visita']}")

    md.append("## 💰 **Costos Promedio**")
    md.append("---")
    costos = d["costos_promedio"]
    if costos:
        for k, v in costos.items():
            label = k.replace("_", " ").replace("bs", "").strip().capitalize()
            md.append(f"- {label}: Bs. {v}")
    else:
        md.append("- Consultar en sitio.")

    md.append("## 🚍 **Transporte**")
    md.append("---")
    tr = d["transporte"]
    if tr.get("acceso"):
        md.append(f"- Acceso: {tr['acceso']}")
    if tr.get("movilidad_urbana"):
        md.append(f"- Movilidad urbana: {tr['movilidad_urbana']}")

    md.append("## 🛡️ **Consejos de Seguridad**")
    md.append("---")
    md.append(f"- {d['seguridad']}")

    md.append("## 💡 **Dato Curioso**")
    md.append("---")
    md.append(f"- {d['dato_curioso']}")
    return "\n".join(md).strip()

def _final_html_polish(html: str) -> str:
    s = re.sub(r"<pre[^>]*>.*?</pre>", "", html, flags=re.DOTALL)
    s = re.sub(r"```.*?```", "", s, flags=re.DOTALL)
    s = re.sub(r"(?:<hr>\s*){2,}", "<hr>", s)
    s = re.sub(r"</section>\s*<section", "</section>\n<section", s)
    return s

def send_message(
        prompt: str,
        chat_id: str,
        usuario: Any,
        historial: List[Dict[str, str]] = [],
        output_format: str = "html",
        postprocess_output: bool = True,
        format_guard: bool = True,
        max_gastronomy_items: int = 5,
        structured_output: bool = True,
) -> Tuple[str, List[Dict[str, str]]]:
    logger.info("MunayBol Chat %s", chat_id)
    dep_name = _dep_name_from_query(prompt)
    dep = _get_dep(dep_name) if dep_name else None
    hotels = _filter_by_department(_HOTELS, dep.get("nombre") if dep else "", "departamento")
    places = _filter_by_department(_PLACES, dep.get("nombre") if dep else "", "departamento")
    is_itinerary = _is_itinerary_request(prompt)

    structured = _build_structured(dep or {}, hotels, places, is_itinerary)
    md = _markdown_from_structured(structured, prompt)

    intro_html = ""
    intro_lines = []
    for ln in md.splitlines():
        if ln.startswith("## "):
            break
        if ln.strip():
            intro_lines.append(ln.strip())
    if intro_lines:
        intro_html = "<section aria-labelledby='intro'><h2>Conversación</h2><hr>" + "".join(f"<p>{l}</p>" for l in intro_lines) + "</section>"

    def section(h2_text: str, inner_md: str) -> str:
        lines = inner_md.strip().splitlines()
        html_parts = []
        in_list = False
        for line in lines:
            l = line.strip()
            if not l:
                if in_list:
                    html_parts.append("</ul>")
                    in_list = False
                continue
            if l.startswith("- "):
                if not in_list:
                    html_parts.append("<ul>")
                    in_list = True
                html_parts.append(f"<li>{l[2:].strip()}</li>")
            elif l.startswith("  - "):
                if not in_list:
                    html_parts.append("<ul>")
                    in_list = True
                html_parts.append(f"<li>{l[4:].strip()}</li>")
            else:
                if in_list:
                    html_parts.append("</ul>")
                    in_list = False
                html_parts.append(f"<p>{l}</p>")
        if in_list:
            html_parts.append("</ul>")
        return f"<section aria-labelledby='{re.sub(r'[^a-z0-9]+','-',h2_text.lower())}'><h2>{h2_text}</h2><hr>{''.join(html_parts)}</section>"

    h2_pattern = re.compile(r"^##\s+(.*)$", flags=re.MULTILINE)
    blocks = h2_pattern.split(md)
    sections_html = []
    for i in range(1, len(blocks), 2):
        h2_raw = blocks[i].strip()
        content_block = blocks[i+1] if (i+1) < len(blocks) else ""
        content_block = re.sub(r"^---\s*", "", content_block.strip(), flags=re.MULTILINE)
        sections_html.append(section(h2_raw, content_block))

    html_full = "<div class='munaybol-response'>" + intro_html + "\n" + "\n".join(sections_html) + "</div>"
    html_full = _final_html_polish(html_full)

    json_embed = f"<script id='munaybol-structured' type='application/json'>{json.dumps(structured, ensure_ascii=False)}</script>"

    if output_format == "html":
        formatted = html_full + json_embed
    elif output_format == "text":
        formatted = md
    else:
        formatted = md

    history_item = {
        "role": "user",
        "content": prompt,
        "response_formatted": formatted,
        "output_format": output_format,
        "format_guard": format_guard,
        "structured_output": True,
        "department_detected": dep.get("nombre") if dep else "",
        "data_version": structured["meta"]["version_datos"],
        "data_updated_at": structured["meta"]["actualizado"]
    }
    return formatted, [history_item]