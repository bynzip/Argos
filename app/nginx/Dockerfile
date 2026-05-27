FROM node:22-alpine AS frontend-build

WORKDIR /frontend

ARG VITE_API_URL=""
ENV VITE_API_URL=$VITE_API_URL

COPY frontend/package*.json ./
RUN npm ci

COPY frontend/ ./
RUN npm run build

FROM nginx:1.27-alpine

COPY app/nginx/argos.conf /etc/nginx/conf.d/default.conf
COPY --from=frontend-build /frontend/dist/ /usr/share/nginx/html/

EXPOSE 80
