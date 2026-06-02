import express from "express";
import fs from "fs/promises";
import { listFiles, readFile, writeFile, deleteFile, makeDirectory, resolveSafePath } from "../lib/files";

export function setupFileRoutes(app: express.Express) {
  const router = express.Router();

  router.get("/api/files/list", async (req, res) => {
    try {
      const pathQuery = String(req.query.path ?? "");
      const files = await listFiles(pathQuery);
      return res.json({ files });
    } catch (error) {
      return res.status(400).json({ message: (error as Error).message });
    }
  });

  router.get("/api/files/read", async (req, res) => {
    try {
      const filePath = String(req.query.path ?? "");
      const content = await readFile(filePath);
      return res.json({ content });
    } catch (error) {
      return res.status(400).json({ message: (error as Error).message });
    }
  });

  router.post("/api/files/write", async (req, res) => {
    try {
      const { path, content } = req.body;
      if (!path || typeof content !== "string") {
        return res.status(400).json({ message: "Path and content are required." });
      }
      await writeFile(path, content);
      return res.json({ success: true });
    } catch (error) {
      return res.status(400).json({ message: (error as Error).message });
    }
  });

  router.delete("/api/files", async (req, res) => {
    try {
      const filePath = String(req.query.path ?? "");
      if (!filePath) {
        return res.status(400).json({ message: "Path is required." });
      }
      await deleteFile(filePath);
      return res.json({ success: true });
    } catch (error) {
      return res.status(400).json({ message: (error as Error).message });
    }
  });

  router.post("/api/files/mkdir", async (req, res) => {
    try {
      const { path } = req.body;
      if (!path) {
        return res.status(400).json({ message: "Path is required." });
      }
      await makeDirectory(path);
      return res.json({ success: true });
    } catch (error) {
      return res.status(400).json({ message: (error as Error).message });
    }
  });

  router.post("/api/files/rename", async (req, res) => {
    try {
      const { oldPath, newPath } = req.body;
      if (!oldPath || !newPath) {
        return res.status(400).json({ message: "oldPath and newPath are required." });
      }
      await fs.rename(resolveSafePath(oldPath), resolveSafePath(newPath));
      return res.json({ success: true });
    } catch (error) {
      return res.status(400).json({ message: (error as Error).message });
    }
  });

  app.use(router);
}
