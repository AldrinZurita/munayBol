FROM node:20 AS builder
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm install

COPY . .
RUN npm run build -- --configuration production

FROM node:20-slim
WORKDIR /app

COPY --from=builder /app/dist/frontend-turismo-hoteleria/browser/ ./browser
COPY --from=builder /app/dist/frontend-turismo-hoteleria/server/ ./server
COPY --from=builder /app/node_modules/ ./node_modules
COPY --from=builder /app/package.json .

RUN npm install --only=production

EXPOSE 4200
CMD ["node", "dist/frontend-turismo-hoteleria/server/server.mjs"]
