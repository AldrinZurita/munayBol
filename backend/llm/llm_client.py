# -*- coding: utf-8 -*-
import os
import re
import json
import logging
import requests
import unicodedata
from typing import List, Dict, Any, Tuple, Optional

try:
    import markdown as md
    import bleach
except Exception:
    md = None
    bleach = None

logger = logging.getLogger(__name__)

# --- CONFIGURACIÓN DE RUTAS ---
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_FILE_PATH = os.path.join(BASE_DIR, 'data', 'munaybol_data.json')

# --- ENV: Configuración de Alto Rendimiento ---
OLLAMA_BASE_URL        = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
OLLAMA_MODEL           = os.getenv("OLLAMA_MODEL", "llama3.1:latest")
OLLAMA_MAX_TOKENS      = int(os.getenv("OLLAMA_MAX_TOKENS", "1500"))
OLLAMA_TEMPERATURE     = float(os.getenv("OLLAMA_TEMPERATURE", "0.3"))
OLLAMA_NUM_CTX         = int(os.getenv("OLLAMA_NUM_CTX", "4096"))
OLLAMA_TIMEOUT         = float(os.getenv("OLLAMA_TIMEOUT", "180"))
OLLAMA_NUM_GPU         = int(os.getenv("OLLAMA_NUM_GPU", "99"))

REQUIRED_HEADERS = {"Content-Type": "application/json"}

_DATA_DEPARTAMENTOS = []
_DATA_HOTELES = []
_DATA_LUGARES = []

def load_data():
    global _DATA_DEPARTAMENTOS, _DATA_HOTELES, _DATA_LUGARES
    try:
        if os.path.exists(DATA_FILE_PATH):
            with open(DATA_FILE_PATH, 'r', encoding='utf-8') as f:
                raw_content = json.load(f)
                _DATA_DEPARTAMENTOS = raw_content.get("departamentos", [])
                _DATA_HOTELES = raw_content.get("hoteles", [])
                _DATA_LUGARES = raw_content.get("lugares_turisticos", [])
            logger.info(f"✅ Datos Cargados: Deptos={len(_DATA_DEPARTAMENTOS)}, Hoteles={len(_DATA_HOTELES)}, Lugares={len(_DATA_LUGARES)}.")
        else:
            logger.warning(f"⚠️ Archivo no encontrado: {DATA_FILE_PATH}")
    except Exception as e:
        logger.error(f"❌ Error cargando JSON: {e}")

load_data()

# --- RENDER HTML/TEXT ---

ALLOWED_HTML_TAGS = [
    'h1','h2','h3','h4','h5','h6','p','br','hr',
    'ul','ol','li',
    'strong','em','b','i','code','span',
    'table','thead','tbody','tr','th','td',
    'a',
]

ALLOWED_HTML_ATTRS = {
    'a': ['href', 'title', 'target', 'rel'],
    'span': ['class'],
    'table': ['class'],
    'th': ['class'],
    'td': ['class'],
}

def render_markdown_to_html(markdown_text: str) -> str:
    if not markdown_text:
        return ""
    if md is None or bleach is None:
        return f"<div class=\"prose\">{markdown_text}</div>"
    html = md.markdown(
        markdown_text,
        extensions=['extra','sane_lists','nl2br','toc','admonition']
    )
    clean = bleach.clean(html, tags=ALLOWED_HTML_TAGS, attributes=ALLOWED_HTML_ATTRS, strip=True)
    clean = clean.replace("<p>---</p>", "<hr>")
    return clean

def render_markdown_to_text(markdown_text: str) -> str:
    if not markdown_text:
        return ""
    lines = markdown_text.splitlines()
    out = []
    for ln in lines:
        l = ln.strip()
        if not l:
            out.append("")
            continue
        if l.startswith("#"):
            header_text = l.lstrip("#").strip()
            out.append(header_text.upper())
            out.append("")
            continue
        if l == "---":
            out.append("-" * 40)
            continue
        if l.startswith(("* ", "- ", "+ ")):
            out.append(f"- {l[2:].strip()}")
            continue
        l = l.replace("**", "").replace("*", "")
        out.append(l)
    return "\n".join(out)

