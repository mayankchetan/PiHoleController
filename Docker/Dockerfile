FROM node:18-alpine

WORKDIR /app

COPY Backend/package.json ./
RUN npm install --production

COPY Backend/server.js ./

# Copy frontend files to serve statically (optional if using nginx, but good for standalone)
COPY Frontend ./public

EXPOSE 3000

CMD ["node", "server.js"]
