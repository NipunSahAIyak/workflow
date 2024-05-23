FROM ubuntu:20.04

RUN apt update && apt install -y build-essential curl wget jq
RUN apt-get update && \
    apt-get upgrade -y && \
    apt-get install -y git
RUN curl -fsSL https://deb.nodesource.com/setup_14.x | bash -
RUN apt-get install -y nodejs
RUN npm i -g pnpm@7 
RUN npm i -g pm2
WORKDIR /app
COPY enketo-core enketo-core
COPY enketo-express enketo-express
WORKDIR enketo-express
# TODO: builds can be made faster if we only copy files needed to do pnpm i. pnpm i will be cached or explore multistage builds
RUN pnpm i 
EXPOSE 8065
RUN chmod +x start.sh
ENTRYPOINT ["./start.sh"]