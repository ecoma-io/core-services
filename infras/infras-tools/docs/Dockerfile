FROM node:24-alpine

WORKDIR /app

RUN npm init -y \
  && npm install vitepress@1.6.4 vue@3.5.25 vitepress-plugin-mermaid@2.0.17 mermaid@11.12.1

EXPOSE 3000

CMD ["npx", "vitepress", "dev","--host", "0.0.0.0", "--port", "3000"]
