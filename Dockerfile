FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production PORT=8080 DATA_DIR=/app/data
COPY package.json index.html arcade.css arcade-stack.css arcade-v2.css arcade.js ./
COPY assets ./assets
COPY shared ./shared
COPY server ./server
COPY games ./games
RUN mkdir -p /app/data && chown -R node:node /app/data
USER node
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://127.0.0.1:8080/api/scores?game=stack-panic >/dev/null || exit 1
CMD ["node", "server/index.js"]
