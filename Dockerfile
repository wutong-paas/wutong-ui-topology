FROM node:6.9.0 AS builder
RUN npm install -g yarn
WORKDIR /home/weave
COPY . .
ENV NPM_CONFIG_LOGLEVEL=warn NPM_CONFIG_PROGRESS=false
RUN yarn && yarn run build

FROM nginx
WORKDIR /usr/share/nginx/weave
COPY --from=builder ./dist  .