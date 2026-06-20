import { readFileSync, writeFileSync } from 'node:fs';

const pkg = JSON.parse(readFileSync('package.json', 'utf-8'));
const version = pkg.version;

let cargo = readFileSync('src-tauri/Cargo.toml', 'utf-8');
cargo = cargo.replace(/version\s*=\s*"[^"]+"/, `version = "${version}"`);
writeFileSync('src-tauri/Cargo.toml', cargo);

const conf = JSON.parse(readFileSync('src-tauri/tauri.conf.json', 'utf-8'));
conf.version = version;
writeFileSync('src-tauri/tauri.conf.json', JSON.stringify(conf, null, 2) + '\n');
