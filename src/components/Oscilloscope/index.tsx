/**
 * Default (web / no platform override) export. Android and iOS resolve their
 * platform-suffixed files through Metro; this keeps TypeScript happy.
 */
export { Oscilloscope } from "./index.android";
