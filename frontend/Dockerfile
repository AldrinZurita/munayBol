FROM node:20

WORKDIR /app

# Instala dependencias
COPY package*.json ./
RUN npm install
RUN npm install -g @angular/cli

# Copia el resto del código fuente
COPY . .

# Expone el puerto de desarrollo de Angular
EXPOSE 4200

# Comando para desarrollo con hot reload
CMD ["npm", "start"]