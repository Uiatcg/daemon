"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
dotenv_1.default.config({ path: path_1.default.join(__dirname, "..", ".env") });
const express_1 = __importDefault(require("express"));
const http_1 = require("http");
const ws_1 = require("ws");
const body_parser_1 = __importDefault(require("body-parser"));
const fs_1 = __importDefault(require("fs"));
const os_1 = __importDefault(require("os"));
const auth_1 = require("./lib/auth");
const containers_1 = require("./routes/containers");
const files_1 = require("./routes/files");
const console_1 = require("./routes/console");
const heartbeat_1 = require("./routes/heartbeat");
const registration_1 = require("./routes/registration");
const app = (0, express_1.default)();
const port = Number(process.env.DAEMON_PORT ?? 8080);
const host = process.env.DAEMON_HTTP_HOST ?? "0.0.0.0";
app.use(body_parser_1.default.json({ limit: "50mb" }));
app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", daemon: "ryzendaemon", version: "1.0.0", timestamp: new Date().toISOString() });
});
(0, heartbeat_1.setupHeartbeatRoute)(app);
(0, registration_1.setupRegistration)(app);
app.use("/api/containers", auth_1.ensureDaemonAuth);
app.use("/api/files", auth_1.ensureDaemonAuth);
(0, containers_1.setupContainerRoutes)(app);
(0, files_1.setupFileRoutes)(app);
const server = (0, http_1.createServer)(app);
const wss = new ws_1.WebSocketServer({ server, path: "/ws/console" });
(0, console_1.handleConsoleWebSocket)(wss);
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
    const panelUrl = process.env.PANEL_URL;
    const nodeId = process.env.NODE_ID;
    const nodeToken = process.env.NODE_TOKEN;
    const apiKey = process.env.DAEMON_API_KEY || "";
    const cfgDir = process.env.DAEMON_DATA_ROOT || "/var/lib/ryzenpanel";
    const cfgPath = path_1.default.join(cfgDir, "daemon.json");
    try {
        const daemonFqdn = process.env.DAEMON_FQDN || host;
        const daemonIp = process.env.DAEMON_IP || daemonFqdn;
        const res = await fetch(`${panelUrl}/api/nodes/register`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ nodeId, nodeToken, daemonKey: apiKey, fqdn: daemonFqdn, ip: daemonIp, daemonPort: port }),
        });
        if (res.ok) {
            console.log("[RYZENDAEMON] Successfully registered with panel.");
            fs_1.default.mkdirSync(cfgDir, { recursive: true });
            fs_1.default.writeFileSync(cfgPath, JSON.stringify({ panelUrl, nodeId, nodeToken, apiKey, registeredAt: new Date().toISOString() }, null, 2));
            startHeartbeatLoop(panelUrl, nodeId, nodeToken);
        }
        else {
            const data = await res.json();
            console.error(`[RYZENDAEMON] Registration failed: ${data.message || "unknown error"}`);
        }
    }
    catch (err) {
        console.error(`[RYZENDAEMON] Registration error: ${err.message}`);
        if (fs_1.default.existsSync(cfgPath)) {
            try {
                const cfg = JSON.parse(fs_1.default.readFileSync(cfgPath, "utf8"));
                if (cfg.panelUrl && cfg.nodeId && cfg.nodeToken) {
                    console.log("[RYZENDAEMON] Found existing config, attempting heartbeat...");
                    startHeartbeatLoop(cfg.panelUrl, cfg.nodeId, cfg.nodeToken);
                }
            }
            catch { }
        }
    }
}
function startHeartbeatLoop(panelUrl, nodeId, nodeToken) {
    async function sendHeartbeat() {
        try {
            const cpus = os_1.default.cpus();
            const totalMem = os_1.default.totalmem();
            const freeMem = os_1.default.freemem();
            const usedMem = totalMem - freeMem;
            const serverStates = (0, heartbeat_1.getServerStates)();
            const res = await fetch(`${panelUrl}/api/nodes/heartbeat`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    nodeId,
                    nodeToken,
                    cpu: {
                        cores: cpus.length,
                        model: cpus[0]?.model || "unknown",
                        loadPercent: Math.round((os_1.default.loadavg()[0] / cpus.length) * 100),
                    },
                    memory: {
                        total: totalMem, used: usedMem, free: freeMem,
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
                        (0, heartbeat_1.updateServerState)(s.uuid || s.id, { status: s.status, cpu: s.cpu, ram: s.ram, disk: s.disk });
                    }
                }
            }
        }
        catch (err) {
            console.error("[RYZENDAEMON] Heartbeat error:", err.message);
        }
    }
    sendHeartbeat();
    setInterval(sendHeartbeat, 10000);
}
