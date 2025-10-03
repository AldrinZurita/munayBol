import json, random, os, re, argparse
from pathlib import Path
from typing import List, Dict

# Semilla reproducible
random.seed(42)

# ===========================
# Datos base (AMPLIADOS con Potosí)
# ===========================
HOTELS: List[Dict] = [
    # La Paz
    {"ciudad": "La Paz", "nombre": "Hostal Sol Andino", "precio": 180, "zona": "Centro"},
    {"ciudad": "La Paz", "nombre": "Residencial Altiplano", "precio": 210, "zona": "Mercado Rodríguez"},
    {"ciudad": "La Paz", "nombre": "Hotel Illimani", "precio": 260, "zona": "Sopocachi"},
    # Sucre
    {"ciudad": "Sucre", "nombre": "Hostal Blanco", "precio": 190, "zona": "Centro"},
    {"ciudad": "Sucre", "nombre": "Hotel Recoleta", "precio": 280, "zona": "Recoleta"},
    # Cochabamba
    {"ciudad": "Cochabamba", "nombre": "Hostal Tunari", "precio": 170, "zona": "Centro"},
    {"ciudad": "Cochabamba", "nombre": "Hotel Andino", "precio": 320, "zona": "Norte"},
    # Santa Cruz
    {"ciudad": "Santa Cruz", "nombre": "Residencial Palmas", "precio": 250, "zona": "Mercado Nuevo"},
    {"ciudad": "Santa Cruz", "nombre": "Hotel Jardín", "precio": 380, "zona": "Centro"},
    # Potosí (nuevos)
    {"ciudad": "Potosí", "nombre": "Hostal Cerro Rico", "precio": 200, "zona": "Centro Histórico"},
    {"ciudad": "Potosí", "nombre": "Hotel Casa de la Moneda", "precio": 320, "zona": "Centro"},
    {"ciudad": "Potosí", "nombre": "Posada Minera", "precio": 250, "zona": "Barrio Minero"},
]

LUGARES: List[Dict] = [
    # La Paz
    {"ciudad": "La Paz", "nombre": "Valle de la Luna", "tipo": "naturaleza"},
    {"ciudad": "La Paz", "nombre": "Teleférico Rojo", "tipo": "vista"},
    # Sucre
    {"ciudad": "Sucre", "nombre": "Casa de la Libertad", "tipo": "historia"},
    # Cochabamba
    {"ciudad": "Cochabamba", "nombre": "Cristo de la Concordia", "tipo": "mirador"},
    # Santa Cruz
    {"ciudad": "Santa Cruz", "nombre": "Biocentro Güembé", "tipo": "naturaleza"},
    # Potosí nuevos (ampliados)
    {"ciudad": "Potosí", "nombre": "Mina Cerro Rico", "tipo": "mina"},
    {"ciudad": "Potosí", "nombre": "Casa de la Moneda", "tipo": "museo"},
    {"ciudad": "Potosí", "nombre": "Iglesia San Lorenzo", "tipo": "historia"},
    {"ciudad": "Potosí", "nombre": "Mirador Torre de la Compañía", "tipo": "mirador"},
    {"ciudad": "Potosí", "nombre": "Mercado Central Potosí", "tipo": "gastronomía"},
    {"ciudad": "Potosí", "nombre": "Plaza 10 de Noviembre", "tipo": "historia"},
    {"ciudad": "Potosí", "nombre": "Convento Santa Teresa", "tipo": "cultura"},
]

# Templates enriquecidos con variaciones de minas/museos e itinerarios
TEMPLATES = [
    # Con BOB
    "Recomiéndame hoteles en {ciudad} con presupuesto {presupuesto} BOB por noche.",
    "Quiero viajar a {ciudad} con {presupuesto} BOB por noche, sugiere 2 hoteles.",
    "Sugiere actividades y hospedaje en {ciudad} para {dias} días con presupuesto {presupuesto} BOB.",
    "Sugiere actividades y hospedaje en {ciudad} para {dias} días con presupuesto {presupuesto}.",
    # Sin BOB explícito
    "Plan económico de {dias} días en {ciudad} con presupuesto {presupuesto} por noche.",
    "Plan económico de {dias} días en {ciudad} con presupuesto {presupuesto} BOB.",
    # Itinerarios temáticos
    "Qué lugares turísticos puedo visitar en {ciudad} en {dias} días?",
    "Arma un itinerario de {dias} días en {ciudad} destacando minas y museos.",
    "Plan de {dias} días en {ciudad} con enfoque cultural y visitas guiadas.",
    "Itinerario económico de {dias} días en {ciudad} priorizando historia y minas.",
]

DEFAULT_OUTPUT = Path("dataset_sintetico.jsonl")

def build_context(ciudad: str) -> str:
    hoteles = [h for h in HOTELS if h["ciudad"] == ciudad]
    lugares = [l for l in LUGARES if l["ciudad"] == ciudad]
    lines = ["Hoteles:"] + [f"- {h['nombre']} - {h['precio']} BOB - {h['zona']}" for h in hoteles]
    lines += ["Lugares:"] + [f"- {l['nombre']} ({l['tipo']})" for l in lugares]
    return "\n".join(lines)

def parse_days(instruction: str) -> int:
    m = re.search(r"(\d+)\s*d[ií]as", instruction.lower())
    if m:
        try:
            return max(1, min(7, int(m.group(1))))
        except ValueError:
            return 2
    return 2

def parse_budget(instruction: str) -> int | None:
    # Aceptar con o sin 'bob'
    m = re.search(r"(\d{2,4})(?=\s*(?:bob|bs|bol|por noche|$))", instruction.lower())
    if m:
        return int(m.group(1))
    return None

