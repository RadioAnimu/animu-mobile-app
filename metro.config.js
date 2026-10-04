// Learn more https://docs.expo.io/guides/customizing-metro
const path = require("node:path");
const { getDefaultConfig } = require("expo/metro-config");

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// react-native-airwave is the packages/react-native-airwave submodule, consumed
// from source: its `react-native-airwave-source` export condition points at
// src/ (there is no build step; lib/ is not in git).
config.resolver.unstable_conditionNames = [
  ...(config.resolver.unstable_conditionNames ?? []),
  "react-native-airwave-source",
];

// Never resolve into the submodule's own installs or example apps (present
// after `check:airwave` or local Airwave work): they hold a second react-native.
const airwave = path.join(__dirname, "packages", "react-native-airwave");
const escape = (p) => p.replace(/[/\\^$.*+?()[\]{}|-]/g, "\\$&");
const blocked = new RegExp(
  `^${escape(airwave)}[/\\\\](node_modules|example|example-expo|lib)[/\\\\].*$`,
);
const { blockList } = config.resolver;
config.resolver.blockList = [
  ...(Array.isArray(blockList) ? blockList : blockList ? [blockList] : []),
  blocked,
];

module.exports = config;
