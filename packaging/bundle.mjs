import { copyFileSync, cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { execSync } from 'node:child_process';

// Pinned runtime: must satisfy package.json engines (>=24.0.0 <25).
const NODE_VERSION = '24.13.0';
const root = resolve(process.argv[2] ?? process.cwd());
const out = resolve(root, 'release/AVLON-DRISHTI');
const nodeDir = resolve(out, 'node');

async function download(url, dest) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Download failed: ${url} (${res.status})`);
  writeFileSync(dest, Buffer.from(await res.arrayBuffer()));
  console.log(`Downloaded ${url}`);
}

mkdirSync(out, { recursive: true });
execSync('npm run build', { cwd: root, stdio: 'inherit' });
for (const d of ['dist', 'scenarios', 'schemas', 'docs']) cpSync(resolve(root, d), resolve(out, d), { recursive: true });
for (const f of ['package.json', 'package-lock.json', 'README.md', 'explain.md', 'PROJECT_SPEC.md']) {
  if (existsSync(resolve(root, f))) copyFileSync(resolve(root, f), resolve(out, f));
}

// Vendor the Node runtime so the folder runs offline with zero prerequisites.
// dist/server.cjs is fully bundled by esbuild — no node_modules needed at runtime.
if (!existsSync(resolve(nodeDir, process.platform === 'win32' ? 'node.exe' : 'bin/node'))) {
  mkdirSync(nodeDir, { recursive: true });
  if (process.platform === 'win32') {
    const zip = resolve(out, `node-${NODE_VERSION}.zip`);
    await download(`https://nodejs.org/dist/v${NODE_VERSION}/node-v${NODE_VERSION}-win-x64.zip`, zip);
    execSync(`powershell -NoProfile -Command "Expand-Archive -LiteralPath '${zip}' -DestinationPath '${out}' -Force"`, { stdio: 'inherit' });
    const inner = resolve(out, `node-v${NODE_VERSION}-win-x64`);
    cpSync(inner, nodeDir, { recursive: true });
    rmSync(inner, { recursive: true, force: true });
    rmSync(zip, { force: true });
  } else {
    const tar = resolve(out, `node-${NODE_VERSION}.tar.xz`);
    await download(`https://nodejs.org/dist/v${NODE_VERSION}/node-v${NODE_VERSION}-linux-x64.tar.xz`, tar);
    execSync(`tar -xf '${tar}' -C '${out}'`, { stdio: 'inherit' });
    const inner = resolve(out, `node-v${NODE_VERSION}-linux-x64`);
    cpSync(inner, nodeDir, { recursive: true });
    rmSync(inner, { recursive: true, force: true });
    rmSync(tar, { force: true });
  }
} else {
  console.log('Reusing vendored Node runtime.');
}

writeFileSync(resolve(out, 'start-windows.bat'), '@echo off\r\ncd /d %~dp0\r\nif exist ".\\node\\node.exe" (".\\node\\node.exe" ".\\dist\\server.cjs") else (node ".\\dist\\server.cjs")\r\n');
writeFileSync(resolve(out, 'start-linux.sh'), '#!/bin/sh\ncd "$(dirname "$0")"\nif [ -x ./node/bin/node ]; then ./node/bin/node ./dist/server.cjs; else node ./dist/server.cjs; fi\n');
console.log(`Offline bundle ready at ${out} (Node v${NODE_VERSION} vendored). Open http://127.0.0.1:3001 after launch.`);
