FROM node:24-bookworm-slim
WORKDIR /app
COPY --chown=node:node package.json server.mjs index.html styles.css content.js app.js ./
RUN mkdir /app/data && chown node:node /app/data
USER node
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3000 DATA_DIR=/app/data
EXPOSE 3000
CMD ["node", "server.mjs"]
