import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";

// This detector asserts that a supported shared-value animation runs on JS.
// Reanimated 4.5.1 mutables.ts schedules the write on UI; valueSetter.ts runs
// the spring's frames there. The rule's canonical guidance calls it advisory
// and requires latency measurements before changing accessible press behavior.
// Retain both diagnostics and the scanner's score. Any source/toolchain change,
// different occurrence, error severity, or additional finding fails closed.
const source = "src/screens/Lyrics/PronunciationMenu.tsx";
const sourceHash = "f1d06ec72a04a5ef59668dff1ca8937548169636c88a980ecf7ebb7ff87d0721";
const ids = new Set([
  `${source}::206:13::react-doctor/rn-pressable-shared-value-mutation::3f17dd0a940e3acf9e6cdaa214af00dc0d4e6e1552caa193dc046c06e34bb651`,
  `${source}::207:13::react-doctor/rn-pressable-shared-value-mutation::b92ba141bf74858b32fc85752067f3a3725c7f9a19e2b0088bed8264414f5d1f`,
]);
export function doctorReviews(report, diagnostics, directory) {
  let matches = false;
  try {
    const manifest = JSON.parse(fs.readFileSync(path.join(directory, "package.json"), "utf8"));
    matches = report.version === "0.9.18" && manifest.dependencies?.["react-native-reanimated"] === "4.5.1" &&
      createHash("sha256").update(fs.readFileSync(path.join(directory, source))).digest("hex") === sourceHash;
  } catch { /* Missing review evidence makes every diagnostic blocking. */ }
  return diagnostics.map(diagnostic => ({
    diagnostic,
    reason: matches && diagnostic.severity === "warning" && ids.has(diagnostic.id)
      ? "Reviewed latency advisory: UI-thread spring verified in Reanimated; no measured latency defect. See docs/REACT_DOCTOR_REVIEWS.md."
      : null,
  }));
}
