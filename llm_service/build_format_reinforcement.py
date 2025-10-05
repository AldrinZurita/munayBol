import json, argparse, random
from pathlib import Path

INSTR = '<|INSTRUCTION|>'
CONTEXT = '<|CONTEXT|>'
RESPONSE = '<|RESPONSE|>'
END = '<|END|>'

CITY_META = {
    'la paz': {
        'hoteles': [
            ('Hostal Sol Andino',180), ('Residencial Altiplano',210), ('Hotel Illimani',260)
        ],
        'lugares': [
            'Valle de la Luna', 'Teleférico Rojo', 'Calle Jaén', 'Mercado de las Brujas', 'Plaza Murillo',
            'Mirador Killi Killi', 'Muela del Diablo', 'Museo Nacional de Etnografía'
        ]
    },
    'sucre': {
        'hoteles': [('Hostal Blanco',190), ('Hotel Recoleta',280), ('Residencial Central',220)],
        'lugares': [
            'Casa de la Libertad', 'Convento de la Recoleta', 'Parque Cretácico', 'Museo de Arte Indígena',
            'Cementerio General', 'Iglesia San Felipe Neri', 'Plaza 25 de Mayo'
        ]
    },
    'cochabamba': {
        'hoteles': [('Hostal Tunari',170), ('Hotel Andino',320), ('Residencial Flores',210)],
        'lugares': [
            'Cristo de la Concordia', 'La Cancha', 'Plaza Colón', 'Parque de la Familia', 'Palacio Portales',
            'Laguna Alalay', 'Museo Convento Santa Teresa'
        ]
    },
    'santa cruz': {
        'hoteles': [('Residencial Palmas',250), ('Hotel Jardín',380), ('Hostal Río Verde',220)],
        'lugares': [
            'Biocentro Güembé', 'Plaza 24 de Septiembre', 'Zoológico Municipal', 'Ventura Mall',
            'Parque Lomas de Arena', 'Avenida Monseñor Rivero', 'Iglesia San Roque'
        ]
    },
    'potosí': {
        'hoteles': [('Hostal Cerro Rico',200), ('Posada Minera',250), ('Hotel Casa de la Moneda',320)],
        'lugares': [
            'Mina Cerro Rico', 'Casa de la Moneda', 'Plaza 10 de Noviembre', 'Mercado Central Potosí',
            'Iglesia San Lorenzo', 'Mirador Torre de la Compañía', 'Monasterio de Santa Teresa', 'Arco de Cobija'
        ]
    }
}

BUDGET_CHOICES = [
    ('económico', 120, 200),
    ('medio', 210, 300),
    ('alto', 310, 420),
]

DAY_COUNTS = [2,3,4,5]

FORMAT_NOTE = (
    'Sigue exactamente este formato de salida:\n'
    'Hoteles recomendados:\n'
    '- Nombre (PRECIO BOB)\n'
    'Día 1: lugar1, lugar2.\n'
    'Día 2: lugar3, lugar4. (etc hasta Día N)\n'
    'Nota: (solo si algún hotel supera presupuesto).'
)

def build_context(city: str, hoteles, lugares):
    lines = ['Hoteles:'] + [f'- {h} - {p} BOB' for h,p in hoteles]
    lines += ['Lugares:'] + [f'- {l}' for l in lugares]
    return '\n'.join(lines)


def sample_hotels(city: str, budget_label: str, low: int, high: int):
    base = CITY_META[city]['hoteles'][:]
    random.shuffle(base)
    # optionally push one out-of-range for económico to force note
    adjusted = []
    injected_over = False
    for name, base_price in base:
        price = base_price
        # Adjust price band
        if budget_label == 'económico':
            # 70% within, 30% slight exceed
            if random.random() < 0.3 and not injected_over:
                price = random.randint(high+10, high+40)
                injected_over = True
            else:
                price = random.randint(low, high)
        elif budget_label == 'medio':
            price = random.randint(low, high)
        else:
            price = random.randint(low, high)
        adjusted.append((name, price))
    return adjusted


def distribute_places(lugares, days):
    random.shuffle(lugares)
    # at least 2 per day
    per_day = [[] for _ in range(days)]
    idx = 0
    for l in lugares:
        per_day[idx % days].append(l)
        idx += 1
    # ensure min 2
    for i in range(days):
        while len(per_day[i]) < 2 and lugares:
            per_day[i].append(random.choice(lugares))
    return per_day


def build_record(city: str, budget_label: str, low: int, high: int, days: int):
    meta = CITY_META[city]
    hoteles = sample_hotels(city, budget_label, low, high)
    lugares = meta['lugares'][:]
    random.shuffle(lugares)
    max_places = min(len(lugares), days*2 + 1)
    lugares = lugares[:max_places]
    per_day = distribute_places(lugares, days)

    context = build_context(city, hoteles, lugares)
    instr = f"Refuerza el formato generando un itinerario de {days} días en {city.title()} con presupuesto {budget_label}. {FORMAT_NOTE}".strip()

    resp_lines = ['Hoteles recomendados:']
    for h,p in hoteles:
        resp_lines.append(f'- {h} ({p} BOB)')
    over = any(p > high for _,p in hoteles)
    for i, day_places in enumerate(per_day, start=1):
        resp_lines.append(f"Día {i}: {', '.join(day_places)}.")
    if over and budget_label == 'económico':
        resp_lines.append('Nota: Algunos hoteles superan ligeramente el presupuesto, busca alternativas o promociones locales.')
    formatted = f"{INSTR}\n{instr}\n{CONTEXT}\n{context}\n{RESPONSE}\n" + '\n'.join(resp_lines) + f"\n{END}"
    return {
        'instruction': instr,
        'city': city,
        'budget': budget_label,
        'days': days,
        'response': '\n'.join(resp_lines),
        'formatted': formatted
    }


def main():
    ap = argparse.ArgumentParser(description='Construir dataset de refuerzo de formato')
    ap.add_argument('--output', default='dataset_refuerzo_formato.jsonl')
    ap.add_argument('--per-city', type=int, default=24, help='Ejemplos por ciudad')
    ap.add_argument('--seed', type=int, default=42)
    args = ap.parse_args()
    random.seed(args.seed)

    records = []
    for city in CITY_META.keys():
        # Weighted distribution across days (favor 3-4)
        weights = {2:0.22,3:0.32,4:0.30,5:0.16}
        total = args.per_city
        alloc = {d:max(1,int(total*weights[d])) for d in weights}
        # fix rounding
        diff = total - sum(alloc.values())
        while diff>0:
            for d in [3,4,2,5]:
                if diff==0: break
                alloc[d]+=1; diff-=1
        for days, quota in alloc.items():
            for _ in range(quota):
                budget_label, low, high = random.choice(BUDGET_CHOICES)
                rec = build_record(city, budget_label, low, high, days)
                records.append(rec)

    random.shuffle(records)
    out = Path(args.output)
    with out.open('w', encoding='utf-8') as fw:
        for r in records:
            fw.write(json.dumps(r, ensure_ascii=False) + '\n')
    print(f'[OK] Escribidos {len(records)} ejemplos en {out}')

if __name__ == '__main__':
    main()
