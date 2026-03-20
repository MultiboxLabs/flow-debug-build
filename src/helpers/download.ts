import { createWriteStream } from "fs";

/**
 * Formats bytes to human-readable string
 */
function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

/**
 * Updates the progress bar display
 */
function updateProgressBar(
  downloaded: number,
  total: number,
  filename: string
): void {
  const percentage = total > 0 ? Math.round((downloaded / total) * 100) : 0;
  const barWidth = 30;
  const filled = Math.round((barWidth * downloaded) / total);
  const bar = "█".repeat(filled) + "░".repeat(Math.max(0, barWidth - filled));
  const downloadedStr = formatBytes(downloaded);
  const totalStr = formatBytes(total);

  process.stdout.write(
    `\r${filename} [${bar}] ${percentage}% ${downloadedStr}/${totalStr}`
  );
}

/**
 * Downloads a file from a URL and saves it to the specified path
 */
export async function downloadFile(
  url: string,
  destPath: string
): Promise<void> {
  // Download the file
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(
      `Failed to download file: ${response.status} ${response.statusText}`
    );
  }

  const contentLength = response.headers.get("content-length");
  const total = contentLength ? parseInt(contentLength, 10) : 0;
  const filename = destPath.split("/").pop() || "file";

  let downloaded = 0;

  if (!response.body) {
    throw new Error("Response body is null");
  }

  const writeStream = createWriteStream(destPath);
  const reader = response.body.getReader();

  // Set up promise to wait for stream to finish
  const streamFinished = new Promise<void>((resolve, reject) => {
    writeStream.on("finish", resolve);
    writeStream.on("error", reject);
  });

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const canContinue = writeStream.write(value);
      downloaded += value.length;

      if (total > 0) {
        updateProgressBar(downloaded, total, filename);
      } else {
        process.stdout.write(
          `\r${filename} ${formatBytes(downloaded)} downloaded...`
        );
      }

      // Wait for drain if the write buffer is full
      if (!canContinue) {
        await new Promise<void>((resolve) =>
          writeStream.once("drain", resolve)
        );
      }
    }

    writeStream.end();
    process.stdout.write("\n");

    // Wait for the write stream to finish
    await streamFinished;
  } catch (error) {
    writeStream.destroy();
    process.stdout.write("\n");
    throw error;
  }
}
