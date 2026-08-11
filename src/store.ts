import { initialRepresentatives, resolveRepresentative, type Representative, type Stock, type StockOrigin, type Treatment } from './domain';

export type ImportLog = { id: string; origin: StockOrigin; fileName: string; date: string; records: number; newCount: number; updated: number; maintained: number; missing: number; errors: number };
export type SourceMetadata = { currentFile: string; updatedAt: string };
export type DB = { stock: Stock[]; representatives: Representative[]; treatments: Record<string, Treatment>; imports: ImportLog[]; sources: Record<StockOrigin, SourceMetadata>; currentFile?: string; updatedAt?: string };
const emptySource = (): SourceMetadata => ({ currentFile: '', updatedAt: '' });
const initial: DB = { stock: [], representatives: initialRepresentatives, treatments: {}, imports: [], sources: { INTERNO: emptySource(), CONSIGNADO: emptySource() } };

export const load = (): DB => {
  try {
    const persisted = JSON.parse(localStorage.getItem('expiry-dashboard:v1') || '{}') as Partial<DB>;
    const representatives = persisted.representatives?.length ? persisted.representatives : initialRepresentatives;
    const sources = persisted.sources || { INTERNO: { currentFile: persisted.currentFile || '', updatedAt: persisted.updatedAt || '' }, CONSIGNADO: emptySource() };
    const stock = (persisted.stock || []).map((item) => {
      const migrated = { ...item, origemEstoque: item.origemEstoque || 'INTERNO', linhaCodigo: item.linhaCodigo || '', linhaNome: item.linhaNome || '', tipoDocumento: item.tipoDocumento || '', nomeCliente: item.nomeCliente || '', cidadeCliente: item.cidadeCliente || '', estadoCliente: item.estadoCliente || '' } as Stock;
      return { ...migrated, ...resolveRepresentative(migrated, representatives) };
    });
    return { ...initial, ...persisted, representatives, sources, stock, imports: (persisted.imports || []).map((entry) => ({ ...entry, origin: entry.origin || 'INTERNO' })) };
  } catch { return initial; }
};
export const save = (db: DB) => localStorage.setItem('expiry-dashboard:v1', JSON.stringify(db));

export function mergeImport(db: DB, imported: Stock[], fileName: string, origin: StockOrigin, errors = 0): DB {
  const previousOrigin = db.stock.filter((stock) => stock.origemEstoque === origin);
  const previousById = new Map(previousOrigin.map((stock) => [stock.id, stock]));
  let newCount = 0; let updated = 0; let maintained = 0;
  for (const stock of imported) {
    const previous = previousById.get(stock.id);
    if (!previous) newCount += 1;
    else if (JSON.stringify({ ...previous, original: undefined }) === JSON.stringify({ ...stock, original: undefined })) maintained += 1;
    else updated += 1;
  }
  const importedIds = new Set(imported.map((stock) => stock.id));
  const missing = previousOrigin.filter((stock) => !importedIds.has(stock.id)).length;
  const now = new Date().toISOString();
  return {
    ...db,
    stock: [...db.stock.filter((stock) => stock.origemEstoque !== origin), ...imported],
    sources: { ...db.sources, [origin]: { currentFile: fileName, updatedAt: now } },
    imports: [{ id: crypto.randomUUID(), origin, fileName, date: now, records: imported.length, newCount, updated, maintained, missing, errors }, ...db.imports],
  };
}
