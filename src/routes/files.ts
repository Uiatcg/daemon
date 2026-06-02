import express from "express";
import { listFiles, readFile, writeFile, deleteFile, makeDirectory, renameFile } from "../lib/files";

export function setupFileRoutes(app: express.Express) {
  const router = express.Router();

  function getContainerId(req: express.Request): string | null {
    return String(req.query.containerId || req.body?.containerId || "");
  }

  router.get("/api/files/list", async (req, res) => {
    try {
      const containerId = getContainerId(req);
      if (!containerId) return res.status(400).json({ message: "containerId required" });
      const pathQuery = String(req.query.path ?? "/");
      const files = listFiles(containerId, pathQuery);
      return res.json({ files });
    } catch (error) {
      return res.status(400).json({ message: (error as Error).message });
    }
  });

  router.get("/api/files/read", async (req, res) => {
    try {
      const containerId = getContainerId(req);
      if (!containerId) return res.status(400).json({ message: "containerId required" });
      const filePath = String(req.query.path ?? "");
      const content = readFile(containerId, filePath);
      return res.json({ content });
    } catch (error) {
      return res.status(400).json({ message: (error as Error).message });
    }
  });

  router.post("/api/files/write", async (req, res) => {
    try {
      const containerId = getContainerId(req);
      if (!containerId) return res.status(400).json({ message: "containerId required" });
      const { path, content } = req.body;
      if (!path || typeof content !== "string") {
        return res.status(400).json({ message: "Path and content are required." });
      }
      writeFile(containerId, path, content);
      return res.json({ success: true });
    } catch (error) {
      return res.status(400).json({ message: (error as Error).message });
    }
  });

  router.delete("/api/files", async (req, res) => {
    try {
      const containerId = getContainerId(req);
      if (!containerId) return res.status(400).json({ message: "containerId required" });
      const filePath = String(req.query.path ?? "");
      if (!filePath) return res.status(400).json({ message: "Path is required." });
      deleteFile(containerId, filePath);
      return res.json({ success: true });
    } catch (error) {
      return res.status(400).json({ message: (error as Error).message });
    }
  });

  router.post("/api/files/mkdir", async (req, res) => {
    try {
      const containerId = getContainerId(req);
      if (!containerId) return res.status(400).json({ message: "containerId required" });
      const { path } = req.body;
      if (!path) return res.status(400).json({ message: "Path is required." });
      makeDirectory(containerId, path);
      return res.json({ success: true });
    } catch (error) {
      return res.status(400).json({ message: (error as Error).message });
    }
  });

  router.post("/api/files/rename", async (req, res) => {
    try {
      const containerId = getContainerId(req);
      if (!containerId) return res.status(400).json({ message: "containerId required" });
      const { oldPath, newPath } = req.body;
      if (!oldPath || !newPath) return res.status(400).json({ message: "oldPath and newPath are required." });
      renameFile(containerId, oldPath, newPath);
      return res.json({ success: true });
    } catch (error) {
      return res.status(400).json({ message: (error as Error).message });
    }
  });

  app.use(router);
}
