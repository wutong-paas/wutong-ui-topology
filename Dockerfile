FROM node:9.1.0-alpine AS builder
WORKDIR /home/weave
COPY . .
ENV NPM_CONFIG_LOGLEVEL=warn NPM_CONFIG_PROGRESS=false
RUN npm install && npm run build && ls

FROM nginx
WORKDIR /usr/share/nginx/weave
COPY --from=builder /home/weave/dist  .