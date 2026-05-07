FROM node:26-trixie-slim
RUN npm install -g pnpm@11.0.8
RUN mkdir /app
ADD package.json /app
ADD pnpm-lock.yaml /app
ADD pnpm-workspace.yaml /app
WORKDIR /app
RUN pnpm install --frozen-lockfile
ADD . /app
RUN pnpm run tsc
RUN rm -r /app/src
CMD ["node", "./build/index.js"]
