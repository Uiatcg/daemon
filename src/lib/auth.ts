import { type Request, type Response, type NextFunction } from "express";

export function getDaemonApiKey(): string {
  return process.env.DAEMON_API_KEY || "";
}

export function ensureDaemonAuth(req: Request, res: Response, next: NextFunction) {
  const apiKey = getDaemonApiKey();
  if (!apiKey) {
    console.warn("[RYZENDAEMON] DAEMON_API_KEY not configured – auth disabled");
    return next();
  }
  const incomingKey = req.header("x-daemon-key") || req.header("authorization")?.replace(/^Bearer\s+/i, "");
  if (!incomingKey || incomingKey !== apiKey) {
    return res.status(401).json({ message: "Unauthorized daemon request." });
  }
  return next();
}
