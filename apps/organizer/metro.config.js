// Expo monorepo setup: Metro must watch the whole workspace and resolve
// packages from both the app's and the root's node_modules, or the workspace
// packages (@mianu/ui, @mianu/types, @mianu/api-client) fail to resolve —
// their symlinks point outside the project root.
// https://docs.expo.dev/guides/monorepos/
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

config.watchFolders = [workspaceRoot];

config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

module.exports = config;
