FROM node:20-alpine AS builder

RUN apk add --no-cache \
    python3 \
    make \
    g++

WORKDIR /app

COPY package*.json ./

RUN npm install -g npm@latest
RUN npm install
RUN npm install -g @angular/cli

COPY . .

RUN ls -la /app/angular.json || echo "ERROR: angular.json not found!"

RUN ng build --configuration production

FROM nginx:alpine

COPY --from=builder /app/dist/front/browser /usr/share/nginx/html


EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]