import csv
from pathlib import Path
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.utils.dateparse import parse_date
from core.models import Hotel

class Command(BaseCommand):
    help = "Importa o actualiza hoteles desde un CSV. Columnas requeridas: nombre,ubicacion,departamento,calificacion. Si faltan id_hotel, estado o fecha_creacion, se generan por defecto."

    def add_arguments(self, parser):
        parser.add_argument('--file', '-f', type=str, required=True, help='hoteles.json')
        parser.add_argument('--update', action='store_true', help='Si existe el id_hotel, actualizar campos en vez de saltar')
        parser.add_argument('--batch-size', type=int, default=500, help='Tamaño de lote para bulk_create')

    def handle(self, *args, **options):
        file_path = Path(options['file'])
        do_update = options['update']
        batch_size = options['batch_size']

        if not file_path.exists():
            raise CommandError(f"Archivo no encontrado: {file_path}")

        created = 0
        updated = 0
        to_create = []

        from django.db import models
        from django.utils import timezone
        with file_path.open(newline='', encoding='utf-8') as csvfile:
            reader = csv.DictReader(csvfile)
            required = ['nombre','ubicacion','departamento','calificacion']
            if reader.fieldnames is None or any(r not in reader.fieldnames for r in required):
                raise CommandError(f"CSV debe tener columnas: {', '.join(required)}")

            # Para generar id_hotel incremental si falta
            next_id = Hotel.objects.aggregate(max_id=models.Max('id_hotel'))['max_id'] or 1

            for row in reader:
                try:
                    # id_hotel: si existe en CSV, úsalo; si no, genera
                    if 'id_hotel' in reader.fieldnames and row.get('id_hotel'):
                        id_hotel = int(row['id_hotel'])
                    else:
                        id_hotel = next_id
                        next_id += 1
                    calificacion = float(row['calificacion'])
                    estado = True
                    if 'estado' in reader.fieldnames and row.get('estado'):
                        estado = row['estado'].strip().lower() in ('true','1','yes','y','t')
                    fecha_creacion = None
                    if 'fecha_creacion' in reader.fieldnames and row.get('fecha_creacion'):
                        fecha_creacion = parse_date(row['fecha_creacion'])
                    if fecha_creacion is None:
                        fecha_creacion = timezone.now().date()
                except Exception as e:
                    self.stderr.write(self.style.ERROR(f"Fila inválida (nombre={row.get('nombre')}): {e}"))
                    continue

                existing = Hotel.objects.filter(id_hotel=id_hotel).first()
                if existing:
                    if do_update:
                        changed = False
                        for field, val in [
                            ('nombre', row['nombre']),
                            ('ubicacion', row['ubicacion']),
                            ('departamento', row['departamento']),
                            ('calificacion', calificacion),
                            ('estado', estado),
                        ]:
                            if getattr(existing, field) != val:
                                setattr(existing, field, val)
                                changed = True
                        if existing.fecha_creacion != fecha_creacion:
                            existing.fecha_creacion = fecha_creacion
                            changed = True
                        if changed:
                            existing.save()
                            updated += 1
                    continue
                to_create.append(Hotel(
                    id_hotel=id_hotel,
                    nombre=row['nombre'],
                    ubicacion=row['ubicacion'],
                    departamento=row['departamento'],
                    calificacion=calificacion,
                    estado=estado,
                    fecha_creacion=fecha_creacion
                ))
                if len(to_create) >= batch_size:
                    self._bulk_insert(to_create)
                    created += len(to_create)
                    to_create.clear()
        if to_create:
            self._bulk_insert(to_create)
            created += len(to_create)

        self.stdout.write(self.style.SUCCESS(f"Import terminado: creados={created}, actualizados={updated}"))

    def _bulk_insert(self, objs):
        with transaction.atomic():
            Hotel.objects.bulk_create(objs, ignore_conflicts=True)
