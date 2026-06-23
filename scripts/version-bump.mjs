import { readFileSync, writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';

function bumpVersion(version, level) {
  const [major, minor, patch] = version.split('.').map(Number);
  switch (level) {
    case 'major':
      return `${major + 1}.0.0`;
    case 'minor':
      return `${major}.${minor + 1}.0`;
    case 'patch':
    default:
      return `${major}.${minor}.${patch + 1}`;
  }
}

function checkUncommittedChanges() {
  try {
    const output = execSync('git status --porcelain', { encoding: 'utf-8' });
    if (output.trim()) {
      console.error('Error: Uncommitted changes detected. Please commit or stash your changes first.');
      process.exit(1);
    }
  } catch {
    console.error('Error: Failed to check git status. Are you in a git repository?');
    process.exit(1);
  }
}

function main() {
  const level = process.argv[2] || 'patch';
  const validLevels = ['patch', 'minor', 'major'];
  if (!validLevels.includes(level)) {
    console.error(`Error: Invalid version level "${level}". Use: patch, minor, or major`);
    process.exit(1);
  }

  checkUncommittedChanges();

  const pkg = JSON.parse(readFileSync('package.json', 'utf-8'));
  const newVersion = bumpVersion(pkg.version, level);

  pkg.version = newVersion;
  writeFileSync('package.json', `${JSON.stringify(pkg, null, 2)}\n`);

  const cargoLines = readFileSync('src-tauri/Cargo.toml', 'utf-8').split('\n');
  const packageIndex = cargoLines.findIndex(l => l.trim().startsWith('[package]'));
  let versionIndex = -1;
  for (let i = packageIndex + 1; i < cargoLines.length; i++) {
    const line = cargoLines[i];
    if (line.trim().startsWith('[')) break;
    if (/^version\s*=/.test(line)) {
      versionIndex = i;
      break;
    }
  }
  if (versionIndex === -1) {
    console.error('Error: Could not find [package] version in Cargo.toml');
    process.exit(1);
  }
  cargoLines[versionIndex] = cargoLines[versionIndex].replace(
    /(version\s*=\s*)"([^"]+)"/,
    `$1"${newVersion}"`
  );
  writeFileSync('src-tauri/Cargo.toml', cargoLines.join('\n'));

  const conf = JSON.parse(readFileSync('src-tauri/tauri.conf.json', 'utf-8'));
  conf.version = newVersion;
  writeFileSync('src-tauri/tauri.conf.json', `${JSON.stringify(conf, null, 2)}\n`);

  execSync('git add -A', { stdio: 'inherit' });
  execSync(`git commit -m "v${newVersion}"`, { stdio: 'inherit' });
  execSync(`git tag v${newVersion}`, { stdio: 'inherit' });

  console.log(`Bumped to v${newVersion}`);
}

main();
