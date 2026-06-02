import express, { type Request, type Response } from "express";
import { createServer } from "http";
import { WebSocketServer } from "ws";
import bodyParser from "body-parser";
import path from "path";
import fs from "fs";
import os from "os";
import { ensureDaemonAuth } from "./lib/auth";
import { setupContainerRoutes } from "./routes/containers";
import { setupFileRoutes } from "./routes/files";
import { handleConsoleWebSocket } from "./routes/console";
import { setupHeartbeatRoute, getServerStates, updateServerState } from "./routes/heartbeat";
import { setupRegistration } from "./routes/registration";

const app = express();
const port = Number(process.env.DAEMON_PORT ?? 8080);
const host = process.env.DAEMON_HTTP_HOST ?? "0.0.0.0";

app.use(bodyParser.json({ limit: "50mb" }));

app.get("/api/health", (_req: Request, res: Response) => {
  res.json({ status: "ok", daemon: "ryzendaemon", version: "1.0.0", timestamp: new Date().toISOString() });
});

setupHeartbeatRoute(app);
setupRegistration(app);

app.use("/api/containers", ensureDaemonAuth);
app.use("/api/files", ensureDaemonAuth);

setupContainerRoutes(app);
setupFileRoutes(app);

const server = createServer(app);

const wss = new WebSocketServer({ server, path: "/ws/console" });
handleConsoleWebSocket(wss);

server.listen(port, host, () => {
  console.log(`[RYZENDAEMON] Listening on http://${host}:${port}`);
  console.log(`[RYZENDAEMON] Docker socket: ${process.env.DOCKER_SOCKET_PATH || "/var/run/docker.sock"}`);
  console.log(`[RYZENDAEMON] Data root: ${process.env.DAEMON_DATA_ROOT || "/var/lib/ryzenpanel"}`);

  if (process.env.PANEL_URL && process.env.NODE_ID && process.env.NODE_TOKEN) {
    console.log(`[RYZENDAEMON] Auto-registering with panel...`);
    registerWithPanel();
  }
});

async function registerWithPanel() {
  const panelUrl = process.env.PANEL_URL!;
  const nodeId = process.env.NODE_ID!;
  const nodeToken = process.env.NODE_TOKEN!;
  const apiKey = process.env.DAEMON_API_KEY || "";

  const cfgDir = process.env.DAEMON_DATA_ROOT || "/var/lib/ryzenpanel";
  const cfgPath = path.join(cfgDir, "daemon.json");

  try {
    const daemonFqdn = process.env.DAEMON_FQDN || host;
    const res = await fetch(`${panelUrl}/api/nodes/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nodeId, nodeToken, daemonKey: apiKey, fqdn: daemonFqdn, daemonPort: port }),
    });

    if (res.ok) {
      console.log("[RYZENDAEMON] Successfully registered with panel.");
      fs.mkdirSync(cfgDir, { recursive: true });
      fs.writeFileSync(cfgPath, JSON.stringify({ panelUrl, nodeId, nodeToken, apiKey, registeredAt: new Date().toISOString() }, null, 2));

      startHeartbeatLoop(panelUrl, nodeId, nodeToken);
    } else {
      const data = await res.json();
      console.error(`[RYZENDAEMON] Registration failed: ${data.message || "unknown error"}`);
    }
  } catch (err) {
    console.error(`[RYZENDAEMON] Registration error: ${(err as Error).message}`);

    if (fs.existsSync(cfgPath)) {
      try {
        const cfg = JSON.parse(fs.readFileSync(cfgPath, "utf8"));
        if (cfg.panelUrl && cfg.nodeId && cfg.nodeToken) {
          console.log("[RYZENDAEMON] Found existing config, attempting heartbeat...");
          startHeartbeatLoop(cfg.panelUrl, cfg.nodeId, cfg.nodeToken);
        }
      } catch { }
    }
  }
}

function startHeartbeatLoop(panelUrl: string, nodeId: string, nodeToken: string) {
  async function sendHeartbeat() {
    try {
      const cpus = os.cpus();
      const totalMem = os.totalmem();
      const freeMem = os.freemem();
      const usedMem = totalMem - freeMem;

      const serverStates = getServerStates();

      const res = await fetch(`${panelUrl}/api/nodes/heartbeat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nodeId,
          nodeToken,
          cpu: {
            cores: cpus.length,
            model: cpus[0]?.model || "unknown",
            loadPercent: Math.round((os.loadavg()[0] / cpus.length) * 100),
          },
          memory: {
            total: totalMem,
            used: usedMem,
            free: freeMem,
            percent: Math.round((usedMem / totalMem) * 100),
          },
          disk: { total: 0, used: 0 },
          network: { rx: 0, tx: 0 },
          containers: Object.keys(serverStates).length,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.servers) {
          for (const s of data.servers) {
            updateServerState(s.uuid || s.id, { status: s.status, cpu: s.cpu, ram: s.ram, disk: s.disk });
          }
        }
      }
    } catch (err) {
      console.error("[RYZENDAEMON] Heartbeat error:", (err as Error).message);
    }
  }

  sendHeartbeat();
  setInterval(sendHeartbeat, 10000);
}