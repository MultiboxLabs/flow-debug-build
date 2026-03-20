import os from "os";
import {
  downloadAndExtractZip,
  exists,
  extractZip,
  spawn,
} from "./helpers/index.js";
import path from "path";
import fs from "fs/promises";

// Configuration //
interface InstallOptions {
  openFolder?: boolean;
  openApp?: boolean;
}

// Main //
export async function installFlowDebugBuild(
  runId: string,
  options: InstallOptions = {}
): Promise<void> {
  const artifactsBaseUrl = `https://nightly.link/MultiboxLabs/flow-browser/actions/runs/${runId}`;

  if (os.platform() === "darwin") {
    const zipUrl = `${artifactsBaseUrl}/macos-latest.zip`;

    // Download and extract 'macos-latest.zip'
    const tempDir = await downloadAndExtractZip(zipUrl).catch(
      (error: unknown) => {
        if (error instanceof Error && error.message.includes("404")) {
          console.error(`Run ID '${runId}' not found`);
          process.exit(1);
        }
        throw error;
      }
    );

    // Extract 'Flow.app' from 'Flow-0.8.3-arm64-mac.zip'
    console.log("Extracting zip...");

    await extractZip(
      path.join(tempDir, "Flow-0.8.3-arm64-mac.zip"),
      path.join(tempDir, "app")
    );

    // Move 'Flow.app' into '~/Applications/Flow/{RUN_ID}/'
    const flowAppPath = path.join(tempDir, "app", "Flow.app");
    const flowAppDestDir = path.join(
      os.homedir(),
      "Applications",
      "FlowDebugBuilds",
      runId
    );

    const flowAppDestPath = path.join(flowAppDestDir, "Flow.app");
    await fs.mkdir(path.dirname(flowAppDestPath), { recursive: true });

    if (await exists(flowAppDestPath)) {
      console.log(`Replacing existing Flow.app from that run...`);
      await fs.rm(flowAppDestPath, { recursive: true });
    } else {
      console.log(`Installing Flow (Debug Build)...`);
    }

    await fs.rename(flowAppPath, flowAppDestPath);

    // Finish
    console.log(`Flow (Debug Build) installed to: ${flowAppDestDir}`);

    if (options.openApp) {
      await spawn("open", [flowAppDestPath]);
      console.log(`Opened installed app`);
    } else if (options.openFolder) {
      await spawn("open", [flowAppDestDir]);
      console.log(`Opened installed folder`);
    }

    // Cleanup
    await fs.rm(tempDir, { recursive: true });
    process.exit(0);
  } else {
    console.log(`Unsupported platform: ${os.platform()}`);
    process.exit(1);
  }
}
