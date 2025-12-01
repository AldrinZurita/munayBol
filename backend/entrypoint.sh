#!/bin/bash
echo "Aplicando migraciones de la base de datos..."
python manage.py migrate --noinput
echo "Recolectando archivos estáticos..."
python manage.py collectstatic --noinput
echo "Iniciando servidor Daphne en 0.0.0.0:${PORT}..."
exec daphne -b 0.0.0.0 -p ${PORT} config.asgi:application