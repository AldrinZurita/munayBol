import json, random, os
from pathlib import Path

# Configuración básica
HOTELS = [
    {"ciudad": "La Paz", "nombre": "Hostal Sol Andino", "precio": 180, "zona": "Centro"},
    {"ciudad": "La Paz", "nombre": "Residencial Altiplano", "precio": 210, "zona": "Mercado Rodríguez"},
    {"ciudad": "La Paz", "nombre": "Hotel Illimani", "precio": 260, "zona": "Sopocachi"},
    {"ciudad": "Sucre", "nombre": "Hostal Blanco", "precio": 190, "zona": "Centro"},
    {"ciudad": "Sucre", "nombre": "Hotel Recoleta", "precio": 280, "zona": "Recoleta"},
    {"ciudad": "Cochabamba", "nombre": "Hostal Tunari", "precio": 170, "zona": "Centro"},
    {"ciudad": "Cochabamba", "nombre": "Hotel Andino", "precio": 320, "zona": "Norte"},
    {"ciudad": "Santa Cruz", "nombre": "Residencial Palmas", "precio": 250, "zona": "Mercado Nuevo"},
    {"ciudad": "Santa Cruz", "nombre": "Hotel Jardín", "precio": 380, "zona": "Centro"},
]

LUGARES = [
    {"ciudad": "La Paz", "nombre": "Valle de la Luna", "tipo": "naturaleza"},
    {"ciudad": "La Paz", "nombre": "Teleférico Rojo", "tipo": "vista"},
    {"ciudad": "Sucre", "nombre": "Casa de la Libertad", "tipo": "historia"},
    {"ciudad": "Cochabamba", "nombre": "Cristo de la Concordia", "tipo": "mirador"},
    {"ciudad": "Santa Cruz", "nombre": "Biocentro Güembé", "tipo": "naturaleza"},
]

TEMPLATES = [
    "Recomiéndame hoteles en {ciudad} con presupuesto {presupuesto} BOB por noche.",
    "Quiero viajar a {ciudad} con {presupuesto} BOB por noche, sugiere 2 hoteles.",
    "Sugiere actividades y hospedaje en {ciudad} para {dias} días con presupuesto {presupuesto}.",
    "Qué lugares turísticos puedo visitar en {ciudad} en {dias} días?",
]

OUTPUT = Path("dataset_sintetico.jsonl")
random.seed(42)

def build_context(ciudad: str):
    hoteles = [h for h in HOTELS if h["ciudad"] == ciudad]
    lugares = [l for l in LUGARES if l["ciudad"] == ciudad]
    lines = ["Hoteles:"] + [f"- {h['nombre']} - {h['precio']} BOB - {h['zona']}" for h in hoteles]
    lines += ["Lugares:"] + [f"- {l['nombre']} ({l['tipo']})" for l in lugares]
    return "\n".join(lines)

def build_response(instruction: str, context: str):
    # Respuesta simplificada inicial; se puede enriquecer luego.
    hoteles = [line for line in context.splitlines() if line.startswith("- ") and "BOB" in line]
    recomendados = hoteles[:2]
    lugares = [line for line in context.splitlines() if line.startswith("- ") and "BOB" not in line]
    lugares_sel = lugares[:2]
    parts = []
    if recomendados:
        parts.append("Hoteles recomendados:\n" + "\n".join(recomendados))
    if lugares_sel:
        parts.append("Lugares sugeridos:\n" + "\n".join(lugares_sel))
    return "\n\n".join(parts)

def main(n=50):
    ciudades = sorted({h['ciudad'] for h in HOTELS})
    with OUTPUT.open('w', encoding='utf-8') as f:
        for _ in range(n):
            ciudad = random.choice(ciudades)
            presupuesto = random.choice([180, 200, 250, 300, 350, 400])
            dias = random.choice([2, 3, 4])
            template = random.choice(TEMPLATES)
            instruction = template.format(ciudad=ciudad, presupuesto=presupuesto, dias=dias)
            context = build_context(ciudad)
            response = build_response(instruction, context)
            record = {"instruction": instruction, "context": context, "response": response}
            f.write(json.dumps(record, ensure_ascii=False) + "\n")
    print(f"Generado {n} ejemplos en {OUTPUT}")

if __name__ == "__main__":
    main()
