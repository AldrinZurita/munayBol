import argparse, json, re, subprocess, sys, statistics, tempfile, os
from pathlib import Path

# Simple known places (mirrors infer_sample AUTO_LUGARES but flattened)
KNOWN_PLACES = {
    'la paz': [
        'valle de la luna', 'teleférico rojo', 'calle jaén', 'mercado de las brujas', 'plaza murillo',
        'mirador killi killi', 'muela del diablo', 'museo nacional de etnografía'
    ],
    'sucre': [
        'casa de la libertad', 'convento de la recoleta', 'parque cretácico', 'museo de arte indígena',
        'cementerio general', 'iglesia san felipe neri', 'plaza 25 de mayo'
    ],
    'cochabamba': [
        'cristo de la concordia', 'la cancha', 'plaza colón', 'parque de la familia', 'palacio portales',
        'laguna alalay', 'museo convento santa teresa'
    ],
    'santa cruz': [
        'biocentro güembé', 'plaza 24 de septiembre', 'zoológico municipal', 'ventura mall',
        'parque lomas de arena', 'avenida monseñor rivero', 'iglesia san roque'
    ],
    'potosí': [
        'mina cerro rico', 'casa de la moneda', 'plaza 10 de noviembre', 'mercado central potosí',
        'iglesia san lorenzo', 'mirador torre de la compañía', 'monasterio de santa teresa', 'arco de cobija'
    ],
}

DAY_RE = re.compile(r'^(D[ií]a)\s+(\d+):', re.IGNORECASE | re.MULTILINE)
PLACE_SPLIT_RE = re.compile(r',| y ')
PRICE_RE = re.compile(r'(\d{2,4})\s*BOB', re.IGNORECASE)
BUDGET_RE = re.compile(r'presupuesto\s*(?:de)?\s*(\d{2,4})', re.IGNORECASE)
NOTE_RE = re.compile(r'nota:.*presupuesto', re.IGNORECASE)


def run_inference(script_path: Path, prompt: str, model_dir: str, extra_args: list):
    cmd = [sys.executable, str(script_path), '--prompt', prompt, '--clean-response'] + extra_args
    try:
        out = subprocess.check_output(cmd, stderr=subprocess.STDOUT, text=True, cwd=str(script_path.parent), timeout=120)
    except subprocess.CalledProcessError as e:
        return {'error': True, 'raw': e.output}
    # Extract clean section
    if '=== RESPUESTA LIMPIA ===' in out:
        part = out.split('=== RESPUESTA LIMPIA ===',1)[1]
        cleaned = part.strip()
    else:
        cleaned = out
    return {'error': False, 'raw': out, 'clean': cleaned}


def detect_city(prompt: str):
    p = prompt.lower()
    for c in KNOWN_PLACES.keys():
        if c in p:
            return c
    return None


def parse_days(clean: str):
    matches = DAY_RE.findall(clean)
    # matches list of tuples (Dia/Día, num)
    return [int(t[1]) for t in matches]


def extract_day_blocks(clean: str):
    lines = clean.splitlines()
    current = None
    blocks = {}
    for line in lines:
        stripped = line.strip()
        # Insert newline markers if multiple Día appear in same line (split them)
        if stripped.count('Día') + stripped.count('Dia') > 1:
            # naive split on 'Día ' or 'Dia '
            temp = re.split(r'(?=D[ií]a\s+\d+:)', stripped)
            for seg in temp:
                if not seg:
                    continue
                m2 = DAY_RE.match(seg)
                if m2:
                    dnum = int(m2.group(2))
                    blocks[dnum] = seg
            current = None
            continue
        m = DAY_RE.match(stripped)
        if m:
            current = int(m.group(2))
            blocks[current] = stripped
        else:
            if current is not None and stripped:
                blocks[current] += ' ' + stripped
    return blocks


