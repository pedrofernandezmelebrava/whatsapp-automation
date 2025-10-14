# Imagen base ligera con Node y Puppeteer completo
FROM node:20-slim

# Instalar dependencias necesarias para Chromium
RUN apt-get update && apt-get install -y \
    chromium \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcups2 \
    libxcomposite1 \
    libxrandr2 \
    libxdamage1 \
    libpango-1.0-0 \
    libcairo2 \
    libasound2 \
    libgbm-dev \
    libnss3 \
    libxss1 \
    fonts-liberation \
    libappindicator3-1 \
    libxshmfence-dev \
    libglib2.0-0 \
    libdrm2 \
    wget \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Directorio de trabajo
WORKDIR /app

# Copiamos dependencias
COPY package*.json ./

RUN npm install --omit=dev

# Copiamos el resto del código
COPY . .

# Variables de entorno necesarias
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

EXPOSE 8080

CMD ["npm", "start"]
