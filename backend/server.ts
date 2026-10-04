import { resolve } from 'node:path';
import { createApp } from './app';
import { Store } from './store';

const root = resolve(process.env.DRISHTI_ROOT ?? process.cwd());
// Explicit opt-outs only: '0', 'false', 'no', 'off', ''. Unset (or anything else) keeps demo data.
const demoFlag = String(process.env.DRISHTI_DEMO ?? '1').toLowerCase();
const store = new Store(resolve(root, process.env.DRISHTI_DB ?? 'data/drishti.sqlite'), !['0', 'false', 'no', 'off', ''].includes(demoFlag));
const app = createApp(store, resolve(root, 'dist/web'));
const port = Number(process.env.PORT ?? 3001);
const host = process.env.HOST ?? '127.0.0.1';
const server = app.listen(port, host, () => console.log(`AVLON DRISHTI local training station: http://${host}:${port}\nSQLite ready. All assets and models run locally.`));
const stop = () => server.close(() => { store.close(); process.exit(0); });
process.on('SIGINT', stop); process.on('SIGTERM', stop);
