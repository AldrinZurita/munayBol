FROM ollama/ollama:latest
# Usamos un entrypoint simple para asegurar la disponibilidad de la shell.

# Instalación de herramientas (curl, gnupg, etc.)
RUN apt-get update --allow-insecure-repositories && \
    apt-get install -y --no-install-recommends --allow-unauthenticated \
        curl \
        ca-certificates \
        gnupg \
        dos2unix && \
    rm -rf /var/lib/apt/lists/*

# Copia y permisos del entrypoint.
COPY entrypoint.sh /entrypoint.sh
RUN dos2unix /entrypoint.sh && chmod +x /entrypoint.sh

# El ENTRYPOINT ejecuta el script de inicio
ENTRYPOINT ["/bin/bash", "/entrypoint.sh"]