def analyze_output(prompt: str, clean: str):
    city = detect_city(prompt) or 'unknown'
    requested_days = 0
    # try to infer requested days from prompt number preceding 'día' or 'días'
    m_req = re.search(r'(\d)\s*d[ií]a', prompt.lower())
    if m_req:
        requested_days = int(m_req.group(1))
    blocks = extract_day_blocks(clean)
    original_order = list(blocks.keys())
    days_present = sorted(blocks.keys())
    coverage = (len(days_present)/requested_days) if requested_days else 0
    missing_days = []
    out_of_order = False
    if requested_days:
        missing_days = [d for d in range(1, requested_days+1) if d not in days_present]
        out_of_order = original_order != days_present
    # count places per day
    diversity_list = []
    hallucinations = 0
    total_places = 0
    city_places = set(KNOWN_PLACES.get(city, []))
    for d, text in blocks.items():
        # naive split
        parts = [p.strip().lower() for p in PLACE_SPLIT_RE.split(text.split(':',1)[-1]) if p.strip()]
        # filter short tokens
        filtered = [p for p in parts if len(p) > 3]
        unique_day = set()
        for p in filtered:
            total_places += 1
            # simplify parentheses
            base = re.sub(r'\s*\(.*?\)', '', p).strip()
            unique_day.add(base)
            if city != 'unknown' and not any(base.startswith(k) or k.startswith(base) for k in city_places):
                hallucinations += 1
        diversity_list.append(len(unique_day))
    avg_places = statistics.mean(diversity_list) if diversity_list else 0
    hallucination_rate = (hallucinations/total_places) if total_places else 0

    # budget logic
    budget_match = BUDGET_RE.search(prompt.lower())
    budget = int(budget_match.group(1)) if budget_match else None
    prices = [int(m.group(1)) for m in PRICE_RE.finditer(clean)]
    over_exists = any(p > budget for p in prices) if budget else False
    note_present = bool(NOTE_RE.search(clean)) if budget else False
    budget_ok = (not budget) or (not over_exists) or (over_exists and note_present)

    return {
        'city': city,
        'requested_days': requested_days,
        'days_present': days_present,
        'missing_days': missing_days,
        'out_of_order': out_of_order,
        'coverage': coverage,
        'avg_places_per_day': avg_places,
        'hallucination_rate': hallucination_rate,
        'budget_ok': budget_ok,
    }


def main():
    ap = argparse.ArgumentParser(description='Evaluar calidad de itinerarios')
    ap.add_argument('--model-dir', default='gptneo-llm')
    ap.add_argument('--script', default='infer_sample.py')
    ap.add_argument('--prompts-file', default=None, help='Archivo con un prompt por línea')
    ap.add_argument('--output', default='eval_results.json')
    ap.add_argument('--extra-args', nargs='*', default=['--diversify-days','--min-places-per-day','2','--no-repeat-ngram-size','3'])
    ap.add_argument('--pass-flags', type=str, default=None, help='Cadena completa de flags para pasar al script de inferencia (se tokeniza por espacios).')
    args = ap.parse_args()

    if args.pass_flags:
        # Tokenizar simple respetando espacios (no soporta comillas anidadas complejas)
        add_flags = [tok for tok in args.pass_flags.strip().split(' ') if tok]
        args.extra_args.extend(add_flags)

    if not args.prompts_file:
        # default small set
        prompts = [
            'Arma un itinerario de 4 días en La Paz destacando miradores.',
            'Plan económico de 3 días en Cochabamba con presupuesto 200 por noche destacando comida local.',
            'Itinerario de 3 días en Sucre destacando historia y cultura.',
            'Itinerario de 2 días en Potosí económico enfocando historia y minas.',
            'Itinerario de 3 días en Santa Cruz naturaleza y gastronomía.',
        ]
    else:
        with open(args.prompts_file,'r',encoding='utf-8') as f:
            prompts = [l.strip() for l in f if l.strip()]

    script_path = Path(args.script)
    results = []
    for p in prompts:
        inf = run_inference(script_path, p, args.model_dir, args.extra_args)
        if inf.get('error'):
            results.append({'prompt': p, 'error': True})
            continue
        # Extract clean part (attempt)
        clean_raw = inf['clean']
        analysis = analyze_output(p, clean_raw)
        results.append({'prompt': p, **analysis})

    # Aggregate metrics
    global_metrics = {}
    if results:
        coverages = [r['coverage'] for r in results if not r.get('error')]
        halluc_rates = [r['hallucination_rate'] for r in results if not r.get('error')]
        avg_places = [r['avg_places_per_day'] for r in results if not r.get('error')]
        global_metrics = {
            'mean_coverage': sum(coverages)/len(coverages) if coverages else 0,
            'mean_hallucination_rate': sum(halluc_rates)/len(halluc_rates) if halluc_rates else 0,
            'mean_avg_places_per_day': sum(avg_places)/len(avg_places) if avg_places else 0,
        }

    out_obj = {'results': results, 'aggregate': global_metrics}
    with open(args.output,'w',encoding='utf-8') as fw:
        json.dump(out_obj, fw, ensure_ascii=False, indent=2)
    print(json.dumps(out_obj, ensure_ascii=False, indent=2))

if __name__ == '__main__':
    main()
