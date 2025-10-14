# Imagen base con Node + Chromium listo para Puppeteer
FROM ghcr.io/puppeteer/puppeteer:22.11.0

# Directorio de trabajo
WORKDIR /app

# Copiamos los archivos de dependencias
COPY package*.json ./

# Instalamos dependencias (sin dev)
RUN npm install --omit=dev

# Copiamos el resto del código
COPY . .

# Exponemos explícitamente el puerto 8080
EXPOSE 8080

# Comando de inicio
CMD ["npm", "start"]

