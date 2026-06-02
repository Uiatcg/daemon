import { execSync } from "child_process";

function escapePath(p: string) {
  return p.replace(/'/g, `'\\''`);
}

export function listFiles(containerId: string, relativePath: string) {
  const dir = relativePath === "/" ? "/data" : `/data/${escapePath(relativePath.replace(/^\//, ""))}`;
  const out = execSync(`docker exec "${containerId}" ls -1a "${dir}"`, { encoding: "utf8", timeout: 5000 });
  const lines = out.trim().split("\n").filter(Boolean);
  const files: Array<{ name: string; type: string }> = [];
  for (const name of lines) {
    if (name === "." || name === "..") continue;
    const typeOut = execSync(`docker exec "${containerId}" test -d "${dir}/${escapePath(name)}" && echo directory || echo file`, { encoding: "utf8", timeout: 3000 });
    files.push({ name, type: typeOut.trim() === "directory" ? "directory" : "file" });
  }
  return files;
}

export function readFile(containerId: string, relativePath: string) {
  const filePath = `/data/${escapePath(relativePath.replace(/^\//, ""))}`;
  return execSync(`docker exec "${containerId}" cat "${filePath}"`, { encoding: "utf8", timeout: 5000 });
}

export function writeFile(containerId: string, relativePath: string, content: string) {
  const filePath = `/data/${escapePath(relativePath.replace(/^\//, ""))}`;
  const dir = filePath.substring(0, filePath.lastIndexOf("/"));
  execSync(`docker exec "${containerId}" mkdir -p "${escapePath(dir)}"`, { encoding: "utf8", timeout: 5000 });
  const tmp = `/tmp/ryzen_write_${Date.now()}`;
  require("fs").writeFileSync(tmp, content, "utf8");
  execSync(`docker cp "${tmp}" "${containerId}:${filePath}"`, { encoding: "utf8", timeout: 10000 });
  require("fs").unlinkSync(tmp);
}

export function deleteFile(containerId: string, relativePath: string) {
  const filePath = `/data/${escapePath(relativePath.replace(/^\//, ""))}`;
  execSync(`docker exec "${containerId}" rm -rf "${filePath}"`, { encoding: "utf8", timeout: 10000 });
}

export function makeDirectory(containerId: string, relativePath: string) {
  const dirPath = `/data/${escapePath(relativePath.replace(/^\//, ""))}`;
  execSync(`docker exec "${containerId}" mkdir -p "${dirPath}"`, { encoding: "utf8", timeout: 5000 });
}

export function renameFile(containerId: string, oldPath: string, newPath: string) {
  const src = `/data/${escapePath(oldPath.replace(/^\//, ""))}`;
  const dst = `/data/${escapePath(newPath.replace(/^\//, ""))}`;
  execSync(`docker exec "${containerId}" mv "${src}" "${dst}"`, { encoding: "utf8", timeout: 5000 });
}