# --- Normalización/limpieza ---

def _strip_accents(s: str) -> str:
    return "".join(c for c in unicodedata.normalize("NFD", s) if unicodedata.category(c) != "Mn")

def _normalize_dish_name(name: str) -> str:
    if not name:
        return ""
    n = name.strip()
    n = _strip_accents(n.lower())
    remove_patterns = [
        r"\bcochabambin[ao]s?\b", r"\bcochabamba\b", r"\bde\s+queso\b", r"\bde\s+pollo\b", r"\bde\s+res\b",
        r"\btradicional(?:es)?\b", r"\btipic[ao]s?\b", r"\bbolivian[ao]s?\b", r"\bregional(?:es)?\b",
    ]
    for pat in remove_patterns:
        n = re.sub(pat, "", n)
    n = re.sub(r"[\.\,\-\–\—\(\)\[\]\!]+", " ", n)
    n = re.sub(r"\s+", " ", n).strip()
    return n

def _extract_official_dish(official_data: str) -> Optional[str]:
    if not official_data:
        return None
    m = re.search(r"Plato\s+Tradicional:\s*(.+)", official_data, flags=re.IGNORECASE)
    if not m:
        return None
    dish = m.group(1).strip()
    dish = dish.splitlines()[0].strip()
    return dish if dish else None

def _split_gastronomy_dishes(section_text: str) -> Tuple[str, List[str]]:
    m = re.search(r"\n###\s", section_text)
    if not m:
        return section_text, []
    header = section_text[:m.start()].rstrip() + "\n"
    rest = section_text[m.start()+1:]
    parts = re.split(r"\n(?=###\s)", "\n" + rest)
    dishes = [p.strip() for p in parts if p.strip()]
    return header, dishes

def _extract_dish_title(dish_block: str) -> str:
    first_line = dish_block.splitlines()[0].strip()
    if first_line.startswith("###"):
        first_line = first_line[3:].strip()
    first_line = re.sub(r"^\d+\.\s*", "", first_line).strip()
    return first_line

def _rebuild_gastronomy_section(header: str, dish_blocks: List[str], official_data: str, max_items: int) -> str:
    seen = set()
    unique_blocks = []
    title_map = []
    for idx, block in enumerate(dish_blocks):
        title = _extract_dish_title(block)
        norm = _normalize_dish_name(title)
        if not norm or norm in seen:
            continue
        seen.add(norm)
        title_map.append((norm, title, idx))
        unique_blocks.append(block)
    official = _extract_official_dish(official_data or "")
    if official:
        norm_off = _normalize_dish_name(official)
        for i, (norm, _, _) in enumerate(title_map):
            if norm == norm_off and i != 0:
                official_block = unique_blocks.pop(i)
                unique_blocks.insert(0, official_block)
                title_map.insert(0, title_map.pop(i))
                break
    unique_blocks = unique_blocks[:max_items]
    rebuilt = [header.rstrip()]
    for i, block in enumerate(unique_blocks, start=1):
        lines = block.splitlines()
        old_title = _extract_dish_title(block)
        new_title = f"### {i}. {old_title}"
        if lines:
            lines[0] = new_title
        else:
            lines = [new_title]
        rebuilt.append("\n".join(lines).strip())
    return ("\n\n".join(rebuilt).strip() + "\n")

def _clean_gastronomy_duplicates(md: str, official_data: str, max_items: int = 5) -> str:
    md = re.sub(r"^##\s*🍽️\s*\*\*Gastronomía\s*Típica.*\*\*", "## 🍽️ **Gastronomía Típica**", md,
                flags=re.IGNORECASE | re.MULTILINE)
    start = md.find("## 🍽️ **Gastronomía Típica**")
    if start == -1:
        start = md.find("## Gastronomía Típica")
    if start == -1:
        return md
    next_h2 = md.find("\n## ", start + 3)
    end = len(md) if next_h2 == -1 else next_h2
    section = md[start:end]
    header, dishes = _split_gastronomy_dishes(section)
    if not dishes:
        return md
    new_section = _rebuild_gastronomy_section(header, dishes, official_data, max_items)
    return md[:start] + new_section + md[end:]

