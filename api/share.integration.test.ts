import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createHash } from 'node:crypto';

const token = 'token-seguro-que-existe-apenas-no-link';
let materials: Array<{ payload: Record<string, unknown> }> = [];

beforeEach(() => {
  process.env.SUPABASE_URL = 'https://database.test';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'server-only';
  global.fetch = vi.fn(async (input: string | URL | Request) => {
    const pathname = new URL(String(input)).pathname;
    if (pathname.endsWith('/shared_dashboards')) return new Response(JSON.stringify([{ id:'share-id', name:'Teste', active:true, created_at:'2026-09-04T12:00:00Z', expires_at:null, allow_downloads:true, filters:{ origin:'INTERNO' }, token_hash:createHash('sha256').update(token).digest('hex') }]));
    if (pathname.endsWith('/materials')) return new Response(JSON.stringify(materials));
    return new Response(JSON.stringify([]));
  }) as typeof fetch;
});
afterEach(() => vi.restoreAllMocks());

describe('link público sem armazenamento do navegador', () => {
  it('consulta a versão central atual com o mesmo token e aplica o escopo no backend', async () => {
    const { default: handler } = await import('./[...path].mjs');
    const request = { method:'GET', query:{ path:['share',token] }, headers:{} };
    const invoke = async () => { let body: unknown; let status = 0; const response = { status(value:number){status=value;return this}, setHeader(){return this}, json(value:unknown){body=value;return this} }; await handler(request, response); return {status, body:body as {dataset:{stock:unknown[]}}}; };
    materials = Array.from({length:561},(_,id)=>({payload:{id:String(id),origemEstoque:'INTERNO',dataValidade:'2027-01-01'}}));
    expect((await invoke()).body.dataset.stock).toHaveLength(561);
    materials = Array.from({length:580},(_,id)=>({payload:{id:String(id),origemEstoque:'INTERNO',dataValidade:'2027-01-01'}}));
    const updated = await invoke();
    expect(updated.status).toBe(200);
    expect(updated.body.dataset.stock).toHaveLength(580);
    expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('/materials?active=eq.true'), expect.anything());
  });
});
