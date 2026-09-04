import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { band, daysToExpire, format, isRisk, value, type Stock, type Treatment } from './domain';

export function reportRows(rows: Stock[], treatments: Record<string, Treatment> = {}) {
  return rows.map((s) => ({
    Origem: s.origemEstoque,
    Status: band(daysToExpire(s.dataValidade)),
    'Dias para vencer': daysToExpire(s.dataValidade),
    Validade: format.date(s.dataValidade),
    Produto: s.codigoProduto,
    Descrição: s.descricaoProduto,
    Marca: s.marcaNome,
    Linha: s.linha,
    Representante: s.representante,
    'Lote Fabricante': String(s.loteFabricante ?? ''),
    'Lote Interno': String(s.loteInterno ?? ''),
    Quantidade: s.quantidade,
    Cliente: s.nomeCliente,
    Cidade: s.cidadeCliente,
    UF: s.estadoCliente,
    Local: s.local,
    'Tipo Documento': s.tipoDocumento,
    'Custo Médio': s.custoMedioAtual,
    'Valor Total': value(s),
    'Situação da Tratativa': treatments[s.id]?.status || 'Não iniciado',
    'Regra representante': s.regraRepresentanteAplicada || '',
  }));
}

export function createWorkbook(rows: Stock[], treatments: Record<string, Treatment> = {}) {
  const worksheet = XLSX.utils.json_to_sheet(reportRows(rows, treatments));
  worksheet['!autofilter'] = { ref: worksheet['!ref'] || 'A1:U1' };
  worksheet['!freeze'] = { xSplit: 0, ySplit: 1, topLeftCell: 'A2', activePane: 'bottomLeft', state: 'frozen' };
  worksheet['!cols'] = Object.keys(reportRows(rows, treatments)[0] || reportRows([], treatments)).map((heading) => ({ wch: Math.min(42, Math.max(12, heading.length + 2)) }));
  for (let row = 2; row <= rows.length + 1; row += 1) {
    for (const column of ['J', 'K']) {
      const cell = worksheet[`${column}${row}`];
      if (cell) { cell.t = 's'; cell.v = String(cell.v ?? ''); cell.z = '@'; }
    }
    for (const column of ['R', 'S']) if (worksheet[`${column}${row}`]) worksheet[`${column}${row}`].z = '[$R$-pt-BR] #,##0.00';
  }
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Vencimentos');
  return workbook;
}

export function exportExcel(rows: Stock[], name: string, treatments: Record<string, Treatment> = {}) {
  XLSX.writeFile(createWorkbook(rows, treatments), `${name}.xlsx`, { cellStyles: true });
}

export function createPdf(rows: Stock[], name: string) {
  const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a3' });
  pdf.setFontSize(16);
  pdf.text('Relatório de Materiais Vencidos e Próximos do Vencimento', 12, 14);
  pdf.setFontSize(9);
  pdf.text(`${name} • Gerado em ${new Date().toLocaleString('pt-BR')} • Valor em risco: ${format.money(rows.filter((stock) => isRisk(stock)).reduce((sum, s) => sum + value(s), 0))}`, 12, 21);
  autoTable(pdf, {
    startY: 26,
    head: [['Produto', 'Descrição', 'Marca', 'Linha', 'Representante', 'Cliente / Hospital', 'Cidade', 'UF', 'Local', 'Lote Fabricante', 'Lote Interno', 'Validade', 'Dias', 'Qtd.', 'Custo médio', 'Valor total', 'Status']],
    body: rows.map((s) => [s.codigoProduto, s.descricaoProduto, s.marcaNome, s.linha, s.representante, s.nomeCliente || '—', s.cidadeCliente || '—', s.estadoCliente || '—', s.local || '—', s.loteFabricante || '—', s.loteInterno || '—', format.date(s.dataValidade), daysToExpire(s.dataValidade), s.quantidade, format.money(s.custoMedioAtual), format.money(value(s)), band(daysToExpire(s.dataValidade))]),
    styles: { fontSize: 7, cellPadding: 1.5, overflow: 'linebreak', valign: 'middle' },
    headStyles: { fillColor: [17, 94, 89], fontSize: 7.5 },
    margin: { top: 12, right: 10, bottom: 12, left: 10 },
    rowPageBreak: 'avoid',
    showHead: 'everyPage',
    columnStyles: { 0: { cellWidth: 20 }, 1: { cellWidth: 35 }, 9: { cellWidth: 22 }, 10: { cellWidth: 22 }, 11: { cellWidth: 18 } },
  });
  return pdf;
}

export function exportPdf(rows: Stock[], name: string) { createPdf(rows, name).save(`${name}.pdf`); }
