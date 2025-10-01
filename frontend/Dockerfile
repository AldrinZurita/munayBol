FROM node:20

WORKDIR /app

# Copia los archivos de dependencias primero para aprovechar el cache de Docker
COPY package*.json ./

# Instala dependencias ignorando conflictos de peer dependencies
RUN npm install --legacy-peer-deps

# Instala Angular CLI globalmente
RUN npm install -g @angular/cli

# Copia el resto del código fuente
COPY . .

EXPOSE 4200

# Comando para desarrollo con hot reload
CMD ["npm", "start"]