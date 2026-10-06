#!/usr/bin/env node
import { isolated, libraries } from "./submodules.mjs";
const name = process.argv[2];
if (!libraries[name]) throw new Error(`Unknown submodule: ${name}`);
isolated(name, (_dir, run) => {
  if (name === "react-native-anything-player") run("lint", "--max-warnings", "0");
  run("typecheck");
  run("test:coverage");
  run(name === "react-native-anything-player" ? "prepare" : "build");
});
