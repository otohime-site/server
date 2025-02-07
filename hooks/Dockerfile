FROM node:22-bookworm-slim
RUN mkdir /app
ADD package.json /app
ADD package-lock.json /app
WORKDIR /app
RUN npm ci
ADD . /app
RUN npm run tsc
RUN rm -r /app/src
CMD ["node", "./build/index.js"]
