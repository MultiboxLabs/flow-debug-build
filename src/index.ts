import os from "os";
import {
  downloadAndExtractZip,
  exists,
  extractZip,
  spawn,
} from "./helpers/index.js";
import path from "path";
import fs from "fs/promises";

async function resolveInnerMacZipPath(tempDir: string): Promise<string> {
  const entries = await fs.readdir(tempDir, { withFileTypes: true });
  const zips = entries
    .filter((e) => e.isFile() && e.name.endsWith("-arm64-mac.zip"))
    .map((e) => e.name);
  if (zips.length === 0) {
    const names = entries.map((e) => e.name).join(", ");
    throw new Error(
      `No *-arm64-mac.zip found in artifact (got: ${names || "(empty)"}).`
    );
  }
  if (zips.length > 1) {
    throw new Error(
      `Multiple *-arm64-mac.zip files in artifact: ${zips.join(", ")}.`
    );
  }
  const [innerZipName] = zips;
  if (!innerZipName) {
    throw new Error("No inner mac zip resolved (unexpected).");
  }
  return path.join(tempDir, innerZipName);
}

// Configuration //
interface InstallOptions {
  openFolder?: boolean;
  openApp?: boolean;
}

function linuxFlatpakZipName(): string {
  const arch = os.arch();
  if (arch === "x64") {
    return "flatpak-ubuntu-latest.zip";
  }
  if (arch === "arm64") {
    return "flatpak-ubuntu-24.04-arm.zip";
  }
  throw new Error(
    `Unsupported Linux architecture for Flatpak artifacts: ${arch} (expected x64 or arm64)`
  );
}

async function findFlatpakBundles(dir: string): Promise<string[]> {
  const found: string[] = [];
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const ent of entries) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      found.push(...(await findFlatpakBundles(full)));
    } else if (ent.name.endsWith(".flatpak")) {
      found.push(full);
    }
  }
  return found.sort();
}

const FLOW_FLATPAK_APP_ID = "com.flow_browser.flow";

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

    const innerZipPath = await resolveInnerMacZipPath(tempDir);
    console.log("Extracting zip...");

    await extractZip(innerZipPath, path.join(tempDir, "app"));

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
  } else if (os.platform() === "linux") {
    let zipName: string;
    try {
      zipName = linuxFlatpakZipName();
    } catch (e) {
      console.error(e instanceof Error ? e.message : e);
      process.exit(1);
    }

    const zipUrl = `${artifactsBaseUrl}/${zipName}`;
    const tempDir = await downloadAndExtractZip(zipUrl).catch((error: unknown) => {
      if (error instanceof Error && error.message.includes("404")) {
        console.error(`Run ID '${runId}' not found, or this run has no ${zipName}`);
        process.exit(1);
      }
      throw error;
    });

    const bundles = await findFlatpakBundles(tempDir);
    if (bundles.length === 0) {
      console.error("No .flatpak bundle found inside the downloaded artifact");
      await fs.rm(tempDir, { recursive: true });
      process.exit(1);
    }

    for (const bundle of bundles) {
      console.log(`Installing Flatpak bundle: ${path.basename(bundle)}`);
      const result = await spawn("flatpak", ["install", "--user", "-y", bundle]);

      if (result.stdout) {
        process.stdout.write(result.stdout);
      }
      if (result.stderr) {
        process.stderr.write(result.stderr);
      }

      if (result.code === 0) {
        continue;
      }

      const error = new Error(
        `Command failed: flatpak install --user -y ${bundle}\n${result.stderr}`
      );
      (error as Error & { result: typeof result }).result = result;
      throw error;
    }

    console.log(
      bundles.length === 1
        ? "Flow (Debug Build) Flatpak installed (user installation)"
        : `Installed ${bundles.length} Flatpak bundles (user installation)`
    );

    if (options.openApp) {
      await spawn("flatpak", ["run", FLOW_FLATPAK_APP_ID], {
        stdio: "inherit",
      });
      console.log("Launched app via flatpak run");
    } else if (options.openFolder) {
      const appRoot = path.join(
        os.homedir(),
        ".local/share/flatpak/app",
        FLOW_FLATPAK_APP_ID
      );
      if (await exists(appRoot)) {
        await spawn("xdg-open", [appRoot], { stdio: "inherit" });
        console.log("Opened app install folder");
      } else {
        await spawn("xdg-open", [
          path.join(os.homedir(), ".local/share/flatpak/app"),
        ], { stdio: "inherit" });
        console.log("Opened Flatpak app directory");
      }
    }

    await fs.rm(tempDir, { recursive: true });
    process.exit(0);
  } else {
    console.log(`Unsupported platform: ${os.platform()}`);
    process.exit(1);
  }
}