def _light_normalize(md: str) -> str:
    md = re.sub(r"\n\s*---\s*\n*", "\n---\n", md)
    md = re.sub(r"\n{3,}", "\n\n", md)
    return md

# Tidy extra: arregla bullets, espacios y H3 excesivos en contenidos sucios
def _tidy_extra(md: str) -> str:
    lines = md.splitlines()
    fixed = []
    for i, l in enumerate(lines):
        s = l.rstrip()
        s = re.sub(r"^\s*\+\s+", "- ", s)
        s = re.sub(r"^\s*\*\s+\*", "- ", s)
        s = re.sub(r"^(#{3,})([^\s#])", r"\1 \2", s)
        fixed.append(s)
    md = "\n".join(fixed)
    md = re.sub(r"(###\s+)(#+\s+)", r"\1", md)
    return md

# --- FORMAT GUARD ---

REQUIRED_H2 = [
    "## 📍 **Lugares Turísticos**",
    "## 🏨 **Hoteles Recomendados**",
    "## 🍽️ **Gastronomía Típica**",
    "## 🏛️ **Historia Breve, Cultura y Festividades**",
    "## 💡 **Dato Curioso**",
]

def _normalize_h2_variants(md: str) -> str:
    patterns = [
        (r"^##\s*📍.*Lugares\s*Turísticos.*$", "## 📍 **Lugares Turísticos**"),
        (r"^##\s*🏨.*Hoteles.*Recomendados.*$", "## 🏨 **Hoteles Recomendados**"),
        (r"^##\s*🍽️.*Gastronomía\s*Típica.*$", "## 🍽️ **Gastronomía Típica**"),
        (r"^##\s*🏛️.*Historia.*Cultura.*Festividades.*$", "## 🏛️ **Historia Breve, Cultura y Festividades**"),
        (r"^##\s*💡.*Dato\s*Curioso.*$", "## 💡 **Dato Curioso**"),
    ]
    for pat, repl in patterns:
        md = re.sub(pat, repl, md, flags=re.IGNORECASE | re.MULTILINE)
    return md

def _ensure_hr_after_each_h2(md: str) -> str:
    def insert_hr(block: str) -> str:
        lines = block.splitlines()
        out = []
        for i, line in enumerate(lines):
            out.append(line)
            if any(line.strip().startswith(h2) for h2 in REQUIRED_H2):
                if i + 1 >= len(lines) or lines[i+1].strip() != "---":
                    out.append("---")
        return "\n".join(out)
    return insert_hr(md)

def _ensure_required_sections(md: str, detected_dpto: str) -> str:
    md = _normalize_h2_variants(md)
    positions = {h2: md.find(h2) for h2 in REQUIRED_H2}
    chunks = {}
    for idx, h2 in enumerate(REQUIRED_H2):
        pos = positions[h2]
        if pos == -1:
            chunks[h2] = None
            continue
        next_pos_candidates = [positions[h] for h in REQUIRED_H2[idx+1:] if positions[h] != -1]
        end = min(next_pos_candidates) if next_pos_candidates else len(md)
        chunks[h2] = md[pos:end].strip()
    final_parts = []
    placeholder = lambda sec: f"{sec}\n---\n*(Información en preparación para {detected_dpto or 'este destino'}.)*\n"
    for h2 in REQUIRED_H2:
        final_parts.append(chunks.get(h2) or placeholder(h2))
    final_md = "\n\n".join(final_parts).strip()
    final_md = _ensure_hr_after_each_h2(final_md)
    return final_md

def _enforce_itinerary(md: str, detected_dpto: str) -> str:
    if not re.search(r"(?i)\bD[ií]a\s*1\b", md):
        md += f"\n\n### Día 1\n- Mañana: *(Por definir en función de tus intereses en {detected_dpto or 'el destino'}).*" \
              f"\n- Tarde: *(Actividades recomendadas próximamente).*"
    if not re.search(r"(?i)\bD[ií]a\s*2\b", md):
        md += "\n\n### Día 2\n- Mañana: *(Por definir)*\n- Tarde: *(Por definir)*"
    if not re.search(r"(?i)\bD[ií]a\s*3\b", md):
        md += "\n\n### Día 3\n- Mañana: *(Por definir)*\n- Tarde: *(Por definir)*"
    return md

