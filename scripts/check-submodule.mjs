#!/usr/bin/env node
import { auditDependencies } from "./dependency-audit.mjs";
import { isolated, libraries } from "./submodules.mjs";
const name = process.argv[2];
if (!libraries[name]) throw new Error(`Unknown submodule: ${name}`);
isolated(name, (dir, run) => {
  if (name === "react-native-anything-player") run("lint", "--max-warnings", "0");
  auditDependencies(dir, name === "animu-api" ? "pnpm" : "yarn");
  run("typecheck");
  run("test:coverage");
  run(name === "react-native-anything-player" ? "prepare" : "build");
});
