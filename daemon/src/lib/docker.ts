// @ts-ignore - dockerode doesn't have types
import Docker, { type ContainerCreateOptions, type Container } from "dockerode";

const socketPath = process.env.DOCKER_SOCKET_PATH ?? "/var/run/docker.sock";

export const docker = new Docker({ socketPath });

export async function pullImage(image: string) {
  return new Promise<void>((resolve, reject) => {
    docker.pull(image, (error: Error | null, stream: NodeJS.ReadableStream) => {
      if (error) {
        return reject(error);
      }
      docker.modem.followProgress(stream, (err: Error | null) => {
        if (err) {
          return reject(err);
        }
        resolve();
      });
    });
  });
}

export async function createContainer(spec: ContainerCreateOptions) {
  const pullImageFlag = !(await docker.listImages()).some((img: any) => img.RepoTags?.includes(spec.Image as string));
  if (pullImageFlag) {
    await pullImage(spec.Image as string);
  }
  return docker.createContainer(spec);
}

export function getContainer(containerId: string): Container {
  return docker.getContainer(containerId);
}