def _format_guard(md: str, is_itinerary: bool, detected_dpto: str, official_data: str, max_gastro_items: int) -> str:
    if not md:
        return md
    md = _normalize_h2_variants(md)
    md = _tidy_extra(md)
    if is_itinerary:
        md = _enforce_itinerary(md, detected_dpto)
    else:
        md = _ensure_required_sections(md, detected_dpto)
        md = _clean_gastronomy_duplicates(md, official_data, max_items=max_gastro_items)
    md = _ensure_hr_after_each_h2(md)
    md = _light_normalize(md)
    return md

# --- BÚSQUEDA INTELIGENTE ---

def find_official_data(query: str) -> Tuple[str, str]:
    q = query.lower()
    for dpto in _DATA_DEPARTAMENTOS:
        nombre = dpto.get('nombre', '').lower()
        if nombre and (nombre in q or q in nombre or (len(q) > 2 and nombre.startswith(q))):
            info = (
                f"DATOS OFICIALES DE {dpto.get('nombre', 'N/D').upper()}:\n"
                f"- Aniversario: {dpto.get('fecha_aniversario', 'N/D')}\n"
                f"- Plato Tradicional: {dpto.get('comida_tradicional', 'N/D')}\n"
                f"IMPORTANTE: Usa este plato y fecha con prioridad ABSOLUTA."
            )
            return info, dpto.get('nombre')
    return "", ""

def find_contextual_data(query: str, dpto_name: str) -> str:
    if not dpto_name:
        return ""
    dpto_lower = dpto_name.lower().replace(" ", "")
    valid = [dpto_name.lower(), dpto_name.lower().replace("í", "i"), dpto_lower]
    results = []
    hotels = [h for h in _DATA_HOTELES if h.get('departamento', '').lower().replace(" ", "") in valid]
    if hotels:
        hotel_data = json.dumps(
            [{"nombre": h.get("nombre"), "ubicacion": h.get("ubicacion"), "calificacion": h.get("calificacion")} for h in hotels[:4]],
            ensure_ascii=False
        )
        results.append(f"HOTELES EN {dpto_name.upper()}: {hotel_data}")
    lugares = [l for l in _DATA_LUGARES if l.get('departamento', '').lower().replace(" ", "") in valid]
    if lugares:
        lugar_data = json.dumps(
            [{"nombre": l.get("nombre"), "tipo": l.get("tipo"), "descripcion": (l.get("descripcion") or "")[:150].replace('\\n', ' ') + '...', "horario": l.get("horario", "N/D")} for l in lugares[:5]],
            ensure_ascii=False
        )
        results.append(f"LUGARES TURÍSTICOS EN {dpto_name.upper()}: {lugar_data}")
    return "\n---\n".join(results) if results else ""

# --- LLAMADA LLM ---

def _chat_generate(messages: List[Dict[str, str]], options: Dict[str, Any]) -> str:
    url = f"{OLLAMA_BASE_URL}/api/chat"
    payload = {
        "model": OLLAMA_MODEL,
        "messages": messages,
        "stream": False,
        "options": options
    }
    try:
        resp = requests.post(url, json=payload, headers=REQUIRED_HEADERS, timeout=OLLAMA_TIMEOUT)
        if resp.status_code != 200:
            logger.error(f"Ollama HTTP {resp.status_code}: {resp.text[:200]}")
            return ""
        data = resp.json()
        return (data.get('message') or {}).get('content', "").strip()
    except Exception as e:
        logger.error(f"Error conexión Ollama: {e}")
        return ""

# --- Structured JSON Approach ---

# Reglas de exclusión/normalización para Gastronomía y Festividades
EXCLUDE_NON_BOLIVIAN_DISHES = {
    "papa a la huancaina", "papas a la huancaina", "papas arrugadas", "papas arrugadas con queso"
}
PACEÑO_DEFAULTS = ["plato paceño", "chairo", "sajta", "anticuchos"]
LA_PAZ_FESTIVALS = ["Gran Poder", "Alasitas", "Aniversario 16 de julio"]

