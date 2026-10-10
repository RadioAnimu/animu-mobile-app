#!/usr/bin/env node
import { isolated, libraries } from "./submodules.mjs";
const name = process.argv[2];
if (!libraries[name]) throw new Error(`Unknown submodule: ${name}`);
// The app scans all repository histories with check:secrets before this step.
// The isolated copy has no .git; all other gates belong to the library itself.
isolated(name, (_dir, run) => run("check:quality"));
