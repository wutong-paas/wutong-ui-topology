FROM node:4.2.2 AS builder
WORKDIR /home/weave
COPY . .
ENV NPM_CONFIG_LOGLEVEL=warn NPM_CONFIG_PROGRESS=false
RUN npm install && npm run build

FROM nginx
WORKDIR /usr/share/nginx/weave
COPY --from=builder ./dist  .