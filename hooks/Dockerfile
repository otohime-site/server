FROM node:20-bullseye-slim
RUN npm install -g pm2
RUN mkdir /app
ADD package.json /app
ADD package-lock.json /app
WORKDIR /app
RUN npm install
ADD . /app
RUN npm run tsc
CMD ["pm2-runtime", "./build/index.js", "-i", "4"]
