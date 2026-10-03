FROM node:24-slim
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build
ENV HOST=0.0.0.0 PORT=3001 DRISHTI_DB=/data/drishti.sqlite
EXPOSE 3001
VOLUME ["/data"]
CMD ["node", "dist/server.cjs"]
