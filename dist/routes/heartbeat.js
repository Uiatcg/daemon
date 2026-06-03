"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getServerStates = getServerStates;
exports.updateServerState = updateServerState;
exports.setupHeartbeatRoute = setupHeartbeatRoute;
const os_1 = __importDefault(require("os"));
let serverStates = {};
function getServerStates() {
    return serverStates;
}
function updateServerState(containerId, state) {
    serverStates[containerId] = { ...state, lastPing: new Date().toISOString() };
}
function setupHeartbeatRoute(app) {
    app.get("/api/heartbeat", (_req, res) => {
        const cpus = os_1.default.cpus();
        const totalMem = os_1.default.totalmem();
        const freeMem = os_1.default.freemem();
        res.json({
            status: "ok",
            timestamp: new Date().toISOString(),
            system: {
                hostname: os_1.default.hostname(),
                platform: os_1.default.platform(),
                arch: os_1.default.arch(),
                uptime: os_1.default.uptime(),
                loadAvg: os_1.default.loadavg(),
            },
            resources: {
                cpu: {
                    cores: cpus.length,
                    model: cpus[0]?.model || "unknown",
                    loadPercent: Math.round((os_1.default.loadavg()[0] / cpus.length) * 100),
                },
                memory: {
                    total: totalMem,
                    free: freeMem,
                    used: totalMem - freeMem,
                    percent: Math.round(((totalMem - freeMem) / totalMem) * 100),
                },
            },
            containers: Object.keys(serverStates).length,
            serverStates,
        });
    });
}
