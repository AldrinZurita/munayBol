import json, argparse, random, re, sys
from pathlib import Path

INSTR = '<|INSTRUCTION|>'
CONTEXT = '<|CONTEXT|>'
RESPONSE = '<|RESPONSE|>'
END = '<|END|>'

# Heurísticas posibles de claves
CAND_QUESTION_KEYS = ['question','pregunta','q','consulta','titulo','prompt']
CAND_ANSWER_KEYS = ['answer','respuesta','a','contenido','texto','completion']

CLEAN_HTML_RE = re.compile(r'<[^>]+>')
MULTISPACE_RE = re.compile(r'\s+')

def detect_key(d: dict, candidates):
    for k in candidates:
        if k in d and isinstance(d[k], str) and d[k].strip():
            return k
    return None

def clean_text(s: str) -> str:
    s = CLEAN_HTML_RE.sub(' ', s)
    s = s.replace('\u00a0',' ')
    s = MULTISPACE_RE.sub(' ', s).strip()
    return s

def convert_line(obj: dict, q_key: str, a_key: str, default_context: str):
    q = clean_text(obj.get(q_key,''))
    a = clean_text(obj.get(a_key,''))
    if not q or not a:
        return None
    block = f"{INSTR}\n{q}\n{CONTEXT}\n{default_context}\n{RESPONSE}\n{a}\n{END}"
    return {'instruction': q, 'context': default_context, 'response': a, 'formatted': block}

def main():
    ap = argparse.ArgumentParser(description='Convertir FAQ JSONL a dataset instruccional')
    ap.add_argument('--input', default='datos_turismo.jsonl')
    ap.add_argument('--output', default='dataset_faq_instruccional.jsonl')
    ap.add_argument('--limit', type=int, default=1000)
    ap.add_argument('--shuffle', action='store_true')
    ap.add_argument('--seed', type=int, default=42)
    ap.add_argument('--default-context', default='Sin contexto adicional')
    args = ap.parse_args()

    in_path = Path(args.input)
    if not in_path.exists():
        print(f'[ERROR] No existe archivo: {in_path}', file=sys.stderr)
        sys.exit(1)

    records = []
    with in_path.open('r', encoding='utf-8') as f:
        for line in f:
            line=line.strip()
            if not line:
                continue
            try:
                obj = json.loads(line)
            except json.JSONDecodeError:
                continue
            records.append(obj)

    if not records:
        print('[WARN] Sin registros parseados')
        return

    # Detectar claves usando primer objeto válido
    sample = None
    for r in records:
        qk = detect_key(r, CAND_QUESTION_KEYS)
        ak = detect_key(r, CAND_ANSWER_KEYS)
        if qk and ak:
            sample = (qk, ak)
            break
    if not sample:
        print('[ERROR] No se detectaron claves pregunta/respuesta')
        sys.exit(2)
    q_key, a_key = sample
    print(f'[INFO] Detectadas claves -> pregunta: {q_key} | respuesta: {a_key}')

    converted = []
    for r in records:
        item = convert_line(r, q_key, a_key, args.default_context)
        if item:
            converted.append(item)
    if args.shuffle:
        random.seed(args.seed)
        random.shuffle(converted)
    if args.limit and args.limit > 0:
        converted = converted[:args.limit]

    out_path = Path(args.output)
    with out_path.open('w', encoding='utf-8') as fw:
        for c in converted:
            fw.write(json.dumps(c, ensure_ascii=False) + '\n')
    print(f'[OK] Escribidos {len(converted)} ejemplos en {out_path}')

if __name__ == '__main__':
    main()
