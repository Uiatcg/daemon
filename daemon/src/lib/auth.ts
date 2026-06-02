import { type Request, type Response, type NextFunction } from "express";

const apiKey = process.env.DAEMON_API_KEY;
if (!apiKey) {
  throw new Error("DAEMON_API_KEY must be defined in daemon environment.");
}

export function ensureDaemonAuth(req: Request, res: Response, next: NextFunction) {
  const incomingKey = req.header("x-daemon-key") || req.header("authorization")?.replace(/^Bearer\s+/i, "");
  if (!incomingKey || incomingKey !== apiKey) {
    return res.status(401).json({ message: "Unauthorized daemon request." });
  }

  return next();
}
