FROM node:20-bookworm AS builder

WORKDIR /app

ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_WS_URL

ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_WS_URL=$NEXT_PUBLIC_WS_URL

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

RUN npm run build

FROM nginx:1.27-alpine AS runner

ENV BACKEND_HTTP_URL=https://catcat-backend.onrender.com
ENV BACKEND_WS_URL=https://catcat-backend.onrender.com/ws
ENV NGINX_ENVSUBST_FILTER="^BACKEND_"

COPY --from=builder /app/out /usr/share/nginx/html
COPY nginx.conf /etc/nginx/templates/default.conf.template

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
