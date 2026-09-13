/**
 * Default (web / no platform override) sampler factory. Android and iOS use
 * their platform-suffixed files; this keeps TypeScript and any other platform
 * resolving a real implementation.
 */
export { createVisualizerSampler } from "./visualizer.android";
