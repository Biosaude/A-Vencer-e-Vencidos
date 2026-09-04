import { createHash, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const headers = () => ({ apikey: key, authorization: `Bearer ${key}`, 'content-type': 'application/json' });
const hash = value => createHash('sha256').update(value).digest('hex');
const equal = (a = '', b = '') => { const x = Buffer.from(a), y = Buffer.from(b); return x.length === y.length && timingSafeEqual(x, y); };
const admin = req => Boolean(process.env.DASHBOARD_ADMIN_TOKEN) && equal(req.headers.authorization?.replace(/^Bearer /, ''), process.env.DASHBOARD_ADMIN_TOKEN);
const send = (res, status, data) => res.status(status).setHeader('cache-control', 'no-store').json(data);
async function db(path, init = {}) {
  if (!url || !key) throw new Error('missing_supabase_configuration');
  const response = await fetch(`${url}/rest/v1/${path}`, { ...init, headers: { ...headers(), ...init.headers } });
  const value = response.status === 204 ? null : await response.json().catch(() => null);
  if (!response.ok) throw Object.assign(new Error('database_error'), { status: response.status, value });
  return value;
}
const safeShare = row => ({ id: row.id, name: row.name, isActive: row.active, createdAt: row.created_at, expiresAt: row.expires_at, filters: row.filters || {}, allowDownloads: row.allow_downloads });
const material = row => row.payload;
async function currentDataset(filters = {}) {
  const rows = await db('materials?active=eq.true&select=payload&order=created_at.asc');
  let stock = rows.map(material);
  const exact = (value, expected) => !expected || ['Todos', 'Todas'].includes(expected) || value === expected;
  stock = stock.filter(item => exact(item.origemEstoque, filters.origin) && exact(item.linha, filters.line) && exact(item.representante, filters.representative));
  if (filters.uf) stock = stock.filter(item => item.estadoCliente === filters.uf);
  if (filters.query) { const q = String(filters.query).toLocaleLowerCase('pt-BR'); stock = stock.filter(item => [item.codigoProduto,item.descricaoProduto,item.marca,item.loteFabricante,item.loteInterno,item.nomeCliente,item.cidadeCliente].join(' ').toLocaleLowerCase('pt-BR').includes(q)); }
  if (filters.status && filters.status !== 'Todos') stock = stock.filter(item => expiryBand(item.dataValidade) === filters.status);
  const [metadata = [], representatives = [], treatments = [], imports = []] = await Promise.all([
    db('dataset_metadata?select=origin,current_file,updated_at'), db('representatives?select=payload&order=created_at.asc'),
    db('treatments?select=stock_id,payload'), db('imports?status=eq.active&select=id,origin,file_name,created_at,record_count,error_count&order=created_at.desc')
  ]);
  const sources = { INTERNO: { currentFile: '', updatedAt: '' }, CONSIGNADO: { currentFile: '', updatedAt: '' } };
  metadata.forEach(x => { sources[x.origin] = { currentFile: x.current_file, updatedAt: x.updated_at }; });
  return { schemaVersion: 2, dateReimportRequired: false, stock, representatives: representatives.map(x=>x.payload), treatments: Object.fromEntries(treatments.map(x=>[x.stock_id,x.payload])), imports: imports.map(x=>({ id:x.id, origin:x.origin, fileName:x.file_name, date:x.created_at, records:x.record_count, newCount:0, updated:0, maintained:0, missing:0, errors:x.error_count })), sources };
}
function expiryBand(iso) { const [y,m,d] = String(iso||'').split('-').map(Number), days = Math.ceil((Date.UTC(y,m-1,d)-Date.now())/86400000); return days < 0?'Vencido':days<=30?'Até 30 dias':days<=60?'31–60 dias':days<=90?'61–90 dias':days<=180?'91–180 dias':'+180 dias'; }

export default async function handler(req, res) {
  try {
    const path = Array.isArray(req.query.path) ? req.query.path : [req.query.path].filter(Boolean);
    if (path[0] === 'admin' && !admin(req)) return send(res, 401, { error: 'unauthorized' });
    if (req.method === 'GET' && path.join('/') === 'admin/dataset') return send(res, 200, { dataset: await currentDataset() });
    if (req.method === 'PUT' && path.join('/') === 'admin/import') {
      const { origin, dataset, fileName, errors = 0 } = req.body || {};
      if (!['INTERNO','CONSIGNADO'].includes(origin) || !Array.isArray(dataset?.stock) || dataset.stock.some(x=>x.origemEstoque !== origin)) return send(res, 400, { error: 'invalid_import' });
      const result = await db('rpc/replace_material_import', { method:'POST', body:JSON.stringify({ p_import_id:randomUUID(), p_origin:origin, p_file_name:String(fileName||''), p_error_count:Number(errors), p_materials:dataset.stock, p_representatives:dataset.representatives || [], p_treatments:dataset.treatments || {} }) });
      return send(res, 200, result);
    }
    if (req.method === 'GET' && path.join('/') === 'admin/shares') {
      const rows = await db('shared_dashboards?select=id,name,active,created_at,expires_at,allow_downloads,filters&order=created_at.desc');
      return send(res, 200, rows.map(row=>({ ...safeShare(row), urlToken: '' })));
    }
    if (req.method === 'POST' && path.join('/') === 'admin/shares') {
      const token = randomBytes(32).toString('base64url'), input = req.body || {}, row = { id:randomUUID(), token_hash:hash(token), name:String(input.name||''), active:true, expires_at:input.expiresAt||null, allow_downloads:Boolean(input.allowDownloads), filters:input.filters||{} };
      const [created] = await db('shared_dashboards', { method:'POST', headers:{ Prefer:'return=representation' }, body:JSON.stringify(row) });
      return send(res, 201, { ...safeShare(created), token });
    }
    if (req.method === 'DELETE' && path[0] === 'admin' && path[1] === 'shares' && path[2]) { await db(`shared_dashboards?id=eq.${encodeURIComponent(path[2])}`, { method:'PATCH', body:JSON.stringify({active:false}) }); return send(res, 200, {ok:true}); }
    if (req.method === 'GET' && path[0] === 'share' && path[1]) {
      const rows = await db(`shared_dashboards?token_hash=eq.${hash(path[1])}&select=id,name,active,created_at,expires_at,allow_downloads,filters`), share = rows[0];
      if (!share) return send(res,404,{error:'not_found'});
      if (!share.active || (share.expires_at && Date.parse(share.expires_at)<=Date.now())) return send(res,410,{error:'revoked'});
      const dataset = await currentDataset(share.filters || {}), dates = Object.values(dataset.sources).map(x=>x.updatedAt).filter(Boolean).sort();
      dataset.treatments = {};
      dataset.imports = [];
      dataset.representatives = dataset.representatives.map(({ linha, nome, ativo }) => ({ id:'', linha, nome, ativo, empresa:'', email:'', telefone:'', whatsapp:'', observacoes:'' }));
      return send(res,200,{share:safeShare(share),dataset,datasetVersion:dates.at(-1)||'',updatedAt:dates.at(-1)||''});
    }
    return send(res,404,{error:'not_found'});
  } catch (error) { console.error(error); return send(res, error.message === 'missing_supabase_configuration' ? 503 : 500, {error:error.message}); }
}
