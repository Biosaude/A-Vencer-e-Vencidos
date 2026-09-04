import { describe, expect, it } from 'vitest';
import type { Stock } from './domain';
import { createPdf, createWorkbook, reportRows } from './reports';

const stock = {
  id: '1', origemEstoque: 'CONSIGNADO', codigoProduto: 'P1', descricaoProduto: 'Material', marca: 'Marca', marcaCodigo: '', marcaNome: 'MARCA', linha: 'CRM', linhaCodigo: 'CRM', linhaNome: 'CRM', topico: '', tipo: '', registroAnvisa: '', loteFabricante: '000FAB-A', loteInterno: '000000000000123INT', dataValidade: '2027-12-31', validadeOriginal: '31/12/2027', quantidade: 2, local: 'Hospital', dataConferenciaEstoque: '', valorCompraLote: 0, custoMedioAtual: 10, valorUltimaCompra: 0, tipoDocumento: 'NF', nomeCliente: 'Cliente', cidadeCliente: 'Manaus', estadoCliente: 'AM', representante: 'Representante', representanteOrigem: 'REGRA_PADRAO_LINHA', regraRepresentanteAplicada: 'PADRAO_LINHA', original: {},
} satisfies Stock;

describe('exportações', () => {
  it('mantém os dois lotes independentes e textuais no Excel', () => {
    const output = reportRows([stock])[0];
    expect(output['Lote Fabricante']).toBe('000FAB-A');
    expect(output['Lote Interno']).toBe('000000000000123INT');
    const sheet = createWorkbook([stock]).Sheets.Vencimentos;
    expect(sheet.J2).toMatchObject({ t: 's', v: '000FAB-A', z: '@' });
    expect(sheet.K2).toMatchObject({ t: 's', v: '000000000000123INT', z: '@' });
    expect(sheet['!autofilter']).toBeTruthy();
  });

  it('inclui os cabeçalhos de lote no PDF', () => {
    const pdf = createPdf([stock], 'Teste');
    const rendered = new TextDecoder().decode(new Uint8Array(pdf.output('arraybuffer')));
    expect(rendered).toContain('(Lote) Tj');
    expect(rendered).toContain('(Fabricante) Tj');
    expect(rendered).toContain('Lote Interno');
  });
});
