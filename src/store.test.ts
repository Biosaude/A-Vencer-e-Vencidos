import { describe, expect, it } from 'vitest';
import { initialRepresentatives, type Stock } from './domain';
import { mergeImport, type DB } from './store';

const stock = (id: string, origemEstoque: 'INTERNO' | 'CONSIGNADO'): Stock => ({
  id, origemEstoque, codigoProduto: id, descricaoProduto: '', marca: '', marcaCodigo: '', marcaNome: '', linha: 'CRM', linhaCodigo: 'CRM', linhaNome: 'CRM', topico: '', tipo: '', registroAnvisa: '', loteFabricante: '', loteInterno: '', dataValidade: '2026-12-01', quantidade: 1, local: '', dataConferenciaEstoque: '', valorCompraLote: 0, custoMedioAtual: 10, valorUltimaCompra: 0, tipoDocumento: '', nomeCliente: origemEstoque === 'CONSIGNADO' ? 'Hospital' : '', cidadeCliente: '', estadoCliente: '', representante: 'Everton Assayag', representanteOrigem: 'REGRA_PADRAO_LINHA', regraRepresentanteAplicada: 'PADRAO_LINHA', original: {},
});
const db = (): DB => ({ stock: [stock('interno-antigo', 'INTERNO'), stock('consignado-antigo', 'CONSIGNADO')], representatives: initialRepresentatives, treatments: { preservada: { stockId: 'interno-antigo', status: 'Em negociação', representante: 'Everton Assayag', primeiroContato: '', ultimoContato: '', responsavel: '', proximaAcao: '', dataProximaAcao: '', resultado: '', history: [] } }, imports: [], sources: { INTERNO: { currentFile: '', updatedAt: '' }, CONSIGNADO: { currentFile: '', updatedAt: '' } } });

describe('atualização independente das bases', () => {
  it('atualiza interno sem apagar consignado ou tratativas', () => { const result = mergeImport(db(), [stock('interno-novo', 'INTERNO')], 'interno.csv', 'INTERNO'); expect(result.stock.map((item) => item.id).sort()).toEqual(['consignado-antigo', 'interno-novo']); expect(result.treatments.preservada.status).toBe('Em negociação'); expect(result.imports[0]).toMatchObject({ origin: 'INTERNO', missing: 1, newCount: 1 }); });
  it('atualiza consignado sem apagar interno', () => { const result = mergeImport(db(), [stock('consignado-novo', 'CONSIGNADO')], 'consignado.csv', 'CONSIGNADO'); expect(result.stock.map((item) => item.id).sort()).toEqual(['consignado-novo', 'interno-antigo']); expect(result.sources.CONSIGNADO.currentFile).toBe('consignado.csv'); });
});
