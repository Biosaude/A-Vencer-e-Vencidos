import type { DB } from './store';

export type ShareFilters = { origin?: string; status?: string; line?: string; representative?: string; query?: string };
export type SharedDashboard = { id: string; token: string; name?: string; isActive: boolean; createdAt: string; expiresAt?: string | null; filters?: ShareFilters; allowDownloads: boolean };
export type SharedPayload = { share: Omit<SharedDashboard, 'token'>; dataset: DB; datasetVersion: string; updatedAt: string };

const json = async <T>(response: Response): Promise<T> => {
  if (!response.ok) throw Object.assign(new Error('request_failed'), { status: response.status, body: await response.json().catch(() => ({})) });
  return response.json() as Promise<T>;
};
export const fetchShared = (token: string) => fetch(`/api/share/${encodeURIComponent(token)}`, { cache: 'no-store' }).then(json<SharedPayload>);
export const fetchAdminDataset = (adminToken: string) => fetch('/api/admin/dataset', { headers: { authorization: `Bearer ${adminToken}` }, cache: 'no-store' }).then(json<{ dataset: DB }>);
export const persistImport = (dataset: DB, origin: 'INTERNO' | 'CONSIGNADO', fileName: string, errors: number, adminToken: string) => fetch('/api/admin/import', { method: 'PUT', headers: { 'content-type': 'application/json', authorization: `Bearer ${adminToken}` }, body: JSON.stringify({ origin, fileName, errors, dataset: { ...dataset, stock: dataset.stock.filter(item => item.origemEstoque === origin) } }) }).then(json<{ importBatchId: string; records: number; updatedAt: string }>);
export const listShares = (adminToken: string) => fetch('/api/admin/shares', { headers: { authorization: `Bearer ${adminToken}` } }).then(json<Array<Omit<SharedDashboard, 'token'> & { urlToken: string }>>);
export const createShare = (input: Pick<SharedDashboard, 'name' | 'expiresAt' | 'filters' | 'allowDownloads'>, adminToken: string) => fetch('/api/admin/shares', { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${adminToken}` }, body: JSON.stringify(input) }).then(json<SharedDashboard>);
export const revokeShare = (id: string, adminToken: string) => fetch(`/api/admin/shares/${encodeURIComponent(id)}`, { method: 'DELETE', headers: { authorization: `Bearer ${adminToken}` } }).then(json<{ ok: boolean }>);
