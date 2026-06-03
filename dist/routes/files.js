"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.setupFileRoutes = setupFileRoutes;
const express_1 = __importDefault(require("express"));
const files_1 = require("../lib/files");
function setupFileRoutes(app) {
    const router = express_1.default.Router();
    function getContainerId(req) {
        return String(req.query.containerId || req.body?.containerId || "");
    }
    router.get("/api/files/list", async (req, res) => {
        try {
            const containerId = getContainerId(req);
            if (!containerId)
                return res.status(400).json({ message: "containerId required" });
            const pathQuery = String(req.query.path ?? "/");
            const files = (0, files_1.listFiles)(containerId, pathQuery);
            return res.json({ files });
        }
        catch (error) {
            return res.status(400).json({ message: error.message });
        }
    });
    router.get("/api/files/read", async (req, res) => {
        try {
            const containerId = getContainerId(req);
            if (!containerId)
                return res.status(400).json({ message: "containerId required" });
            const filePath = String(req.query.path ?? "");
            const content = (0, files_1.readFile)(containerId, filePath);
            return res.json({ content });
        }
        catch (error) {
            return res.status(400).json({ message: error.message });
        }
    });
    router.post("/api/files/write", async (req, res) => {
        try {
            const containerId = getContainerId(req);
            if (!containerId)
                return res.status(400).json({ message: "containerId required" });
            const { path, content } = req.body;
            if (!path || typeof content !== "string") {
                return res.status(400).json({ message: "Path and content are required." });
            }
            (0, files_1.writeFile)(containerId, path, content);
            return res.json({ success: true });
        }
        catch (error) {
            return res.status(400).json({ message: error.message });
        }
    });
    router.delete("/api/files", async (req, res) => {
        try {
            const containerId = getContainerId(req);
            if (!containerId)
                return res.status(400).json({ message: "containerId required" });
            const filePath = String(req.query.path ?? "");
            if (!filePath)
                return res.status(400).json({ message: "Path is required." });
            (0, files_1.deleteFile)(containerId, filePath);
            return res.json({ success: true });
        }
        catch (error) {
            return res.status(400).json({ message: error.message });
        }
    });
    router.post("/api/files/mkdir", async (req, res) => {
        try {
            const containerId = getContainerId(req);
            if (!containerId)
                return res.status(400).json({ message: "containerId required" });
            const { path } = req.body;
            if (!path)
                return res.status(400).json({ message: "Path is required." });
            (0, files_1.makeDirectory)(containerId, path);
            return res.json({ success: true });
        }
        catch (error) {
            return res.status(400).json({ message: error.message });
        }
    });
    router.post("/api/files/rename", async (req, res) => {
        try {
            const containerId = getContainerId(req);
            if (!containerId)
                return res.status(400).json({ message: "containerId required" });
            const { oldPath, newPath } = req.body;
            if (!oldPath || !newPath)
                return res.status(400).json({ message: "oldPath and newPath are required." });
            (0, files_1.renameFile)(containerId, oldPath, newPath);
            return res.json({ success: true });
        }
        catch (error) {
            return res.status(400).json({ message: error.message });
        }
    });
    app.use(router);
}
