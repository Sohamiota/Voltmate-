FROM node:18-alpine AS build
WORKDIR /app
COPY package.json tsconfig.json ./
RUN npm install
COPY . .
RUN npm run build

FROM node:18-alpine
WORKDIR /app
COPY --from=build /app/dist ./dist
COPY package.json ./
RUN npm install --only=production
ENV NODE_ENV=production
EXPOSE 8080
CMD ["node", "dist/index.js"]

