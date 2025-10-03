# Estágio 1: Build
FROM node:18-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# Estágio 2: Produção
FROM node:18-alpine
WORKDIR /app
COPY --from=build /app/package*.json ./
RUN npm install --omit=dev
COPY --from=build /app/dist ./dist
COPY entrypoint.sh .

# Make the entrypoint script executable
RUN chmod +x ./entrypoint.sh

EXPOSE 3000

# Run the entrypoint script
ENTRYPOINT ["./entrypoint.sh"]