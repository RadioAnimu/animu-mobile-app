#!/usr/bin/env node
import { auditDependencies } from "./dependency-audit.mjs";
import { verifySecurityPatch } from "../packages/react-native-anything-player/scripts/check-security-patches.mjs";
try {
  // Registry advisories cannot describe local backports. Prove both installed
  // mitigations before accepting their exact existing dependency paths.
  verifySecurityPatch("braces");
  verifySecurityPatch("node-forge");
  auditDependencies(process.cwd());
}
catch (error) { console.error(error.message); process.exit(1); }
