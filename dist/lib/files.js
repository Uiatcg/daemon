"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listFiles = listFiles;
exports.readFile = readFile;
exports.writeFile = writeFile;
exports.deleteFile = deleteFile;
exports.makeDirectory = makeDirectory;
exports.renameFile = renameFile;
const child_process_1 = require("child_process");
function escapePath(p) {
    return p.replace(/'/g, `'\\''`);
}
function listFiles(containerId, relativePath) {
    const dir = relativePath === "/" ? "/data" : `/data/${escapePath(relativePath.replace(/^\//, ""))}`;
    const out = (0, child_process_1.execSync)(`docker exec "${containerId}" ls -1a "${dir}"`, { encoding: "utf8", timeout: 5000 });
    const lines = out.trim().split("\n").filter(Boolean);
    const files = [];
    for (const name of lines) {
        if (name === "." || name === "..")
            continue;
        const typeOut = (0, child_process_1.execSync)(`docker exec "${containerId}" test -d "${dir}/${escapePath(name)}" && echo directory || echo file`, { encoding: "utf8", timeout: 3000 });
        files.push({ name, type: typeOut.trim() === "directory" ? "directory" : "file" });
    }
    return files;
}
function readFile(containerId, relativePath) {
    const filePath = `/data/${escapePath(relativePath.replace(/^\//, ""))}`;
    return (0, child_process_1.execSync)(`docker exec "${containerId}" cat "${filePath}"`, { encoding: "utf8", timeout: 5000 });
}
function writeFile(containerId, relativePath, content) {
    const filePath = `/data/${escapePath(relativePath.replace(/^\//, ""))}`;
    const dir = filePath.substring(0, filePath.lastIndexOf("/"));
    (0, child_process_1.execSync)(`docker exec "${containerId}" mkdir -p "${escapePath(dir)}"`, { encoding: "utf8", timeout: 5000 });
    const tmp = `/tmp/ryzen_write_${Date.now()}`;
    require("fs").writeFileSync(tmp, content, "utf8");
    (0, child_process_1.execSync)(`docker cp "${tmp}" "${containerId}:${filePath}"`, { encoding: "utf8", timeout: 10000 });
    require("fs").unlinkSync(tmp);
}
function deleteFile(containerId, relativePath) {
    const filePath = `/data/${escapePath(relativePath.replace(/^\//, ""))}`;
    (0, child_process_1.execSync)(`docker exec "${containerId}" rm -rf "${filePath}"`, { encoding: "utf8", timeout: 10000 });
}
function makeDirectory(containerId, relativePath) {
    const dirPath = `/data/${escapePath(relativePath.replace(/^\//, ""))}`;
    (0, child_process_1.execSync)(`docker exec "${containerId}" mkdir -p "${dirPath}"`, { encoding: "utf8", timeout: 5000 });
}
function renameFile(containerId, oldPath, newPath) {
    const src = `/data/${escapePath(oldPath.replace(/^\//, ""))}`;
    const dst = `/data/${escapePath(newPath.replace(/^\//, ""))}`;
    (0, child_process_1.execSync)(`docker exec "${containerId}" mv "${src}" "${dst}"`, { encoding: "utf8", timeout: 5000 });
}
