// Learn more https://docs.expo.io/guides/customizing-metro
const path = require("node:path");
const { getDefaultConfig } = require("expo/metro-config");

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Never resolve into the submodule's own installs or example apps (present
// after `check:player` or local Airwave work): they hold a second react-native.
const airwave = path.join(__dirname, "packages", "react-native-anything-player");
const escape = (p) => p.replace(/[/\\^$.*+?()[\]{}|-]/g, "\\$&");
const blocked = new RegExp(
  `^${escape(airwave)}[/\\\\](node_modules|example|example-expo|website)[/\\\\].*$`,
);
const { blockList } = config.resolver;
config.resolver.blockList = [
  ...(Array.isArray(blockList) ? blockList : blockList ? [blockList] : []),
  blocked,
];

module.exports = config;