def build_response(instruction: str, context: str) -> str:
    dias = parse_days(instruction)
    budget = parse_budget(instruction)
    wants_minas = any(k in instruction.lower() for k in ["mina", "minas"])
    wants_museos = any(k in instruction.lower() for k in ["museo", "museos"]) or "cultural" in instruction.lower()

    # Parse context lines
    lines = context.splitlines()
    hotel_lines = [l for l in lines if l.startswith("- ") and "BOB" in l]
    lugar_lines = [l for l in lines if l.startswith("- ") and "BOB" not in l]

    # Convert to structures
    def parse_hotel(line: str):
        # - Nombre - precio BOB - zona
        try:
            parts = [p.strip() for p in line[2:].split('-')]
            nombre = parts[0].strip()
            precio = int(parts[1].strip().split()[0])
            zona = parts[2].strip() if len(parts) > 2 else ""
            return {"nombre": nombre, "precio": precio, "zona": zona, "raw": line}
        except Exception:
            return {"nombre": line, "precio": 99999, "zona": "", "raw": line}

    def parse_lugar(line: str):
        # - Nombre (tipo)
        m = re.match(r"-\s*(.+?)\s*\((.+)\)", line)
        if m:
            return {"nombre": m.group(1), "tipo": m.group(2), "raw": line}
        return {"nombre": line, "tipo": "desconocido", "raw": line}

    hoteles = [parse_hotel(h) for h in hotel_lines]
    lugares = [parse_lugar(l) for l in lugar_lines]

    # Selección de hoteles: priorizar <= budget si existe, sino los primeros más baratos
    if budget:
        hoteles_orden = sorted(hoteles, key=lambda x: x["precio"])
        hoteles_fit = [h for h in hoteles_orden if h["precio"] <= budget]
        if not hoteles_fit:
            hoteles_sel = hoteles_orden[:2]
        else:
            hoteles_sel = hoteles_fit[:2]
    else:
        hoteles_sel = sorted(hoteles, key=lambda x: x["precio"])[:2]

    # Filtrado temático de lugares si se piden minas o museos
    lugares_filtrados = lugares
    if wants_minas:
        minas = [l for l in lugares if 'mina' in l['tipo'] or 'Mina' in l['nombre']]
        if minas:
            lugares_filtrados = minas + [l for l in lugares if l not in minas]
    if wants_museos:
        museos = [l for l in lugares if 'museo' in l['tipo'] or 'Moneda' in l['nombre'].lower()]
        if museos:
            # Reordenar poniendo museos adelante sin duplicar
            nf = []
            for m in museos:
                if m not in nf:
                    nf.append(m)
            for l in lugares_filtrados:
                if l not in nf:
                    nf.append(l)
            lugares_filtrados = nf

    # Selección de lugares para cada día (2 por día como aprox.)
    # Si no hay suficientes, se reutilizan en modo circular para cubrir todos los días.
    lugares_por_dia = []
    if lugares_filtrados:
        for d in range(dias):
            base_idx = (d * 2) % len(lugares_filtrados)
            slice_l = [lugares_filtrados[base_idx]]
            if len(lugares_filtrados) > 1:
                slice_l.append(lugares_filtrados[(base_idx + 1) % len(lugares_filtrados)])
            lugares_por_dia.append(slice_l)

    parts = []
    if hoteles_sel:
        parts.append("Hoteles recomendados:\n" + "\n".join(f"- {h['nombre']} ({h['precio']} BOB - {h['zona']})" for h in hoteles_sel))
        if budget and any(h['precio'] > budget for h in hoteles_sel):
            parts.append("Nota: algún hotel excede ligeramente el presupuesto, se listan por disponibilidad.")

    if lugares_por_dia:
        for i, lst in enumerate(lugares_por_dia, start=1):
            info = ", ".join(l['nombre'] for l in lst)
            parts.append(f"Día {i}: {info}.")
    else:
        if lugares_filtrados:
            parts.append("Lugares sugeridos: " + ", ".join(l['nombre'] for l in lugares_filtrados[:3]))

    # Consejo genérico
    if wants_minas:
        parts.append("Consejo: Lleva abrigo y casco se recomienda en visitas a minas guiadas.")
    if wants_museos:
        parts.append("Considera comprar entradas con anticipación para museos concurridos.")

    if not parts:
        return "Sin datos suficientes."
    return "\n".join(parts)

def main():
    parser = argparse.ArgumentParser(description="Generar dataset sintético turístico")
    parser.add_argument('--n', type=int, default=250, help='Número de ejemplos a generar')
    parser.add_argument('--output', type=str, default=str(DEFAULT_OUTPUT), help='Archivo de salida JSONL')
    args = parser.parse_args()

    out_path = Path(args.output)
    ciudades = sorted({h['ciudad'] for h in HOTELS})
    with out_path.open('w', encoding='utf-8') as f:
        for _ in range(args.n):
            ciudad = random.choice(ciudades)
            presupuesto = random.choice([180, 200, 220, 250, 280, 300, 320, 350, 400])
            dias = random.choice([2, 3, 4])
            template = random.choice(TEMPLATES)
            instruction = template.format(ciudad=ciudad, presupuesto=presupuesto, dias=dias)
            context = build_context(ciudad)
            response = build_response(instruction, context)
            record = {"instruction": instruction, "context": context, "response": response}
            f.write(json.dumps(record, ensure_ascii=False) + "\n")
    print(f"Generado {args.n} ejemplos en {out_path}")

if __name__ == "__main__":
    main()
