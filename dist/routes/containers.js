"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.setupContainerRoutes = setupContainerRoutes;
const express_1 = __importDefault(require("express"));
const promises_1 = __importDefault(require("fs/promises"));
const path_1 = __importDefault(require("path"));
const child_process_1 = require("child_process");
const docker_1 = require("../lib/docker");
function setupContainerRoutes(app) {
    const router = express_1.default.Router();
    router.get("/api/containers", async (_req, res) => {
        const containers = await docker_1.docker.listContainers({ all: true });
        return res.json({ containers });
    });
    router.post("/api/containers/create", async (req, res) => {
        const payload = req.body;
        if (!payload?.name || !payload?.image) {
            return res.status(400).json({ message: "Container name and image are required." });
        }
        const portBindings = {};
        const exposedPorts = {};
        if (payload.ports) {
            for (const port of payload.ports) {
                const protocol = port.protocol ?? "tcp";
                const containerPort = `${port.containerPort}/${protocol}`;
                exposedPorts[containerPort] = {};
                portBindings[containerPort] = [{ HostPort: String(port.hostPort) }];
            }
        }
        const hostConfig = {
            PortBindings: Object.keys(portBindings).length > 0 ? portBindings : undefined,
            NanoCPUs: payload.cpuLimit ? Math.floor(payload.cpuLimit * 1e9) : undefined,
            Memory: payload.memoryLimitMb ? payload.memoryLimitMb * 1024 * 1024 : undefined,
            BlkioWeight: payload.ioWeight,
        };
        if (payload.serverId) {
            hostConfig.Mounts = [
                {
                    Type: "volume",
                    Source: `ryzenpanel-${payload.serverId}`,
                    Target: "/data",
                },
            ];
        }
        try {
            const container = await (0, docker_1.createContainer)({
                name: payload.name,
                Image: payload.image,
                Cmd: payload.command,
                Env: payload.env,
                ExposedPorts: Object.keys(exposedPorts).length > 0 ? exposedPorts : undefined,
                HostConfig: hostConfig,
            });
            await container.start();
            // Symlink so daemon file routes can find data
            if (payload.serverId) {
                try {
                    const inspect = await container.inspect();
                    const dataMount = inspect.Mounts?.find((m) => m.Destination === "/data");
                    if (dataMount?.Source) {
                        const linkDir = `/var/lib/ryzenpanel/servers/${payload.serverId}`;
                        await promises_1.default.mkdir(path_1.default.dirname(linkDir), { recursive: true });
                        try {
                            await promises_1.default.unlink(linkDir);
                        }
                        catch { }
                        await promises_1.default.symlink(dataMount.Source, linkDir);
                        try {
                            (0, child_process_1.execSync)(`sudo chown -R codespace:codespace "${dataMount.Source}"`);
                        }
                        catch { }
                    }
                }
                catch (e) {
                    console.error("[RYZENPANEL] Failed to symlink volume:", e);
                }
            }
            return res.status(201).json({ id: container.id });
        }
        catch (error) {
            return res.status(500).json({ message: error.message });
        }
    });
    router.post("/api/containers/:id/start", async (req, res) => {
        try {
            const container = (0, docker_1.getContainer)(req.params.id);
            await container.start();
            return res.json({ success: true });
        }
        catch (error) {
            return res.status(500).json({ message: error.message });
        }
    });
    router.post("/api/containers/:id/stop", async (req, res) => {
        try {
            const container = (0, docker_1.getContainer)(req.params.id);
            await container.stop();
            return res.json({ success: true });
        }
        catch (error) {
            return res.status(500).json({ message: error.message });
        }
    });
    router.post("/api/containers/:id/restart", async (req, res) => {
        try {
            const container = (0, docker_1.getContainer)(req.params.id);
            await container.restart();
            return res.json({ success: true });
        }
        catch (error) {
            return res.status(500).json({ message: error.message });
        }
    });
    router.post("/api/containers/:id/kill", async (req, res) => {
        try {
            const container = (0, docker_1.getContainer)(req.params.id);
            await container.kill();
            return res.json({ success: true });
        }
        catch (error) {
            return res.status(500).json({ message: error.message });
        }
    });
    router.delete("/api/containers/:id", async (req, res) => {
        try {
            const container = (0, docker_1.getContainer)(req.params.id);
            await container.remove({ force: true, v: true });
            return res.json({ success: true });
        }
        catch (error) {
            return res.status(500).json({ message: error.message });
        }
    });
    app.use(router);
}
