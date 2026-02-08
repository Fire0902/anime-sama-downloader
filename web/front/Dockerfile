FROM node:20-alpine

# Installer les dépendances système pour Puppeteer et la compilation de packages natifs
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

# Définir le répertoire de travail
WORKDIR /app

# Copier seulement package.json et package-lock.json
COPY package*.json ./

# Installer les dépendances (avant de copier le code complet)
RUN npm install

# Installer Angular CLI globalement
RUN npm install -g @angular/cli

# Copier le reste du code
COPY . .

# Exposer le port Angular
EXPOSE 4200

# Commande par défaut (override possible par docker-compose)
CMD ["ng", "serve", "--host", "0.0.0.0", "--poll", "2000"]
