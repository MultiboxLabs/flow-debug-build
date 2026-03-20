import fs from "fs/promises";
import { join } from "path";
import os from "os";
import { spawn } from "child_process";
import { downloadFile } from "./download.js";

/**
 * Extracts a zip file to the specified directory
 */
export async function extractZip(
  zipPath: string,
  extractDir: string
): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const extractProcess = spawn("unzip", ["-q", zipPath, "-d", extractDir], {
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stderr = "";

    extractProcess.stderr?.on("data", (data) => {
      stderr += data.toString();
    });

    extractProcess.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(`Failed to extract zip: ${stderr}`));
      } else {
        resolve();
      }
    });

    extractProcess.on("error", (error) => {
      reject(error);
    });
  });
}

/**
 * Creates a temporary directory
 */
export async function createTempDir(): Promise<string> {
  return await fs.mkdtemp(join(os.tmpdir(), "downloader-"));
}

/**
 * Downloads a zip file from a URL, extracts it to a temporary directory,
 * and returns the path to the extracted directory
 */
export async function downloadAndExtractZip(url: string): Promise<string> {
  // Create a temporary directory for extraction
  const tempDir = await createTempDir();
  const zipPath = join(tempDir, "archive.zip");

  // Download the zip file
  await downloadFile(url, zipPath);

  // Extract zip file
  await extractZip(zipPath, tempDir);

  // Clean up the zip file
  await fs.unlink(zipPath);

  return tempDir;
}
