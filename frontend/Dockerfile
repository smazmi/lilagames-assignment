FROM oven/bun:1.2.9-alpine AS build

WORKDIR /app

ARG VITE_NAKAMA_HOST
ARG VITE_NAKAMA_PORT
ARG VITE_NAKAMA_KEY
ARG VITE_NAKAMA_SSL

ENV VITE_NAKAMA_HOST=${VITE_NAKAMA_HOST}
ENV VITE_NAKAMA_PORT=${VITE_NAKAMA_PORT}
ENV VITE_NAKAMA_KEY=${VITE_NAKAMA_KEY}
ENV VITE_NAKAMA_SSL=${VITE_NAKAMA_SSL}

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

COPY . .
RUN bun run build

FROM nginx:1.27-alpine

COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
