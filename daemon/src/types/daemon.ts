export interface ContainerCreatePayload {
  name: string;
  image: string;
  command?: string[];
  env?: string[];
  ports?: Array<{ hostPort: string; containerPort: string; protocol?: "tcp" | "udp" }>;
  volumes?: Array<{ hostPath: string; containerPath: string; readOnly?: boolean }>;
  cpuLimit?: number;
  memoryLimitMb?: number;
  ioWeight?: number;
}

export interface FileWritePayload {
  path: string;
  content: string;
}

export interface FileDeletePayload {
  path: string;
}
