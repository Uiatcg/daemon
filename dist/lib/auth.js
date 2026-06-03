"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDaemonApiKey = getDaemonApiKey;
exports.ensureDaemonAuth = ensureDaemonAuth;
function getDaemonApiKey() {
    return process.env.DAEMON_API_KEY || "";
}
function ensureDaemonAuth(req, res, next) {
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
