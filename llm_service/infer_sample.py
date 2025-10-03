import torch
from transformers import AutoTokenizer, AutoModelForCausalLM
import argparse, textwrap, os, re
from typing import List, Optional

# === Datos ligeros para auto-contexto (sin depender de build_dataset) ===
CITY_DEFAULT = 'la paz'

AUTO_HOTELES = {
    'la paz': [
        ("Hostal Sol Andino", 180, "Centro"),
        ("Residencial Altiplano", 210, "Mercado Rodríguez"),
        ("Hotel Illimani", 260, "Sopocachi"),
    ],
    'sucre': [
        ("Hostal Blanco", 190, "Centro"),
        ("Hotel Recoleta", 280, "Recoleta"),
    ],
    'cochabamba': [
        ("Hostal Tunari", 170, "Centro"),
        ("Hotel Andino", 320, "Norte"),
    ],
    'santa cruz': [
        ("Residencial Palmas", 250, "Mercado Nuevo"),
        ("Hotel Jardín", 380, "Centro"),
    ],
    'potosí': [
        ("Hostal Cerro Rico", 200, "Centro Histórico"),
        ("Posada Minera", 250, "Barrio Minero"),
        ("Hotel Casa de la Moneda", 320, "Centro"),
    ],
}

AUTO_LUGARES = {
    'la paz': ["Valle de la Luna (naturaleza)", "Teleférico Rojo (vista)", "Calle Jaén (historia)"],
    'sucre': ["Casa de la Libertad (historia)", "Convento de la Recoleta (historia)", "Parque Cretácico (paleontología)"],
    'cochabamba': ["Cristo de la Concordia (mirador)", "La Cancha (mercado)", "Plaza Colón (urbano)"],
    'santa cruz': ["Biocentro Güembé (naturaleza)", "Plaza 24 de Septiembre (historia)", "Zoológico Municipal (familia)"],
    'potosí': [
        "Mina Cerro Rico (mina)",
        "Casa de la Moneda (museo)",
        "Plaza 10 de Noviembre (historia)",
        "Mercado Central Potosí (gastronomía)",
        "Iglesia San Lorenzo (historia)",
        "Mirador Torre de la Compañía (mirador)",
    ],
}

DEF_PROMPT = "Itinerario de 1 día económico en Sucre con sitios históricos."

END_TOKEN = "<|END|>"
RESPONSE_TOKEN = "<|RESPONSE|>"

INSTR_TOKEN = "<|INSTRUCTION|>"
CONTEXT_TOKEN = "<|CONTEXT|>"

def set_seed(seed: int):
    torch.manual_seed(seed)
    if torch.cuda.is_available():
        torch.cuda.manual_seed_all(seed)

def extract_response(full_text: str, clean: bool):
    # Normalizar escapes dobles
    norm = full_text.replace('\\n', '\n')
    if not clean:
        return norm, None
    # Buscar segmento después de RESPONSE hasta END o fin
    idx_resp = norm.find(RESPONSE_TOKEN)
    if idx_resp == -1:
        return norm, None
    after = norm[idx_resp + len(RESPONSE_TOKEN):]
    # saltar posible salto de línea inicial
    after = after.lstrip('\n ')
    idx_end = after.find(END_TOKEN)
    if idx_end != -1:
        after_clean = after[:idx_end]
    else:
        after_clean = after
    # Quitar tokens especiales residuales o repetidos
    after_clean = re.sub(r'<\|INSTRUCTION\|>|<\|CONTEXT\|>|<\|RESPONSE\|>|<\|END\|>', '', after_clean)
    return norm, after_clean.strip()

# Simplified helpers
BUDGET_RE = re.compile(r'presupuesto\s*(?:de)?\s*(\d{2,4})', re.IGNORECASE)

def parse_budget_from_prompt(prompt: str) -> Optional[int]:
    m = BUDGET_RE.search(prompt)
    if not m:
        return None
    try:
        return int(m.group(1))
    except ValueError:
        return None

DAY_LINE_RE = re.compile(r'^(D[ií]a\s+\d+:)(.+)$', re.IGNORECASE)
PARENS_CLEAN_RE = re.compile(r'\s*\([^)]*\)')

BASE_PRICE_RE = re.compile(r'(\b|^)(\d{2,4})\s*BOB', re.IGNORECASE)


def diversify_itinerary(response_text: str, lugares_ciudad: List[str], min_places_per_day: int) -> str:
    if not response_text:
        return response_text
    lines = response_text.splitlines()

    def base_name(txt: str) -> str:
        return PARENS_CLEAN_RE.sub('', txt).strip().lower()

    base_map = {base_name(l): l for l in lugares_ciudad}
    used_global = set()

    for i, line in enumerate(lines):
        m = DAY_LINE_RE.match(line.strip())
        if not m:
            continue
        prefix, content = m.group(1), m.group(2).strip()
        content_norm = content.replace(' y ', ', ')
        parts = [p.strip().rstrip('.') for p in content_norm.split(',') if p.strip()]
        # Track used
        for p in parts:
            used_global.add(base_name(p))
        # Fill up
        needed = max(0, min_places_per_day - len(parts))
        if needed:
            for cand in lugares_ciudad:
                b = base_name(cand)
                if b not in used_global:
                    parts.append(base_map[b])
                    used_global.add(b)
                    needed -= 1
                    if needed == 0:
                        break
        # Ensure at least two distinct if only one repeated globally
        if len(parts) == 1:
            for cand in lugares_ciudad:
                b = base_name(cand)
                if b not in used_global:
                    parts.append(base_map[b])
                    used_global.add(b)
                    break
        lines[i] = f"{prefix} {', '.join(parts)}."
    return '\n'.join(lines)