SCHEMA_GUIDE = """
Devuelve UN JSON válido y NADA MÁS (sin comentarios, sin markdown).
Esquema:
{
  "departamento": "string",
  "lugares": [
    {"nombre": "string", "descripcion": "string", "horario": "string", "costo_aprox_bs": "string"}
  ],
  "hoteles": [
    {"nombre": "string", "ubicacion": "string", "calificacion": 0}
  ],
  "gastronomia": {
    "plato_tradicional": "string",
    "extras": [
      {"nombre": "string", "costo_aprox_bs": "string"}
    ]
  },
  "historia_cultura_fiestas": {
    "aniversario": "string",
    "resumen": "string",
    "festividades": ["string"]
  },
  "dato_curioso": "string"
}
Reglas:
- Usa SOLO información del contexto provisto.
- Costos en Bolivianos (Bs.) como rango o valor (e.g., "20–35"). Si desconocido, usa "consultar en sitio".
- Si no hay dato, usa "N/D" (el render lo mejorará).
- Mantén 3–5 lugares y 3 hoteles máximo.
"""

def _extract_json_block(text: str) -> Optional[dict]:
    if not text:
        return None
    m = re.search(r"```json\s*(\{.*?\})\s*```", text, flags=re.DOTALL)
    raw = m.group(1).strip() if m else text.strip()
    try:
        return json.loads(raw)
    except Exception:
        try:
            raw2 = re.sub(r",\s*([\}\]])", r"\1", raw)
            return json.loads(raw2)
        except Exception:
            return None

def _soft_value(v: Optional[str], fallback: Optional[str] = None) -> Optional[str]:
    if not v or v.strip() in ("", "N/D", "n/d", "nd"):
        return fallback
    return v.strip()

def _sanitize_items_bullets(md: str) -> str:
    md = re.sub(r"^\s*\+\s+", "- ", md, flags=re.MULTILINE)
    md = re.sub(r"^\s*\*\s+", "- ", md, flags=re.MULTILINE)
    return md

def _ensure_h2_hr(md: str) -> str:
    lines = md.splitlines()
    out = []
    for i, line in enumerate(lines):
        out.append(line)
        if any(line.strip().startswith(h2) for h2 in REQUIRED_H2):
            if i + 1 >= len(lines) or lines[i+1].strip() != "---":
                out.append("---")
    return "\n".join(out)

def _normalize_festivities(dep_name: str, festividades: List[str]) -> List[str]:
    if not festividades:
        festividades = []
    # Si es La Paz, normaliza algunas festividades conocidas
    if dep_name and dep_name.lower().strip() == "la paz":
        base = set()
        for f in festividades:
            n = _strip_accents(f.lower().strip())
            if "vendimia" in n or "feria internacional" in n or "festival de música" in n:
                continue
            base.add(f)
        for must in LA_PAZ_FESTIVALS:
            base.add(must)
        return list(base)[:3]
    return festividades[:3]

def _normalize_gastronomy(dep_name: str, plato_tradicional: str, extras: List[Dict[str, str]]) -> Tuple[str, List[Dict[str, str]]]:
    pt = plato_tradicional or ""
    pt_norm = _normalize_dish_name(pt)
    if pt_norm in EXCLUDE_NON_BOLIVIAN_DISHES:
        pt = "Plato Paceño" if dep_name.lower().strip() == "la paz" else pt
    # Extras: eliminar platos no bolivianos
    cleaned = []
    for e in extras or []:
        n = _normalize_dish_name(e.get("nombre",""))
        if n in EXCLUDE_NON_BOLIVIAN_DISHES or n == "":
            continue
        cleaned.append(e)
    # Si no hay extras y es La Paz, sugerir 2 platos típicos
    if dep_name and dep_name.lower().strip() == "la paz" and not cleaned:
        cleaned = [
            {"nombre": "Chairo paceño", "costo_aprox_bs": "20–35"},
            {"nombre": "Sajta de pollo", "costo_aprox_bs": "25–40"},
        ]
    return pt, cleaned[:3]

