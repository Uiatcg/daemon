"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.setupRegistration = setupRegistration;
const express_1 = require("express");
const docker_1 = require("../lib/docker");
const auth_1 = require("../lib/auth");
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const dataRoot = process.env.DAEMON_DATA_ROOT || "/var/lib/ryzenpanel";
function setupRegistration(app) {
    const serverRouter = (0, express_1.Router)();
    serverRouter.use(auth_1.ensureDaemonAuth);
    app.post("/api/register", (req, res) => {
        const { nodeId, nodeToken, apiKey } = req.body;
        if (!nodeId || !nodeToken || !apiKey) {
            return res.status(400).json({ message: "nodeId, nodeToken, and apiKey required" });
        }
        process.env.NODE_ID = nodeId;
        process.env.NODE_TOKEN = nodeToken;
        process.env.DAEMON_API_KEY = apiKey;
        const cfgDir = dataRoot;
        const cfgPath = path_1.default.join(cfgDir, "daemon.json");
        fs_1.default.mkdirSync(cfgDir, { recursive: true });
        fs_1.default.writeFileSync(cfgPath, JSON.stringify({
            nodeId,
            nodeToken,
            apiKey,
            panelUrl: req.body.panelUrl || process.env.PANEL_URL || "",
            registeredAt: new Date().toISOString(),
        }, null, 2));
        return res.json({ success: true, message: "Daemon configured successfully" });
    });
    serverRouter.post("/api/servers/create", async (req, res) => {
        try {
            const { serverId, serverUuid, name, image, ram, cpu, disk, portBindings, env, startupCommand } = req.body;
            if (!serverUuid || !image) {
                return res.status(400).json({ message: "serverUuid and image required" });
            }
            const serverDir = path_1.default.join(dataRoot, "servers", serverUuid);
            fs_1.default.mkdirSync(serverDir, { recursive: true });
            const envVars = [...(env || [])];
            const portConfig = {};
            const exposedPorts = {};
            if (portBindings) {
                for (const binding of portBindings) {
                    const key = `${binding.container}/${binding.protocol || "tcp"}`;
                    exposedPorts[key] = {};
                    portConfig[key] = [{ HostPort: String(binding.host) }];
                }
            }
            const isMinecraft = image.includes("itzg/minecraft-server");
            const dataDir = isMinecraft ? "/data" : "/home/container";
            const container = await (0, docker_1.createContainer)({
                name: `ryzen_${serverUuid.slice(0, 12)}`,
                Image: image,
                Cmd: startupCommand ? ["/bin/sh", "-c", startupCommand] : undefined,
                Env: envVars,
                ExposedPorts: Object.keys(exposedPorts).length > 0 ? exposedPorts : undefined,
                HostConfig: {
                    Binds: [`${serverDir}:${dataDir}`],
                    PortBindings: Object.keys(portConfig).length > 0 ? portConfig : undefined,
                    Memory: (ram || 1024) * 1024 * 1024,
                    NanoCPUs: (cpu || 100) * 10000000,
                    Privileged: false,
                },
                WorkingDir: dataDir,
            });
            await container.start();
            return res.status(201).json({
                success: true,
                containerId: container.id,
                serverUuid,
            });
        }
        catch (error) {
            return res.status(500).json({ message: error.message });
        }
    });
    serverRouter.post("/api/servers/:id/power", async (req, res) => {
        try {
            const { action } = req.body;
            const containerId = req.params.id;
            if (!containerId || !action) {
                return res.status(400).json({ message: "containerId and action required" });
            }
            const container = (0, docker_1.getContainer)(containerId);
            switch (action) {
                case "start":
                    await container.start();
                    break;
                case "stop":
                    await container.stop();
                    break;
                case "restart":
                    await container.restart();
                    break;
                case "kill":
                    await container.kill();
                    break;
                default:
                    return res.status(400).json({ message: `Unknown action: ${action}` });
            }
            return res.json({ success: true, action });
        }
        catch (error) {
            return res.status(500).json({ message: error.message });
        }
    });
    serverRouter.post("/api/servers/:id/reinstall", async (req, res) => {
        try {
            const containerId = req.params.id;
            const container = (0, docker_1.getContainer)(containerId);
            await container.remove({ force: true, v: true });
            return res.json({ success: true });
        }
        catch (error) {
            return res.status(500).json({ message: error.message });
        }
    });
    app.use(serverRouter);
}
