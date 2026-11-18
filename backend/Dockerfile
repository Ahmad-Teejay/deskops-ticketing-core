FROM node:22-alpine
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY tsconfig.json prisma7.config.ts ./
COPY prisma ./prisma
COPY src ./src

RUN npx prisma generate --config prisma7.config.ts

EXPOSE 8080
CMD ["npm", "run", "dev"]