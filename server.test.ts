import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { spawn, type ChildProcess } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const port = 43000 + Math.floor(Math.random() * 1000), base = `http://127.0.0.1:${port}`, admin = 'test-admin-secret';
let server: ChildProcess, directory: string;
const auth = { authorization: `Bearer ${admin}`, 'content-type': 'application/json' };
beforeAll(async () => {
  directory = await mkdtemp(join(tmpdir(), 'avv-share-'));
  server = spawn(process.execPath, ['server.mjs'], { env: { ...process.env, PORT: String(port), DATA_DIR: directory, DASHBOARD_ADMIN_TOKEN: admin }, stdio: 'ignore' });
  for (let attempt = 0; attempt < 40; attempt += 1) { try { await fetch(`${base}/api/share/probe`); return; } catch { await new Promise((resolve) => setTimeout(resolve, 50)); } }
  throw new Error('server did not start');
});
afterAll(async () => { server?.kill(); await rm(directory, { recursive: true, force: true }); });

describe('compartilhamento central', () => {
  it('protege escrita, reflete atualizações e bloqueia revogação', async () => {
    expect((await fetch(`${base}/api/admin/dataset`, { method: 'PUT', body: '{}' })).status).toBe(401);
    const dataset = (count: number) => ({ stock: Array.from({ length: count }, (_, id) => ({ id })), sources: { INTERNO: {}, CONSIGNADO: {} } });
    expect((await fetch(`${base}/api/admin/dataset`, { method: 'PUT', headers: auth, body: JSON.stringify({ dataset: dataset(500) }) })).status).toBe(200);
    const created = await (await fetch(`${base}/api/admin/shares`, { method: 'POST', headers: auth, body: JSON.stringify({ allowDownloads: false }) })).json();
    expect(created.token).toMatch(/^[A-Za-z0-9_-]{40,}$/);
    expect((await (await fetch(`${base}/api/share/${created.token}`)).json()).dataset.stock).toHaveLength(500);
    await fetch(`${base}/api/admin/dataset`, { method: 'PUT', headers: auth, body: JSON.stringify({ dataset: dataset(560) }) });
    expect((await (await fetch(`${base}/api/share/${created.token}`)).json()).dataset.stock).toHaveLength(560);
    expect((await fetch(`${base}/api/share/token-invalido`)).status).toBe(404);
    await fetch(`${base}/api/admin/shares/${created.id}`, { method: 'DELETE', headers: auth });
    expect((await fetch(`${base}/api/share/${created.token}`)).status).toBe(410);
  });
});
