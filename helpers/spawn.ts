import { spawn as nodeSpawn, ChildProcess } from "child_process";

export interface SpawnOptions {
  stdio?: Array<"ignore" | "pipe" | "inherit"> | "inherit" | "pipe" | "ignore";
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  shell?: boolean;
}

export interface SpawnResult {
  code: number | null;
  signal: NodeJS.Signals | null;
  stdout: string;
  stderr: string;
}

/**
 * Spawns a child process and returns a promise that resolves with the result
 */
export function spawn(
  command: string,
  args: string[] = [],
  options: SpawnOptions = {}
): Promise<SpawnResult> {
  return new Promise((resolve, reject) => {
    const child: ChildProcess = nodeSpawn(command, args, {
      stdio: options.stdio || ["ignore", "pipe", "pipe"],
      cwd: options.cwd,
      env: options.env,
      shell: options.shell,
    });

    let stdout = "";
    let stderr = "";

    if (child.stdout) {
      child.stdout.on("data", (data) => {
        stdout += data.toString();
      });
    }

    if (child.stderr) {
      child.stderr.on("data", (data) => {
        stderr += data.toString();
      });
    }

    child.on("close", (code, signal) => {
      resolve({
        code,
        signal,
        stdout,
        stderr,
      });
    });

    child.on("error", (error) => {
      reject(error);
    });
  });
}

/**
 * Spawns a child process and throws an error if it exits with a non-zero code
 */
export async function spawnOrThrow(
  command: string,
  args: string[] = [],
  options: SpawnOptions = {}
): Promise<SpawnResult> {
  const result = await spawn(command, args, options);
  if (result.code !== 0) {
    const error = new Error(
      `Command failed: ${command} ${args.join(" ")}\n${result.stderr}`
    );
    (error as any).result = result;
    throw error;
  }
  return result;
}

/**
 * Spawns a child process without waiting for it to complete (fire and forget)
 */
export function spawnAsync(
  command: string,
  args: string[] = [],
  options: SpawnOptions = {}
): ChildProcess {
  return nodeSpawn(command, args, {
    stdio: options.stdio || "ignore",
    cwd: options.cwd,
    env: options.env,
    shell: options.shell,
  });
}
