FROM ghcr.io/puppeteer/puppeteer:24.32.1

WORKDIR /app

USER root

RUN apt-get update && apt-get install -y ffmpeg && apt-get clean

COPY package*.json ./
RUN npm install
RUN npm install express
RUN npm install -g tsx
WORKDIR /app/web/back
COPY . .

EXPOSE 3000

CMD ["npx", "tsx", "watch", "server.ts"]