def annotate_budget_exceed(response_text: str, budget: Optional[int]) -> str:
    if budget is None or not response_text:
        return response_text
    lines = response_text.splitlines()
    for line in lines:
        m = BASE_PRICE_RE.search(line)
        if m and int(m.group(2)) > budget:
            lines.append(f"Nota: Algunos hoteles listados superan el presupuesto objetivo (~{budget} BOB). Considera opciones más sencillas o negociar tarifas en sitio.")
            break
    return '\n'.join(lines)

def detect_city(raw_prompt: str):
    lowered = raw_prompt.lower()
    for city in AUTO_HOTELES.keys():
        if city in lowered:
            return city
    return None

def build_auto_context(city: str):
    hoteles = AUTO_HOTELES.get(city, [])
    lugares = AUTO_LUGARES.get(city, [])
    lines = ["Hoteles:"] + [f"- {h[0]} - {h[1]} BOB - {h[2]}" for h in hoteles]
    lines += ["Lugares:"] + [f"- {l}" for l in lugares]
    return "\n".join(lines)

def auto_format_prompt(user_prompt: str):
    # Si ya contiene tokens especiales, devolver tal cual
    if INSTR_TOKEN in user_prompt and CONTEXT_TOKEN in user_prompt and RESPONSE_TOKEN in user_prompt:
        return user_prompt
    city = detect_city(user_prompt) or CITY_DEFAULT
    context = build_auto_context(city)
    formatted = f"{INSTR_TOKEN}\n{user_prompt.strip()}\n{CONTEXT_TOKEN}\n{context}\n{RESPONSE_TOKEN}\n"
    return formatted

def generate(args):
    device = 'cuda' if torch.cuda.is_available() else 'cpu'
    tok = AutoTokenizer.from_pretrained(args.model_dir)
    model = AutoModelForCausalLM.from_pretrained(args.model_dir).to(device)

    gen_kwargs = {
        'max_new_tokens': args.max_new_tokens,
        'temperature': args.temperature,
        'top_p': args.top_p,
        'do_sample': not args.no_sample,
        'repetition_penalty': args.repetition_penalty,
        'pad_token_id': tok.eos_token_id,
    }
    if args.no_repeat_ngram_size and args.no_repeat_ngram_size > 0:
        gen_kwargs['no_repeat_ngram_size'] = args.no_repeat_ngram_size
    if args.no_sample:
        # Greedy ignora temp/top_p
        gen_kwargs.pop('temperature', None)
        gen_kwargs.pop('top_p', None)

    formatted_prompt = auto_format_prompt(args.prompt) if args.auto_format else args.prompt
    inputs = tok(formatted_prompt, return_tensors='pt').to(device)
    with torch.no_grad():
        out = model.generate(**inputs, **gen_kwargs)
    decoded = tok.decode(out[0], skip_special_tokens=False)
    if args.stop_at_end and END_TOKEN in decoded:
        decoded = decoded.split(END_TOKEN)[0] + END_TOKEN
    return decoded

def main():
    ap = argparse.ArgumentParser(description='Inferencia modelo turístico instruccional')
    ap.add_argument('--model-dir', default='./gptneo-llm')
    ap.add_argument('--prompt', default=DEF_PROMPT, help='Prompt en lenguaje natural (auto-formateado) o completo con tokens')
    ap.add_argument('--max-new-tokens', type=int, default=160)
    ap.add_argument('--temperature', type=float, default=0.8)
    ap.add_argument('--top-p', type=float, default=0.9)
    ap.add_argument('--repetition-penalty', type=float, default=1.05)
    ap.add_argument('--seed', type=int, default=None)
    ap.add_argument('--no-sample', action='store_true', help='Desactivar sampling (greedy)')
    ap.add_argument('--stop-at-end', action='store_true', help='Cortar al encontrar <|END|>')
    ap.add_argument('--clean-response', action='store_true', help='Mostrar solo la parte de respuesta sin tokens')
    ap.add_argument('--no-auto-format', dest='auto_format', action='store_false', help='No envolver el prompt con tokens/contexto')
    ap.add_argument('--no-repeat-ngram-size', type=int, default=0, help='Bloquea repetición de n-gramas del tamaño dado (>0 activa)')
    ap.add_argument('--diversify-days', action='store_true', help='Post-procesa para diversificar lugares por día')
    ap.add_argument('--min-places-per-day', type=int, default=2, help='Mínimo de lugares distintos por día al diversificar')
    ap.add_argument('--annotate-budget-exceed', action='store_true', help='Añade nota si hoteles exceden presupuesto detectado en prompt')
    ap.set_defaults(auto_format=True)
    args = ap.parse_args()

    print('[DEVICE] cuda?', torch.cuda.is_available())
    if args.seed is not None:
        set_seed(args.seed)
        print(f'[SEED] Fijada semilla {args.seed}')

    raw = generate(args)
    norm, cleaned = extract_response(raw, clean=args.clean_response)

    print('\n=== RESULTADO RAW ===\n')
    print(textwrap.fill(norm, width=110))
    if args.clean_response:
        print('\n=== RESPUESTA LIMPIA ===\n')
        if cleaned:
            print(textwrap.fill(cleaned, width=110))
        else:
            print('(No se pudo extraer sección de respuesta)')

if __name__ == '__main__':
    main()
