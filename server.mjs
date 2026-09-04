import { createServer } from 'node:http';
import { createReadStream, existsSync } from 'node:fs';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { createHash, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';

const port = Number(process.env.PORT || 4173), root = new URL('.', import.meta.url).pathname;
const dataDir = process.env.DATA_DIR || join(root, 'data'), dataFile = join(dataDir, 'shared-dashboard.json');
const blank = { dataset: null, datasetVersion: '', updatedAt: '', shares: [] };
await mkdir(dataDir, { recursive: true });
const load = async () => { try { return { ...blank, ...JSON.parse(await readFile(dataFile, 'utf8')) }; } catch { return structuredClone(blank); } };
const save = async (state) => { const temporary = `${dataFile}.${process.pid}.tmp`; await writeFile(temporary, JSON.stringify(state)); await rename(temporary, dataFile); };
const hash = (token) => createHash('sha256').update(token).digest('hex');
const secureEqual = (a = '', b = '') => { const left = Buffer.from(a), right = Buffer.from(b); return left.length === right.length && timingSafeEqual(left, right); };
const send = (res, status, value) => { res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }); res.end(JSON.stringify(value)); };
const body = async (req) => { const chunks = []; for await (const chunk of req) chunks.push(chunk); if (Buffer.concat(chunks).length > 50_000_000) throw new Error('too_large'); return JSON.parse(Buffer.concat(chunks).toString() || '{}'); };
const authorized = (req) => Boolean(process.env.DASHBOARD_ADMIN_TOKEN) && secureEqual(req.headers.authorization?.replace(/^Bearer /, ''), process.env.DASHBOARD_ADMIN_TOKEN);

createServer(async (req, res) => {
  try {
    const url = new URL(req.url || '/', `http://${req.headers.host}`), path = url.pathname;
    if (path.startsWith('/api/admin/') && !authorized(req)) return send(res, 401, { error: 'unauthorized' });
    if (req.method === 'PUT' && path === '/api/admin/dataset') {
      const { dataset } = await body(req); if (!dataset?.stock || !dataset?.sources) return send(res, 400, { error: 'invalid_dataset' });
      const state = await load(), updatedAt = new Date().toISOString(), datasetVersion = randomUUID();
      await save({ ...state, dataset, updatedAt, datasetVersion }); return send(res, 200, { updatedAt, datasetVersion });
    }
    if (path === '/api/admin/shares' && req.method === 'GET') {
      const state = await load(); return send(res, 200, state.shares.map(({ tokenHash, token, ...share }) => ({ ...share, urlToken: token })));
    }
    if (path === '/api/admin/shares' && req.method === 'POST') {
      const input = await body(req), token = randomBytes(32).toString('base64url'), share = { id: randomUUID(), token, tokenHash: hash(token), name: String(input.name || ''), isActive: true, createdAt: new Date().toISOString(), expiresAt: input.expiresAt || null, filters: input.filters || {}, allowDownloads: Boolean(input.allowDownloads) };
      const state = await load(); await save({ ...state, shares: [share, ...state.shares] }); const { tokenHash, ...publicShare } = share; return send(res, 201, { ...publicShare, token });
    }
    const adminMatch = path.match(/^\/api\/admin\/shares\/([^/]+)$/);
    if (adminMatch && req.method === 'DELETE') { const state = await load(), share = state.shares.find((item) => item.id === adminMatch[1]); if (!share) return send(res, 404, { error: 'not_found' }); share.isActive = false; await save(state); return send(res, 200, { ok: true }); }
    const shareMatch = path.match(/^\/api\/share\/([^/]+)$/);
    if (shareMatch && req.method === 'GET') {
      const state = await load(), share = state.shares.find((item) => secureEqual(item.tokenHash, hash(shareMatch[1])));
      if (!share) return send(res, 404, { error: 'not_found' });
      if (!share.isActive || (share.expiresAt && Date.parse(share.expiresAt) <= Date.now())) return send(res, 410, { error: 'revoked' });
      if (!state.dataset) return send(res, 200, { share: safeShare(share), dataset: null, datasetVersion: state.datasetVersion, updatedAt: state.updatedAt });
      return send(res, 200, { share: safeShare(share), dataset: publicDataset(state.dataset), datasetVersion: state.datasetVersion, updatedAt: state.updatedAt });
    }
    if (path.startsWith('/api/')) return send(res, 404, { error: 'not_found' });
    const requested = normalize(path).replace(/^(\.\.(\/|\\|$))+/, ''), candidate = join(root, 'dist', requested === '/' ? 'index.html' : requested);
    const file = existsSync(candidate) && !candidate.endsWith('/') ? candidate : join(root, 'dist', 'index.html');
    const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml' }; res.writeHead(200, { 'content-type': types[extname(file)] || 'application/octet-stream' }); createReadStream(file).pipe(res);
  } catch (error) { send(res, error.message === 'too_large' ? 413 : 500, { error: 'server_error' }); }
}).listen(port, () => console.log(`AVV listening on ${port}`));
function safeShare({ tokenHash, token, ...share }) { return share; }
function publicDataset(dataset) {
  return {
    schemaVersion: dataset.schemaVersion,
    dateReimportRequired: Boolean(dataset.dateReimportRequired),
    stock: dataset.stock.map(({ original, ...material }) => material),
    representatives: (dataset.representatives || []).map(({ linha, nome, ativo }) => ({ id: '', linha, nome, ativo, empresa: '', email: '', telefone: '', whatsapp: '', observacoes: '' })),
    treatments: Object.fromEntries(Object.entries(dataset.treatments || {}).map(([id, treatment]) => [id, { stockId: '', status: treatment.status, representante: '', primeiroContato: '', ultimoContato: '', responsavel: '', proximaAcao: '', dataProximaAcao: '', resultado: '', history: [] }])),
    imports: [],
    sources: dataset.sources,
  };
}
