FROM node:20
WORKDIR /app
COPY package*.json ./
RUN npm install --legacy-peer-deps
RUN npm install -g @angular/cli
COPY . .
EXPOSE 4200
CMD ["npm", "start"]
