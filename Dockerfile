FROM node:20-slim
WORKDIR /app
# Reproducible install from the lockfile (includes the Fivetran MCP server + MCP SDK).
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY . .
ENV PORT=8080 NODE_ENV=production
EXPOSE 8080
CMD ["node", "src/server.js"]
