/**
 * EAS/monorepo builds expect the mobile app at /mm on the worker.
 * Ensure repo-root/mm points at matchmaker-mobile when missing.
 */
const fs = require('fs');
const path = require('path');

const appDir = path.resolve(__dirname, '..');
const repoRoot = path.resolve(appDir, '..');
const mmPath = path.join(repoRoot, 'mm');
const appName = path.basename(appDir);

if (fs.existsSync(mmPath)) {
  process.exit(0);
}

try {
  fs.symlinkSync(appName, mmPath, 'dir');
  console.log(`Created ${mmPath} -> ${appName}`);
} catch (err) {
  console.warn(`Could not create mm symlink (${err.message}).`);
  process.exit(0);
}
