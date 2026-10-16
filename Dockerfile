# Use Docker to build and run GameForge AI Studio Pro
# Render (or similar) will use this Dockerfile to deploy the app

FROM node:20-alpine
WORKDIR /usr/src/app
COPY package.json package-lock.json* ./
RUN npm ci --production || npm install --production
COPY . .
ENV PORT=3000
EXPOSE 3000
CMD ["node","server.mjs"]
