import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { doctorReviews } from "../doctor-reviews.mjs";

const source = "src/screens/Lyrics/PronunciationMenu.tsx";
const id = `${source}::206:13::react-doctor/rn-pressable-shared-value-mutation::3f17dd0a940e3acf9e6cdaa214af00dc0d4e6e1552caa193dc046c06e34bb651`;
test("a reviewed advisory cannot conceal changed code, toolchains, occurrences, or errors", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "doctor-review-"));
  const file = path.join(dir, source);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.copyFileSync(source, file);
  const manifest = { dependencies: { "react-native-reanimated": "4.5.1" } };
  const writeManifest = () => fs.writeFileSync(path.join(dir, "package.json"), JSON.stringify(manifest));
  writeManifest();
  const report = { version: "0.9.18" };
  const diagnostic = { id, severity: "warning" };
  const review = (r = report, d = diagnostic) => doctorReviews(r, [d], dir)[0].reason;
  try {
    assert.ok(review());
    assert.equal(review({ version: "0.9.19" }), null);
    assert.equal(review(report, { ...diagnostic, severity: "error" }), null);
    assert.equal(review(report, { ...diagnostic, id: id + "new occurrence" }), null);
    manifest.dependencies["react-native-reanimated"] = "4.5.2"; writeManifest();
    assert.equal(review(), null);
    manifest.dependencies["react-native-reanimated"] = "4.5.1"; writeManifest();
    fs.appendFileSync(file, "\n// changed press behavior\n");
    assert.equal(review(), null);
    fs.unlinkSync(file);
    assert.equal(review(), null);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
