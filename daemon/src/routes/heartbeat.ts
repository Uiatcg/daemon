import { type Request, type Response } from "express";
import os from "os";

let serverStates: Record<string, { status: string; cpu: number; ram: number; disk: number; lastPing: string }> = {};

export function getServerStates() {
  return serverStates;
}

export function updateServerState(
  containerId: string,
  state: { status: string; cpu: number; ram: number; disk: number },
) {
  serverStates[containerId] = { ...state, lastPing: new Date().toISOString() };
}

export function setupHeartbeatRoute(app: any) {
  app.get("/api/heartbeat", (_req: Request, res: Response) => {
    const cpus = os.cpus();
    const totalMem = os.totalmem();
    const freeMem = os.freemem();

    res.json({
      status: "ok",
      timestamp: new Date().toISOString(),
      system: {
        hostname: os.hostname(),
        platform: os.platform(),
        arch: os.arch(),
        uptime: os.uptime(),
        loadAvg: os.loadavg(),
      },
      resources: {
        cpu: {
          cores: cpus.length,
          model: cpus[0]?.model || "unknown",
          loadPercent: Math.round((os.loadavg()[0] / cpus.length) * 100),
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