import * as XLSX from 'xlsx';
import { formatISODateToBrazilian, normalizeLine, normalizeState, normalizeText, parseDate, parseMoney, resolveRepresentative, type Representative, type Stock, type StockOrigin } from './domain';

const aliases: Record<string, keyof Stock> = {
  'produto': 'codigoProduto', 'codigo do produto': 'codigoProduto', 'código do produto': 'codigoProduto',
  'descricao do produto': 'descricaoProduto', 'descrição do produto': 'descricaoProduto',
  'marca': 'marca', 'topico': 'topico', 'tópico': 'topico', 'tipo': 'tipo',
  'linha': 'linha', 'linha de produto': 'linha', 'unidade de negocio': 'linha', 'unidade de negócio': 'linha',
  'registro anvisa': 'registroAnvisa', 'lote fabricante': 'loteFabricante', 'validade': 'dataValidade',
  'quantidade': 'quantidade', 'lt.interno': 'loteInterno', 'lote interno': 'loteInterno', 'local': 'local',
  'dt.conf.estoque': 'dataConferenciaEstoque', 'vr.compra do lote': 'valorCompraLote',
  'vr.do custo medio atual': 'custoMedioAtual', 'vr.do custo médio atual': 'custoMedioAtual', 'vr. ultima compra': 'valorUltimaCompra',
  'tipo documento': 'tipoDocumento', 'tipo de documento': 'tipoDocumento',
  'cliente': 'nomeCliente', 'nome do cliente': 'nomeCliente', 'razao social': 'nomeCliente', 'razão social': 'nomeCliente', 'hospital': 'nomeCliente',
  'cidade': 'cidadeCliente', 'cidade do cliente': 'cidadeCliente', 'municipio': 'cidadeCliente', 'município': 'cidadeCliente',
  'estado': 'estadoCliente', 'estado do cliente': 'estadoCliente', 'uf': 'estadoCliente',
};
const headerKey = (header: string) => header.trim().toLowerCase().replace(/\s+/g, ' ');

export type InvalidRow = { row: number; reasons: string[] };
export type Preview = { fileName: string; origin: StockOrigin; columns: string[]; valid: Stock[]; invalid: InvalidRow[]; duplicates: number; total: number };

export async function parseFile(file: File, representatives: Representative[], origin: StockOrigin): Promise<Preview> {
  const data = await file.arrayBuffer();
  // cellDates=false is intentional: CSV date strings must never be coerced by
  // SheetJS/JavaScript using the ambiguous US MM/DD/YYYY convention.
  const workbook = XLSX.read(data, { type: 'array', cellDates: false, raw: true, codepage: 65001 });
  const worksheet = workbook.Sheets[workbook.SheetNames[0]];
  const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, { defval: '', raw: true });
  const headerRow = XLSX.utils.sheet_to_json<unknown[]>(worksheet, { header: 1, defval: '' })[0] || [];
  const columns = headerRow.map(String).filter((column) => column.trim() && raw.some((row) => normalizeText(row[column])));
  return normalizeRows(raw, representatives, origin, file.name, columns);
}

export function normalizeRows(raw: Record<string, unknown>[], representatives: Representative[], origin: StockOrigin = 'INTERNO', fileName = 'base.csv', columns = Object.keys(raw[0] || {})): Preview {
  const valid: Stock[] = [];
  const invalid: InvalidRow[] = [];
  const seen = new Set<string>();
  let duplicates = 0;
  raw.forEach((source, index) => {
    const row: Partial<Record<keyof Stock, unknown>> = {};
    Object.entries(source).forEach(([header, fieldValue]) => { const alias = aliases[headerKey(header)]; if (alias) row[alias] = fieldValue; });
    const marca = normalizeText(row.marca);
    const marcaMatch = marca.match(/^(\d+)\s*[-–]\s*(.+)$/);
    const marcaCodigo = marcaMatch?.[1] || '';
    const marcaNome = normalizeText(marcaMatch?.[2] || marca).toUpperCase();
    const line = normalizeLine(row.linha, row.topico, row.tipo, row.marca, row.descricaoProduto);
    const validadeOriginalValue = row.dataValidade;
    const dataValidade = parseDate(validadeOriginalValue);
    const validadeOriginal = typeof validadeOriginalValue === 'string'
      ? normalizeText(validadeOriginalValue)
      : dataValidade ? formatISODateToBrazilian(dataValidade) : normalizeText(validadeOriginalValue);
    const base = {
      origemEstoque: origin,
      linha: line.linha,
      linhaCodigo: line.linhaCodigo,
      marcaNome,
      cidadeCliente: normalizeText(row.cidadeCliente),
      estadoCliente: normalizeState(row.estadoCliente),
    };
    const resolution = resolveRepresentative(base, representatives);
    const stock: Stock = {
      id: '', ...base, ...resolution, linhaNome: line.linhaNome,
      codigoProduto: normalizeText(row.codigoProduto), descricaoProduto: normalizeText(row.descricaoProduto),
      marca, marcaCodigo, topico: normalizeText(row.topico), tipo: normalizeText(row.tipo),
      registroAnvisa: normalizeText(row.registroAnvisa), loteFabricante: normalizeText(row.loteFabricante), loteInterno: normalizeText(row.loteInterno),
      dataValidade, validadeOriginal, quantidade: parseMoney(row.quantidade), local: normalizeText(row.local),
      dataConferenciaEstoque: parseDate(row.dataConferenciaEstoque), valorCompraLote: parseMoney(row.valorCompraLote) || 0,
      custoMedioAtual: parseMoney(row.custoMedioAtual), valorUltimaCompra: parseMoney(row.valorUltimaCompra) || 0,
      tipoDocumento: normalizeText(row.tipoDocumento), nomeCliente: normalizeText(row.nomeCliente), original: source,
    };
    stock.id = [origin, stock.codigoProduto, stock.loteFabricante, stock.loteInterno, stock.dataValidade, origin === 'CONSIGNADO' ? stock.nomeCliente : '', origin === 'CONSIGNADO' ? stock.local : ''].join('|');
    const reasons: string[] = [];
    if (!stock.codigoProduto) reasons.push('Produto sem código');
    if (!stock.dataValidade) reasons.push('Validade inexistente ou inválida');
    if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(stock.validadeOriginal) && formatISODateToBrazilian(stock.dataValidade) !== stock.validadeOriginal.split('/').map((part, position) => position < 2 ? part.padStart(2, '0') : part).join('/')) reasons.push('Validade normalizada diverge do CSV');
    if (!Number.isFinite(stock.quantidade) || stock.quantidade < 0) reasons.push('Quantidade inválida');
    if (!Number.isFinite(stock.custoMedioAtual) || stock.custoMedioAtual < 0) reasons.push('Custo inválido');
    if (seen.has(stock.id)) { duplicates += 1; reasons.push('Possível duplicidade'); }
    seen.add(stock.id);
    if (reasons.length) invalid.push({ row: index + 2, reasons }); else valid.push(stock);
  });
  return { fileName, origin, columns, valid, invalid, duplicates, total: raw.length };
}
