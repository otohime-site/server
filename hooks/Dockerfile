FROM node:24-trixie-slim
RUN corepack enable
RUN mkdir /app
ADD package.json /app
ADD pnpm-lock.yaml /app
WORKDIR /app
RUN pnpm install --frozen-lockfile
ADD . /app
RUN pnpm run tsc
RUN rm -r /app/src
CMD ["node", "./build/index.js"]
