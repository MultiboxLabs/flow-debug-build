import fs from "fs/promises";

export async function exists(path: string): Promise<boolean> {
  return await fs
    .stat(path)
    .then(() => true)
    .catch(() => false);
}
