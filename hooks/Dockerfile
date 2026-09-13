FROM node:26-trixie-slim
RUN npm install -g pnpm@12.4.1
RUN mkdir /app
COPY package.json /app
COPY pnpm-lock.yaml /app
COPY pnpm-workspace.yaml /app
WORKDIR /app
RUN pnpm install --frozen-lockfile
COPY tsconfig.json /app
COPY src /app/src
RUN pnpm run tsc
CMD ["node", "./src/index.ts"]
