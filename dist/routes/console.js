"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleConsoleWebSocket = handleConsoleWebSocket;
const docker_1 = require("../lib/docker");
const auth_1 = require("../lib/auth");
function handleConsoleWebSocket(wss) {
    wss.on("connection", async (socket, request) => {
        try {
            const url = new URL(request.url ?? "http://localhost");
            const containerId = url.searchParams.get("containerId");
            const token = url.searchParams.get("token");
            const daemonKey = (0, auth_1.getDaemonApiKey)();
            if (daemonKey && token !== daemonKey) {
                socket.send(JSON.stringify({ error: "Unauthorized console connection." }));
                socket.close();
                return;
            }
            if (!containerId) {
                socket.send(JSON.stringify({ error: "Missing containerId" }));
                socket.close();
                return;
            }
            const container = (0, docker_1.getContainer)(containerId);
            const stream = await container.attach({ stream: true, stdin: true, stdout: true, stderr: true });
            stream.on("error", (error) => {
                socket.send(JSON.stringify({ error: error.message }));
            });
            stream.on("end", () => {
                socket.close();
            });
            const writeOutput = (data) => {
                if (socket.readyState === socket.OPEN) {
                    socket.send(JSON.stringify({ type: "output", data: data.toString("utf8") }));
                }
            };
            docker_1.docker.modem.demuxStream(stream, { write: writeOutput }, { write: writeOutput });
            socket.on("message", (message) => {
                try {
                    const payload = JSON.parse(message.toString());
                    if (payload.action === "input") {
                        stream.write(payload.data);
                    }
                }
                catch (error) {
                    console.error("Console websocket parse error", error);
                }
            });
            socket.on("close", () => {
                stream.end();
            });
        }
        catch (error) {
            socket.send(JSON.stringify({ error: error.message }));
            socket.close();
        }
    });
}
