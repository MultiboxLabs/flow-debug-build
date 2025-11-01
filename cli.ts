#!/usr/bin/env node
import { installFlowDebugBuild } from "./index.js";

function hasArg(arg: string): boolean {
  return process.argv.includes(arg);
}

const openApp = hasArg("--open");
const openFolder = hasArg("--open-folder");

const RUN_ID = process.argv.at(-1);
if (!RUN_ID) {
  console.error("A run ID is required");
  process.exit(1);
}

await installFlowDebugBuild(RUN_ID, { openApp, openFolder });
