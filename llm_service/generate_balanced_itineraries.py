import json, argparse, random, math
from pathlib import Path

INSTR = '<|INSTRUCTION|>'
CONTEXT = '<|CONTEXT|>'
RESPONSE = '<|RESPONSE|>'
END = '<|END|>'

CITY_PLACES = {
    'la paz': [
        'Valle de la Luna', 'Teleférico Rojo', 'Calle Jaén', 'Mercado de las Brujas', 'Plaza Murillo',
        'Mirador Killi Killi', 'Muela del Diablo', 'Museo Nacional de Etnografía'
    ],
    'sucre': [
        'Casa de la Libertad', 'Convento de la Recoleta', 'Parque Cretácico', 'Museo de Arte Indígena',
        'Cementerio General', 'Iglesia San Felipe Neri', 'Plaza 25 de Mayo'
    ],
    'cochabamba': [
        'Cristo de la Concordia', 'La Cancha', 'Plaza Colón', 'Parque de la Familia', 'Palacio Portales',
        'Laguna Alalay', 'Museo Convento Santa Teresa'
    ],
    'santa cruz': [
        'Biocentro Güembé', 'Plaza 24 de Septiembre', 'Zoológico Municipal', 'Ventura Mall',
        'Parque Lomas de Arena', 'Avenida Monseñor Rivero', 'Iglesia San Roque'
    ],
    'potosí': [
        'Mina Cerro Rico', 'Casa de la Moneda', 'Plaza 10 de Noviembre', 'Mercado Central Potosí',
        'Iglesia San Lorenzo', 'Mirador Torre de la Compañía', 'Monasterio de Santa Teresa', 'Arco de Cobija'
    ],
}

CITY_HOTELS = {
    'la paz': ['Hostal Sol Andino', 'Residencial Altiplano', 'Hotel Illimani'],
    'sucre': ['Hostal Blanco', 'Hotel Recoleta', 'Residencial Central'],
    'cochabamba': ['Hostal Tunari', 'Hotel Andino', 'Residencial Flores'],
    'santa cruz': ['Residencial Palmas', 'Hotel Jardín', 'Hostal Río Verde'],
    'potosí': ['Hostal Cerro Rico', 'Posada Minera', 'Hotel Casa de la Moneda'],
}

THEMES = [
    ('historia y cultura', lambda p: True),
    ('naturaleza y miradores', lambda p: any(k in p.lower() for k in ['valle','mirador','luna','lomas'])),
    ('gastronomía y mercados', lambda p: any(k in p.lower() for k in ['mercado','gastronom','cancha'])),
    ('aventura y panorámicas', lambda p: any(k in p.lower() for k in ['muela','mirador','teleférico'])),
    ('museos y patrimonio', lambda p: any(k in p.lower() for k in ['museo','moneda','arte'])),
]

BUDGET_BANDS = [
    ('económico', (120, 200)),
    ('medio', (210, 300)),
    ('alto', (310, 420)),
]

DAY_COUNTS = [1,2,3,4,5]

def sample_hotels(city, budget_label):
    base = CITY_HOTELS[city]
    # simple deterministic shuffle per (city,budget)
    random.shuffle(base)
    tagged = []
    for h in base:
        if budget_label == 'económico':
            price = random.randint(140, 200)
        elif budget_label == 'medio':
            price = random.randint(220, 280)
        else:
            price = random.randint(310, 390)
        tagged.append((h, price))
    return tagged

def build_context(city, hotels, places):
    lines = ["Hoteles:"] + [f"- {h} - {pr} BOB" for h,pr in hotels]
    lines += ["Lugares:"] + [f"- {p}" for p in places]
    return '\n'.join(lines)

def build_days(day_count, places):
    # Spread places; at least 2 per day if possible
    per_day = [[] for _ in range(day_count)]
    idx = 0
    for p in places:
        per_day[idx % day_count].append(p)
        idx += 1
    # Guarantee 2 per day (if total allows)
    if len(places) >= 2*day_count:
        pass
    else:
        # replicate some
        for i in range(day_count):
            while len(per_day[i]) < 2 and places:
                per_day[i].append(random.choice(places))
    return '\n'.join([f"Día {i+1}: {', '.join(per_day[i])}." for i in range(day_count)])


def build_record(city, theme_label, theme_filter, budget_label, budget_range, day_count):
    all_places = CITY_PLACES[city]
    # Filter according to theme; fallback if too few
    themed = [p for p in all_places if theme_filter(p)]
    if len(themed) < day_count*2:  # need more variety
        themed = all_places[:]
    random.shuffle(themed)
    # Limit places for brevity: up to day_count*2 + 1
    max_places = min(len(themed), day_count*2 + 1)
    selected_places = themed[:max_places]
    hotels = sample_hotels(city, budget_label)
    context = build_context(city, hotels, selected_places)

    instr = f"Itinerario de {day_count} días en {city.title()} enfocado en {theme_label} con presupuesto {budget_label}."
    response_lines = ["Hoteles recomendados:"]
    for h, pr in hotels:
        response_lines.append(f"- {h} ({pr} BOB)")
    response_lines.append(build_days(day_count, selected_places))
    # Budget note heuristic
    price_min, price_max = budget_range
    if budget_label == 'económico' and any(pr > 200 for _,pr in hotels):
        response_lines.append('Nota: Algunos hoteles superan ligeramente el rango económico, busca ofertas locales.')
    resp = '\n'.join(response_lines)

    formatted = f"{INSTR}\n{instr}\n{CONTEXT}\n{context}\n{RESPONSE}\n{resp}\n{END}"
    return {
        'instruction': instr,
        'context': context,
        'response': resp,
        'city': city,
        'theme': theme_label,
        'budget': budget_label,
        'days': day_count,
        'formatted': formatted
    }


def main():
    ap = argparse.ArgumentParser(description='Generar dataset balanceado multi-día')
    ap.add_argument('--output', default='dataset_itinerarios_balanceado.jsonl')
    ap.add_argument('--seed', type=int, default=123)
    ap.add_argument('--per-city', type=int, default=40, help='Total aproximado de ejemplos por ciudad')
    args = ap.parse_args()
    random.seed(args.seed)

    records = []
    for city in CITY_PLACES.keys():
        target = args.per_city
        # distribute by day counts
        # weight: fewer for 1 and 5 days, more for 2-3-4
        weights = {1:0.12,2:0.25,3:0.28,4:0.22,5:0.13}
        allocated = {d: max(1, math.floor(target*weights[d])) for d in DAY_COUNTS}
        # fix rounding
        diff = target - sum(allocated.values())
        while diff > 0:
            for d in [3,2,4,5,1]:
                if diff==0: break
                allocated[d]+=1; diff-=1
        for day_count in DAY_COUNTS:
            quota = allocated[day_count]
            for _ in range(quota):
                theme_label, theme_filter = random.choice(THEMES)
                budget_label, budget_range = random.choice(BUDGET_BANDS)
                rec = build_record(city, theme_label, theme_filter, budget_label, budget_range, day_count)
                records.append(rec)

    # shuffle global
    random.shuffle(records)
    out_path = Path(args.output)
    with out_path.open('w', encoding='utf-8') as fw:
        for r in records:
            fw.write(json.dumps(r, ensure_ascii=False) + '\n')
    print(f'[OK] Generados {len(records)} ejemplos en {out_path}')

if __name__ == '__main__':
    main()
