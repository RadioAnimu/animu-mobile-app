import { test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { root, scratchBase } from "../submodules.mjs";

test("submodule builds never run inside the application tree", () => {
  assert.equal(scratchBase("/var/tmp"), "/var/tmp");
  assert.equal(scratchBase(path.join(root, "node_modules", ".tmp")), "/tmp");
  assert.equal(scratchBase(root), "/tmp");
  assert.equal(scratchBase(`${root}-sibling`), `${root}-sibling`);
});
