import { type Request, type Response, type Express } from "express";
import { createContainer, getContainer, docker, pullImage } from "../lib/docker";
import path from "path";
import fs from "fs";

const dataRoot = process.env.DAEMON_DATA_ROOT || "/var/lib/ryzenpanel";

export function setupRegistration(app: Express) {
  app.post("/api/register", (req: Request, res: Response) => {
    const { nodeId, nodeToken, apiKey } = req.body;

    if (!nodeId || !nodeToken || !apiKey) {
      return res.status(400).json({ message: "nodeId, nodeToken, and apiKey required" });
    }

    process.env.NODE_ID = nodeId;
    process.env.NODE_TOKEN = nodeToken;
    process.env.DAEMON_API_KEY = apiKey;

    const cfgDir = dataRoot;
    const cfgPath = path.join(cfgDir, "daemon.json");
    fs.mkdirSync(cfgDir, { recursive: true });
    fs.writeFileSync(cfgPath, JSON.stringify({
      nodeId,
      nodeToken,
      apiKey,
      panelUrl: req.body.panelUrl || process.env.PANEL_URL || "",
      registeredAt: new Date().toISOString(),
    }, null, 2));

    return res.json({ success: true, message: "Daemon configured successfully" });
  });

  app.post("/api/servers/create", async (req: Request, res: Response) => {
    try {
      const { serverId, serverUuid, name, image, ram, cpu, disk, portBindings, env, startupCommand } = req.body;

      if (!serverUuid || !image) {
        return res.status(400).json({ message: "serverUuid and image required" });
      }

      const serverDir = path.join(dataRoot, "servers", serverUuid);
      fs.mkdirSync(serverDir, { recursive: true });

      const envVars = [...(env || [])];

      const portConfig: Record<string, Array<{ HostPort: string }>> = {};
      const exposedPorts: Record<string, {}> = {};
      if (portBindings) {
        for (const binding of portBindings) {
          const key = `${binding.container}/${binding.protocol || "tcp"}`;
          exposedPorts[key] = {};
          portConfig[key] = [{ HostPort: String(binding.host) }];
        }
      }

      const isMinecraft = image.includes("itzg/minecraft-server");
      const dataDir = isMinecraft ? "/data" : "/home/container";

      const container = await createContainer({
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
      } as any);

      await container.start();

      return res.status(201).json({
        success: true,
        containerId: container.id,
        serverUuid,
      });
    } catch (error) {
      return res.status(500).json({ message: (error as Error).message });
    }
  });

  app.post("/api/servers/:id/power", async (req: Request, res: Response) => {
    try {
      const { action } = req.body;
      const containerId = req.params.id;

      if (!containerId || !action) {
        return res.status(400).json({ message: "containerId and action required" });
      }

      const container = getContainer(containerId);

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
    } catch (error) {
      return res.status(500).json({ message: (error as Error).message });
    }
  });

  app.post("/api/servers/:id/reinstall", async (req: Request, res: Response) => {
    try {
      const containerId = req.params.id;
      const container = getContainer(containerId);
      await container.remove({ force: true, v: true });
      return res.json({ success: true });
    } catch (error) {
      return res.status(500).json({ message: (error as Error).message });
    }
  });
}