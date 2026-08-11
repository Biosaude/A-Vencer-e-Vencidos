import { describe, expect, it } from 'vitest';
import { formatISODateToBrazilian, initialRepresentatives, type Stock } from './domain';
import { load, mergeImport, save, type DB } from './store';

const stock = (id: string, origemEstoque: 'INTERNO' | 'CONSIGNADO'): Stock => ({
  id, origemEstoque, codigoProduto: id, descricaoProduto: '', marca: '', marcaCodigo: '', marcaNome: '', linha: 'CRM', linhaCodigo: 'CRM', linhaNome: 'CRM', topico: '', tipo: '', registroAnvisa: '', loteFabricante: '', loteInterno: '', dataValidade: '2026-12-01', validadeOriginal: '01/12/2026', quantidade: 1, local: '', dataConferenciaEstoque: '', valorCompraLote: 0, custoMedioAtual: 10, valorUltimaCompra: 0, tipoDocumento: '', nomeCliente: origemEstoque === 'CONSIGNADO' ? 'Hospital' : '', cidadeCliente: '', estadoCliente: '', representante: 'Everton Assayag', representanteOrigem: 'REGRA_PADRAO_LINHA', regraRepresentanteAplicada: 'PADRAO_LINHA', original: {},
});
const db = (): DB => ({ schemaVersion: 2, dateReimportRequired: false, stock: [stock('interno-antigo', 'INTERNO'), stock('consignado-antigo', 'CONSIGNADO')], representatives: initialRepresentatives, treatments: { preservada: { stockId: 'interno-antigo', status: 'Em negociação', representante: 'Everton Assayag', primeiroContato: '', ultimoContato: '', responsavel: '', proximaAcao: '', dataProximaAcao: '', resultado: '', history: [] } }, imports: [], sources: { INTERNO: { currentFile: '', updatedAt: '' }, CONSIGNADO: { currentFile: '', updatedAt: '' } } });

describe('atualização independente das bases', () => {
  it('atualiza interno sem apagar consignado ou tratativas', () => { const result = mergeImport(db(), [stock('interno-novo', 'INTERNO')], 'interno.csv', 'INTERNO'); expect(result.stock.map((item) => item.id).sort()).toEqual(['consignado-antigo', 'interno-novo']); expect(result.treatments.preservada.status).toBe('Em negociação'); expect(result.imports[0]).toMatchObject({ origin: 'INTERNO', missing: 1, newCount: 1 }); });
  it('atualiza consignado sem apagar interno', () => { const result = mergeImport(db(), [stock('consignado-novo', 'CONSIGNADO')], 'consignado.csv', 'CONSIGNADO'); expect(result.stock.map((item) => item.id).sort()).toEqual(['consignado-novo', 'interno-antigo']); expect(result.sources.CONSIGNADO.currentFile).toBe('consignado.csv'); });
});

describe('persistência de datas corrigidas', () => {
  const storage = new Map<string, string>();
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: (key: string) => storage.get(key) ?? null, setItem: (key: string, value: string) => storage.set(key, value) } });
  it('preserva a data civil ISO e a validade original após JSON', () => { const state = db(); state.stock = [{ ...stock('53710072', 'INTERNO'), dataValidade: '2026-11-08', validadeOriginal: '08/11/2026' }]; save(state); const restored = load().stock[0]; expect(restored.dataValidade).toBe('2026-11-08'); expect(restored.validadeOriginal).toBe('08/11/2026'); expect(formatISODateToBrazilian(restored.dataValidade)).toBe('08/11/2026'); });
  it('invalida bases de schema antigo e preserva tratativas', () => { const legacy = db(); const withoutVersion = structuredClone(legacy) as Partial<DB>; delete withoutVersion.schemaVersion; localStorage.setItem('expiry-dashboard:v1', JSON.stringify(withoutVersion)); const restored = load(); expect(restored.stock).toEqual([]); expect(restored.dateReimportRequired).toBe(true); expect(restored.treatments.preservada.status).toBe('Em negociação'); });
});
