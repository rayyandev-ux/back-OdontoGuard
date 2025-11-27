FROM node:20-slim
WORKDIR /app
RUN apt-get update -y && apt-get install -y openssl
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci
COPY . .
ENV NODE_ENV=production
EXPOSE 4000
CMD ["node","src/server.js"]
