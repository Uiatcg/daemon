"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.docker = void 0;
exports.pullImage = pullImage;
exports.createContainer = createContainer;
exports.getContainer = getContainer;
// @ts-ignore
const dockerode_1 = __importDefault(require("dockerode"));
const socketPath = process.env.DOCKER_SOCKET_PATH ?? "/var/run/docker.sock";
exports.docker = new dockerode_1.default({ socketPath });
async function pullImage(image) {
    return new Promise((resolve, reject) => {
        exports.docker.pull(image, (error, stream) => {
            if (error) {
                return reject(error);
            }
            exports.docker.modem.followProgress(stream, (err) => {
                if (err) {
                    return reject(err);
                }
                resolve();
            });
        });
    });
}
async function createContainer(spec) {
    const pullImageFlag = !(await exports.docker.listImages()).some((img) => img.RepoTags?.includes(spec.Image));
    if (pullImageFlag) {
        await pullImage(spec.Image);
    }
    return exports.docker.createContainer(spec);
}
function getContainer(containerId) {
    return exports.docker.getContainer(containerId);
}
