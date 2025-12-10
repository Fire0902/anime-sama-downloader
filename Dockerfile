FROM ghcr.io/puppeteer/puppeteer:24.32.1

WORKDIR /app/node

USER root

RUN apt-get update && apt-get install -y ffmpeg && apt-get clean

COPY package*.json ./
RUN npm install
RUN npm install -g nodemon

COPY . .

CMD ["nodemon", "./web/back/server.js"]