def _build_markdown_from_schema(d: dict) -> str:
    dep = (d.get("departamento") or "").strip()
    lugares = d.get("lugares") or []
    hoteles = d.get("hoteles") or []
    gastro = d.get("gastronomia") or {}
    hist = d.get("historia_cultura_fiestas") or {}
    dato = _soft_value(d.get("dato_curioso"), "Dato en preparación.")

    # Normalize gastronomy
    plato_trad, extras = _normalize_gastronomy(dep or "", _soft_value(gastro.get("plato_tradicional"), None) or "", gastro.get("extras") or [])
    festividades = _normalize_festivities(dep or "", hist.get("festividades") or [])

    md = []
    # Lugares
    md.append("## 📍 **Lugares Turísticos**")
    md.append("---")
    if lugares:
        for l in lugares[:5]:
            nombre = _soft_value(l.get('nombre'), "Lugar destacado")
            descripcion = _soft_value(l.get('descripcion'), "Descripción pendiente. Pregunta y te doy más detalles.")
            md.append(f"- **{nombre}**: {descripcion}")
            horario = _soft_value(l.get("horario"), None)
            costo = _soft_value(l.get("costo_aprox_bs"), None)
            if horario: md.append(f"  - Horario: {horario}")
            md.append(f"  - Costo aprox.: Bs. {costo or 'consultar en sitio'}")
    else:
        md.append("- Información en preparación para este destino.")

    # Hoteles
    md.append("## 🏨 **Hoteles Recomendados**")
    md.append("---")
    if hoteles:
        for h in hoteles[:3]:
            nombre = _soft_value(h.get('nombre'), "Hotel recomendado")
            ubic = _soft_value(h.get('ubicacion'), "Ubicación central")
            cal = _soft_value(str(h.get('calificacion')) if h.get('calificacion') is not None else None, "4")
            md.append(f"- **{nombre}** — {ubic} (Calificación: {cal}/5)")
    else:
        md.append("- Información en preparación.")

    # Gastronomía
    md.append("## 🍽️ **Gastronomía Típica**")
    md.append("---")
    md.append(f"- Plato Tradicional: **{plato_trad or 'Plato típico'}**")
    for e in extras[:3]:
        nombre = _soft_value(e.get("nombre"), None)
        if not nombre:
            continue
        costo = _soft_value(e.get("costo_aprox_bs"), None)
        md.append(f"- {nombre} — Costo aprox.: Bs. {costo or 'consultar en sitio'}")

    # Historia/Cultura/Festividades
    md.append("## 🏛️ **Historia Breve, Cultura y Festividades**")
    md.append("---")
    aniversario = _soft_value(hist.get("aniversario"), "N/D")
    resumen = _soft_value(hist.get("resumen"), "Reseña en preparación.")
    md.append(f"- Aniversario: {aniversario}")
    md.append(f"- Reseña: {resumen}")
    if festividades:
        md.append("- Festividades:")
        for f in festividades[:3]:
            md.append(f"  - {f}")

    # Dato curioso
    md.append("## 💡 **Dato Curioso**")
    md.append("---")
    md.append(f"- {dato}")

    out = "\n".join(md).strip()
    out = _sanitize_items_bullets(out)
    out = _ensure_h2_hr(out)
    return out

def _structured_generate(prompt: str, context: str) -> Optional[str]:
    messages = [
        {"role": "system", "content": SCHEMA_GUIDE},
        {"role": "user", "content": f"Consulta: {prompt}\n\nContexto (usar estrictamente):\n{context}"}
    ]
    options = {
        "num_gpu": OLLAMA_NUM_GPU,
        "temperature": 0.2,
        "num_ctx": OLLAMA_NUM_CTX,
        "num_predict": min(OLLAMA_MAX_TOKENS, 900),
    }
    raw = _chat_generate(messages, options)
    data = _extract_json_block(raw)
    if not data:
        return None
    return _build_markdown_from_schema(data)

# --- Post HTML polish ---

def _strip_pre_and_fences(html_or_md: str) -> str:
    s = html_or_md
    s = re.sub(r"<pre[^>]*>", "", s, flags=re.IGNORECASE)
    s = re.sub(r"</pre>", "", s, flags=re.IGNORECASE)
    s = re.sub(r"```+(\w+)?", "", s)
    return s

