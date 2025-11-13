FROM node:22-alpine
WORKDIR /app
# create package.json and install pinned dependencies in a single layer
RUN npm init -y && \
	npm install express@^5.1.0 ws@^8.18.0 chokidar@^4.0.3 express-rate-limit@^8.2.1 --no-audit --no-fund --no-optional && \
	npm cache clean --force
EXPOSE 3000
COPY index.js index.js
ENTRYPOINT [ "node" ]
CMD [ "index.js" ]
