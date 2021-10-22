FROM node:16.9.0-alpine

RUN apk add --update --no-cache openssl

ENV HOME=/home/app

WORKDIR $HOME

COPY package.json $HOME/
COPY package-lock.json $HOME/
RUN npm i

COPY . $HOME

RUN npm run build

CMD ["npm", "start"]
