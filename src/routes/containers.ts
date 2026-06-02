import express from "express";
import fs from "fs/promises";
import path from "path";
import { execSync } from "child_process";
import { createContainer, docker, getContainer } from "../lib/docker";
import { type ContainerCreatePayload } from "../types/daemon";

export function setupContainerRoutes(app: express.Express) {
  const router = express.Router();

  router.get("/api/containers", async (_req, res) => {
    const containers = await docker.listContainers({ all: true });
    return res.json({ containers });
  });

  router.post("/api/containers/create", async (req, res) => {
    const payload = req.body as ContainerCreatePayload;
    if (!payload?.name || !payload?.image) {
      return res.status(400).json({ message: "Container name and image are required." });
    }

    const portBindings: Record<string, Array<{ HostPort: string }>> = {};
    const exposedPorts: Record<string, {}> = {};
    if (payload.ports) {
      for (const port of payload.ports) {
        const protocol = port.protocol ?? "tcp";
        const containerPort = `${port.containerPort}/${protocol}`;
        exposedPorts[containerPort] = {};
        portBindings[containerPort] = [{ HostPort: String(port.hostPort) }];
      }
    }

    const hostConfig: any = {
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
      const container = await createContainer({
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
          const dataMount = inspect.Mounts?.find((m: any) => m.Destination === "/data");
          if (dataMount?.Source) {
            const linkDir = `/var/lib/ryzenpanel/servers/${payload.serverId}`;
            await fs.mkdir(path.dirname(linkDir), { recursive: true });
            try { await fs.unlink(linkDir); } catch {}
            await fs.symlink(dataMount.Source, linkDir);
            try { execSync(`sudo chown -R codespace:codespace "${dataMount.Source}"`); } catch {}
          }
        } catch (e) {
          console.error("[RYZENPANEL] Failed to symlink volume:", e);
        }
      }

      return res.status(201).json({ id: container.id });
    } catch (error) {
      return res.status(500).json({ message: (error as Error).message });
    }
  });

  router.post("/api/containers/:id/start", async (req, res) => {
    try {
      const container = getContainer(req.params.id);
      await container.start();
      return res.json({ success: true });
    } catch (error) {
      return res.status(500).json({ message: (error as Error).message });
    }
  });

  router.post("/api/containers/:id/stop", async (req, res) => {
    try {
      const container = getContainer(req.params.id);
      await container.stop();
      return res.json({ success: true });
    } catch (error) {
      return res.status(500).json({ message: (error as Error).message });
    }
  });

  router.post("/api/containers/:id/restart", async (req, res) => {
    try {
      const container = getContainer(req.params.id);
      await container.restart();
      return res.json({ success: true });
    } catch (error) {
      return res.status(500).json({ message: (error as Error).message });
    }
  });

  router.post("/api/containers/:id/kill", async (req, res) => {
    try {
      const container = getContainer(req.params.id);
      await container.kill();
      return res.json({ success: true });
    } catch (error) {
      return res.status(500).json({ message: (error as Error).message });
    }
  });

  router.delete("/api/containers/:id", async (req, res) => {
    try {
      const container = getContainer(req.params.id);
      await container.remove({ force: true, v: true });
      return res.json({ success: true });
    } catch (error) {
      return res.status(500).json({ message: (error as Error).message });
    }
  });

  app.use(router);
}
