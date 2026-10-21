#!/usr/bin/env node
/**
 * Stamps app.json with a build number so every CI build is installable over the previous one.
 * Usage: node scripts/set-build-number.js <buildNumber>
 *   - Android versionCode must increase with every build, so it gets the build number.
 *   - iOS buildNumber gets the same value (as a string).
 */
const fs = require('node:fs');
const path = require('node:path');

const build = Number(process.argv[2]);
if (!Number.isInteger(build) || build < 1) {
  console.error('Usage: node scripts/set-build-number.js <positive integer>');
  process.exit(1);
}

const file = path.join(__dirname, '..', 'app.json');
const app = JSON.parse(fs.readFileSync(file, 'utf8'));
app.expo.android = { ...app.expo.android, versionCode: build };
app.expo.ios = { ...app.expo.ios, buildNumber: String(build) };
fs.writeFileSync(file, JSON.stringify(app, null, 2) + '\n');
console.log(`app.json: version ${app.expo.version}, build ${build}`);
