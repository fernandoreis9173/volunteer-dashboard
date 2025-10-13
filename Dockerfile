# --- ETAPA 1: BUILD ---
# Usa a versão mais estável do Node para o build (melhor que a imagem base padrão)
FROM node:20-slim AS builder

# Define o diretório de trabalho dentro do container
WORKDIR /app

# Copia os arquivos de dependência primeiro para aproveitar o cache do Docker
# Isso evita reinstalar dependências se apenas o código mudar
COPY package.json package-lock.json ./

# Instala todas as dependências (dev e produção)
RUN npm install

# Copia o restante do código fonte para o WORKDIR
COPY . .

# Comando de build do Vite.
# As variáveis VITE_... são passadas como build-args na linha de comando do Docker (o EasyPanel já faz isso).
# Passar variáveis durante o build é a maneira correta para projetos front-end.
RUN npm run build

# --- ETAPA 2: PRODUÇÃO (SERVIR ARQUIVOS ESTÁTICOS) ---
# Usa uma imagem leve para servir os arquivos estáticos (melhor para produção)
FROM nginx:alpine

# Remove o arquivo de configuração padrão do Nginx
RUN rm /etc/nginx/conf.d/default.conf

# Copia o arquivo de configuração personalizado do Nginx (se você tiver um)
# Se não tiver, crie um simples (veja abaixo)
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copia os arquivos de build (saída do Vite, que é 'dist') para o diretório de serviço do Nginx
COPY --from=builder /app/dist /usr/share/nginx/html

# A porta padrão do Nginx é 80
EXPOSE 3000

# Comando para iniciar o Nginx
CMD ["nginx", "-g", "daemon off;"]
