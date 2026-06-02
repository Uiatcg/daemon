FROM node:20-alpine

WORKDIR /usr/src/daemon

COPY package.json ./
RUN npm install --production

COPY tsconfig.json ./
COPY src ./src
RUN npm run build

EXPOSE 8080

ENV DAEMON_API_KEY=change_this_secret
ENV DAEMON_PORT=8080
ENV DAEMON_FILES_ROOT=/var/lib/ryzenpanel/servers
ENV DOCKER_SOCKET_PATH=/var/run/docker.sock

CMD ["node", "dist/index.js"]