def _final_html_polish(html: str) -> str:
    s = html
    s = _strip_pre_and_fences(s)
    # si quedó encabezado sin hr, lo insertamos
    for h2 in REQUIRED_H2:
        s = re.sub(rf"({re.escape(h2)})\s*(?!<hr>)", r"\1<hr>", s)
    # bullets: evitar <li> vacíos
    s = re.sub(r"<li>\s*</li>", "", s)
    # quitar "Bs. N/D" si quedó; reemplazar por "Bs. consultar en sitio"
    s = s.replace("Bs. N/D", "Bs. consultar en sitio")
    return s

# --- send_message principal ---

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
    logger.info("Chat %s", chat_id)

    official_data, detected_dpto = find_official_data(prompt)
    context_data = find_contextual_data(prompt, detected_dpto)
    context_for_schema = ""
    if official_data:
        context_for_schema += f"{official_data}\n"
    if context_data:
        context_for_schema += f"{context_data}\n"

    is_itinerary_request = any(w in prompt.lower() for w in ["itinerario", "plan", "ruta", "días", "diario", "dias"])

    # 1) Intento estructurado (JSON -> plantilla)
    structured_md = None
    if structured_output and not is_itinerary_request:
        try:
            structured_md = _structured_generate(prompt, context_for_schema or "N/D")
        except Exception as e:
            logger.warning(f"Estructurado falló: {e}")

    if structured_md:
        final_md = _format_guard(structured_md, False, detected_dpto, official_data, max_gastronomy_items)
    else:
        # 2) Flujo tradicional
        if is_itinerary_request and detected_dpto:
            system_content = (
                f"Hola, soy **MunayBot**, tu guía de viajes personal. Has solicitado un itinerario para **{detected_dpto}**."
                f"Mi respuesta DEBE ser un plan de 3 días (Día 1, Día 2, Día 3) con actividades de mañana y tarde, e incluir costos aproximados en Bs."
                f"Formato: amigable, elegante, con negritas, listas y emojis."
                f"Usa EXCLUSIVAMENTE la siguiente información:\n{context_data}\n{official_data}"
            )
        else:
            system_content = (
                "Eres **MunayBot**, guía turístico de Bolivia. Responde COMPLETO y PRECISO, nunca cortado."
                " Formato SIEMPRE en Markdown con encabezados, negritas, listas, emojis."
                "\n\nReglas:\n"
                "1) Prioriza INFORMACIÓN OFICIAL y CONTEXTUAL.\n"
                "2) No mezcles geografía.\n"
                "3) Incluye costos en Bs.\n"
                "4) Usa estos encabezados exactos y separadores '---' después de cada H2:\n"
                "   ## 📍 **Lugares Turísticos**\n---\n"
                "   ## 🏨 **Hoteles Recomendados**\n---\n"
                "   ## 🍽️ **Gastronomía Típica**\n---\n"
                "   ## 🏛️ **Historia Breve, Cultura y Festividades**\n---\n"
                "   ## 💡 **Dato Curioso**\n---\n"
            )
            if official_data:
                system_content += f"\nDATOS OFICIALES:\n{official_data}"
            if context_data:
                system_content += f"\nINFORMACIÓN CONTEXTUAL:\n{context_data}"

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

        raw_text = _chat_generate(messages_payload, options)
        if not raw_text:
            friendly_error = "¡Ups! 😔 Tuvimos un problema al generar la respuesta. Intenta otra vez."
            return friendly_error, [{"role": "user", "content": prompt}]

        final_md = raw_text
        try:
            final_md = _tidy_extra(final_md)
            final_md = _format_guard(final_md, is_itinerary_request, detected_dpto, official_data, max_gastronomy_items)
        except Exception as e:
            logger.warning(f"⚠️ Format guard falló: {e}")

    # 3) Render final
    if output_format == "html":
        formatted_text = render_markdown_to_html(final_md)
        formatted_text = _final_html_polish(formatted_text)
    elif output_format == "text":
        formatted_text = render_markdown_to_text(final_md)
    else:
        formatted_text = final_md

    history_item = {
        "role": "user",
        "content": prompt,
        "response_formatted": formatted_text,
        "output_format": output_format,
        "format_guard": format_guard,
        "structured_output": structured_output,
    }
    return formatted_text, [history_item]