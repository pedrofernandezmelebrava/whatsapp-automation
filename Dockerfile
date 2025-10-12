# Imagen base de Node con Chrome preinstalado
FROM ghcr.io/puppeteer/puppeteer:22.11.0

# Establecer directorio de trabajo
WORKDIR /app

# Copiar package.json y package-lock.json
COPY package*.json ./

# Instalar dependencias de Node
RUN npm install --omit=dev

# Copiar el resto del código
COPY . .

# Exponer el puerto que Railway usa
EXPOSE 8080

# Iniciar la app
CMD ["npm", "start"]
