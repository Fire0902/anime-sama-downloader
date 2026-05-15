FROM ghcr.io/puppeteer/puppeteer:24.32.1

WORKDIR /app

USER root

RUN apt-get update && apt-get install -y ffmpeg && apt-get clean

COPY package*.json ./
RUN npm install
RUN npm install express
RUN npm install -g tsx
WORKDIR /app
COPY . .
WORKDIR /app/adapters/web/front
RUN npm install -g @angular/cli
RUN npm install
ARG BACK_URL=http://localhost:3000
RUN sed -i "s|apiUrl:.*|apiUrl: '${BACK_URL}'|" src/environments/environment.prod.ts
RUN ng build --configuration production

WORKDIR /app

EXPOSE 3000

CMD ["npx", "tsx", "watch", "/app/adapters/web/back/server.ts"]