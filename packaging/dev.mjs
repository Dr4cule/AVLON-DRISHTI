import { spawn } from 'node:child_process';
import { resolve } from 'node:path';

const children = [
  spawn(process.execPath, ['--import', 'tsx', 'backend/server.ts'], { cwd: process.cwd(), stdio: 'inherit' }),
  spawn(process.execPath, [resolve('node_modules/vite/bin/vite.js'), '--host', '127.0.0.1'], { cwd: process.cwd(), stdio: 'inherit' }),
];
let stopping = false;
function stop(code = 0) { if (stopping) return; stopping = true; for (const child of children) child.kill(); process.exit(code); }
for (const child of children) child.on('exit', code => stop(code ?? 0));
process.on('SIGINT', () => stop()); process.on('SIGTERM', () => stop());
