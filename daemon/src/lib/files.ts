import fs from "fs/promises";
import path from "path";

const root = process.env.DAEMON_FILES_ROOT ?? "/var/lib/ryzenpanel/servers";

export function resolveSafePath(relativePath: string) {
  const normalized = path.posix.normalize(`/${relativePath}`);
  const resolved = path.join(root, normalized);
  if (!resolved.startsWith(root)) {
    throw new Error("Invalid file path.");
  }
  return resolved;
}

export async function listFiles(relativePath: string) {
  const directory = resolveSafePath(relativePath || ".");
  const entries = await fs.readdir(directory, { withFileTypes: true });
  return entries.map((entry) => ({
    name: entry.name,
    type: entry.isDirectory() ? "directory" : "file",
  }));
}

export async function readFile(relativePath: string) {
  const filePath = resolveSafePath(relativePath);
  return fs.readFile(filePath, "utf8");
}

export async function writeFile(relativePath: string, content: string) {
  const filePath = resolveSafePath(relativePath);
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, content, "utf8");
}

export async function deleteFile(relativePath: string) {
  const filePath = resolveSafePath(relativePath);
  return fs.rm(filePath, { recursive: true, force: true });
}

export async function makeDirectory(relativePath: string) {
  const dirPath = resolveSafePath(relativePath);
  return fs.mkdir(dirPath, { recursive: true });
}
