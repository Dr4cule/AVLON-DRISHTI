# Install — offline-first

Requires Node 24.x (node:sqlite experimental). No Python, Docker required only for container option.

## Dev
```powershell
npm install
npm run dev
# UI http://127.0.0.1:5173  API http://127.0.0.1:3001
```

## Production bundle
```powershell
npm run build
npm start  # serves dist/web + API on 127.0.0.1:3001
```
Env: `PORT HOST DRISHTI_ROOT DRISHTI_DB DRISHTI_DEMO=1/0` (`0`, `false`, `no`, `off` all disable demo data) `DRISHTI_INSTRUCTOR_PASSWORD`.
Demo passwords default `drishti-demo`; set instructor password via env on shared stations.

## Docker
```powershell
docker compose up --build
```

## Portable folder (Windows here; rerun script on Linux for native binary)
```powershell
node packaging/bundle.mjs
release/AVLON-DRISHTI/start-windows.bat   # or start-linux.sh after a Linux run
```
Bundle includes vendored Node v24.13.0 runtime, dist/server.cjs (fully bundled — no node_modules needed), dist/web, scenarios, schemas, docs, package.json + lockfile, README, explain.md, PROJECT_SPEC.md, and both start scripts. Verified by booting the staged bundle and checking API + web health. No internet at runtime; health reports `external_services:0`.

Troubleshoot: port in use → set PORT; DB locked → stop duplicate server; blank UI → run `npm run build` first.
