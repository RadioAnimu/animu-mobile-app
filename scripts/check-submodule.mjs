#!/usr/bin/env node
import path from "node:path";
import { isolated, libraries, root } from "./submodules.mjs";
import { restore } from "./ci-results.mjs";
const name = process.argv[2];
const lib = libraries[name];
if (!lib) throw new Error(`Unknown submodule: ${name}`);
// Reuse only a completed successful CI result for the exact clean library pin.
// Audit advisories are time-dependent and always checked again. The app's
// check:secrets still scans all histories, and its integration tests always run.
// Only asked, not restored: install already put the library's build in place,
// and `pnpm verify` runs this beside steps that read it.
const verified = process.env.CI === "true" && await restore(lib.repository, path.join(root, "packages", name), "build", { write: false });
// A verified pin needs only the audit, which reads the dependency tree: no build scripts.
isolated(name, (_dir, run) => run(verified ? "check:audit" : "check:quality"), { scripts: !verified });
