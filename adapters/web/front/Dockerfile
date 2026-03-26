FROM node:20-alpine

RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    harfbuzz \
    ca-certificates \
    ttf-freefont \
    bash \
    python3 \
    make \
    g++

WORKDIR /app

# Copier package.json
COPY package*.json ./

# Installer les dépendances
RUN npm install -g npm@latest
RUN npm install
RUN npm install -g @angular/cli

# Copier TOUT le code (y compris angular.json)
COPY . .

# Vérifier que angular.json existe
RUN ls -la /app/angular.json || echo "ERROR: angular.json not found!"

RUN echo "=== Listing /app ===" && ls -la /app

EXPOSE 4200

CMD ["ng", "serve", "--host", "0.0.0.0"]