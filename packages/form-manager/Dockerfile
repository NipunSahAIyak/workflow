FROM nikolaik/python-nodejs:python3.10-nodejs18 As development
RUN apt update && apt install build-essential
WORKDIR /usr/src/app
RUN npm i -g pnpm
COPY package*.json ./
COPY pnpm-lock.yaml ./
RUN pnpm i

FROM nikolaik/python-nodejs:python3.10-nodejs18 As build
RUN npm i -g pnpm
WORKDIR /usr/src/app
COPY package*.json ./
COPY --from=development /usr/src/app/node_modules ./node_modules
COPY . .
RUN npm run build
ENV NODE_ENV production
RUN pnpm i -P && pnpm store prune
USER node

FROM node:18-alpine As production
COPY --chown=node:node --from=build /usr/src/app/node_modules ./node_modules
COPY --chown=node:node --from=build /usr/src/app/dist ./dist
EXPOSE 3006
CMD [ "node", "dist/main.js" ]