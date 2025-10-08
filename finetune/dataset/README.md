# Dataset para fine-tuning

Formato recomendado (tipo Alpaca): un JSONL con objetos `{instruction, input, output}`.

Ejemplo:
{
  "instruction": "Genera un itinerario de 3 días en Sucre para familia con niños",
  "input": "",
  "output": "Día 1: ... Día 2: ... Día 3: ..."
}

Sugerencias:
- Balancea por ciudad/departamento y tipo de viaje.
- Incluye ejemplos con presupuesto, preferencias, temporadas.
- Usa estilo deseado (títulos, bullets, aclaraciones). Esto ‘enseña’ al modelo tu formato.
