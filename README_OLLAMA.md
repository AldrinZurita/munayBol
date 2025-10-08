# Opciones para usar Ollama en el equipo

Tienes dos opciones para que todo el grupo pueda usar Ollama con el backend:

## Opción A: Ollama en Windows (host)
- Cada integrante instala Ollama localmente (http://localhost:11434).
- El backend en Docker se conecta al host usando `http://host.docker.internal:11434`.
- Ventajas: usa GPU/CPU del host directamente, sin configurar un contenedor más.
- Desventajas: cada integrante debe instalar Ollama y tener el/los modelos descargados.

Uso actual (ya configurado):
1. Instalar Ollama y descargar el modelo en cada PC:
   ```powershell
   ollama pull llama3
   ```
2. Levantar servicios:
   ```powershell
   docker compose up -d
   ```

## Opción B: Ollama en Docker (recomendado para equipos)
- Se añade un servicio `ollama` al docker-compose (archivo override `docker-compose.ollama.yml`).
- El backend apunta a `http://ollama:11434` y todos usan el mismo flujo con Docker.
- Ventajas: misma configuración para todo el equipo; sin instalación de Ollama en el host.
- Desventajas: consumo de espacio (modelos dentro del volumen), performance según el host.

Cómo usar la opción B:
1. Crear la carpeta local del cache de modelos (será ignorada por Git):
   ```powershell
   New-Item -ItemType Directory .\.ollama -Force | Out-Null
   ```
2. Levantar con el override que incluye Ollama y redirige el backend:
   ```powershell
   docker compose -f docker-compose.yml -f docker-compose.ollama.yml up -d
   ```
3. Descargar el modelo dentro del contenedor Ollama (una vez):
   ```powershell
   docker compose -f docker-compose.yml -f docker-compose.ollama.yml exec ollama ollama pull llama3
   ```
4. Verificar:
   ```powershell
   Invoke-WebRequest http://localhost:11434/api/version
   ```

Notas:
- El volumen `./.ollama` guarda los modelos localmente para no volver a descargarlos.
- Si usas GPU (NVIDIA) y quieres acelerar, consulta la documentación de la imagen `ollama/ollama` para habilitar `--gpus` o extensiones del runtime.

## ¿Cuál conviene?
- Si el equipo quiere evitar instalaciones locales y tener un entorno idéntico: Opción B (Dockerizada) es más predecible.
- Si prefieren aprovechar instalaciones ya hechas en Windows y quizá GPU local de forma directa: Opción A.

Puedes alternar entre ambas sin tocar el código:
- Opción A (host): `docker compose up -d` (OLLAMA_BASE_URL=host.docker.internal).
- Opción B (Docker): `docker compose -f docker-compose.yml -f docker-compose.ollama.yml up -d` (backend -> ollama).
