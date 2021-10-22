FROM node:16.9.0-slim

RUN apt update && \
    apt install libssl-dev -y

ENV HOME=/home/app

WORKDIR $HOME

COPY package.json $HOME/
COPY package-lock.json $HOME/
RUN npm ci

COPY . $HOME

RUN npm run build

CMD ["npm", "start"]
