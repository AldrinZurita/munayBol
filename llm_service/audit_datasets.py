import json, argparse, re, statistics, sys
from pathlib import Path

DAY_RE = re.compile(r'D[ií]a\s+(\d+):')
CITY_RE = re.compile(r'\b(la paz|sucre|cochabamba|santa cruz|potos[ií])\b', re.IGNORECASE)
TOKEN_SPECIAL = {'<|INSTRUCTION|>','<|CONTEXT|>','<|RESPONSE|>','<|END|>'}


def detect_city(text: str):
    m = CITY_RE.search(text.lower())
    return m.group(1).lower() if m else None


def count_days(block: str):
    return len(set(DAY_RE.findall(block)))


def analyze_file(path: Path, limit: int):
    stats = {
        'total_lines': 0,
        'with_tokens': 0,
        'cities': {},
        'day_distribution': {},
        'avg_chars': 0.0,
        'median_chars': 0.0,
        'avg_days_per_itinerary': 0.0,
        'possible_itineraries': 0,
        'missing_end_token': 0,
    }
    lengths = []
    days_list = []

    with path.open('r', encoding='utf-8') as f:
        for i, line in enumerate(f):
            if limit and i >= limit:
                break
            line=line.strip()
            if not line:
                continue
            stats['total_lines'] += 1
            try:
                obj = json.loads(line)
                # Try potential fields: formatted or raw concatenation
                if 'formatted' in obj:
                    text = obj['formatted']
                else:
                    # concatenate values heuristically
                    text = ' '.join(str(v) for v in obj.values())
            except json.JSONDecodeError:
                text = line
            for tok in TOKEN_SPECIAL:
                if tok in text:
                    stats['with_tokens'] += 1
                    break
            if '<|END|>' not in text:
                stats['missing_end_token'] += 1
            c = detect_city(text)
            if c:
                stats['cities'][c] = stats['cities'].get(c, 0) + 1
            dcount = count_days(text)
            if dcount > 0:
                stats['possible_itineraries'] += 1
                days_list.append(dcount)
                stats['day_distribution'][dcount] = stats['day_distribution'].get(dcount, 0) + 1
            lengths.append(len(text))
    if lengths:
        stats['avg_chars'] = sum(lengths)/len(lengths)
        stats['median_chars'] = statistics.median(lengths)
    if days_list:
        stats['avg_days_per_itinerary'] = sum(days_list)/len(days_list)
    return stats


def main():
    ap = argparse.ArgumentParser(description='Auditar distribución de datasets instruccionales / itinerarios')
    ap.add_argument('--files', nargs='+', required=True, help='Lista de archivos JSONL a auditar')
    ap.add_argument('--limit', type=int, default=0, help='Limitar líneas (0 = todas)')
    ap.add_argument('--output', default='audit_report.json')
    args = ap.parse_args()

    report = {}
    agg_cities = {}
    agg_day_dist = {}
    total_itin = 0
    total_lines = 0

    for fpath in args.files:
        p = Path(fpath)
        if not p.exists():
            print(f'[WARN] Archivo no encontrado: {p}', file=sys.stderr)
            continue
        stats = analyze_file(p, args.limit)
        report[fpath] = stats
        total_lines += stats['total_lines']
        for c, n in stats['cities'].items():
            agg_cities[c] = agg_cities.get(c, 0) + n
        for d, n in stats['day_distribution'].items():
            agg_day_dist[d] = agg_day_dist.get(d, 0) + n
        total_itin += stats['possible_itineraries']

    global_summary = {
        'total_lines_all': total_lines,
        'total_itineraries_all': total_itin,
        'aggregate_cities': agg_cities,
        'aggregate_day_distribution': agg_day_dist,
    }
    report['GLOBAL'] = global_summary

    with open(args.output, 'w', encoding='utf-8') as fw:
        json.dump(report, fw, ensure_ascii=False, indent=2)
    print(json.dumps(report, ensure_ascii=False, indent=2))

if __name__ == '__main__':
    main()
