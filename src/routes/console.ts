import { type WebSocketServer, type WebSocket } from "ws";
import { getContainer, docker } from "../lib/docker";
import { getDaemonApiKey } from "../lib/auth";

interface ConsolePayload {
  action: "input";
  data: string;
}

export function handleConsoleWebSocket(wss: WebSocketServer) {
  wss.on("connection", async (socket: WebSocket, request) => {
    try {
      const url = new URL(request.url ?? "http://localhost");
      const containerId = url.searchParams.get("containerId");
      const token = url.searchParams.get("token");

      const daemonKey = getDaemonApiKey();
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

      const container = getContainer(containerId);
      const stream = await container.attach({ stream: true, stdin: true, stdout: true, stderr: true });

      stream.on("error", (error: Error) => {
        socket.send(JSON.stringify({ error: error.message }));
      });

      stream.on("end", () => {
        socket.close();
      });

      const writeOutput = (data: Buffer) => {
        if (socket.readyState === socket.OPEN) {
          socket.send(JSON.stringify({ type: "output", data: data.toString("utf8") }));
        }
      };

      docker.modem.demuxStream(stream, { write: writeOutput } as any, { write: writeOutput } as any);

      socket.on("message", (message) => {
        try {
          const payload = JSON.parse(message.toString()) as ConsolePayload;
          if (payload.action === "input") {
            stream.write(payload.data);
          }
        } catch (error) {
          console.error("Console websocket parse error", error);
        }
      });

      socket.on("close", () => {
        stream.end();
      });
    } catch (error) {
      socket.send(JSON.stringify({ error: (error as Error).message }));
      socket.close();
    }
  });
}
