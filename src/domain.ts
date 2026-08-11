export type Band = 'Vencido' | 'Até 30 dias' | '31–60 dias' | '61–90 dias' | '91–180 dias' | '+180 dias';
export type StockOrigin = 'INTERNO' | 'CONSIGNADO';
export type RepresentativeSource = 'REGRA_PADRAO_LINHA' | 'REGRA_REGIONAL_CONSIGNADO' | 'NAO_IDENTIFICADO';

export type Stock = {
  id: string;
  origemEstoque: StockOrigin;
  codigoProduto: string;
  descricaoProduto: string;
  marca: string;
  marcaCodigo: string;
  marcaNome: string;
  linha: string;
  linhaCodigo: string;
  linhaNome: string;
  topico: string;
  tipo: string;
  registroAnvisa: string;
  loteFabricante: string;
  loteInterno: string;
  dataValidade: string;
  validadeOriginal: string;
  quantidade: number;
  local: string;
  dataConferenciaEstoque: string;
  valorCompraLote: number;
  custoMedioAtual: number;
  valorUltimaCompra: number;
  tipoDocumento: string;
  nomeCliente: string;
  cidadeCliente: string;
  estadoCliente: string;
  representante: string;
  representanteOrigem: RepresentativeSource;
  regraRepresentanteAplicada: string | null;
  original: Record<string, unknown>;
};

export type Representative = { id: string; linha: string; nome: string; empresa: string; email: string; telefone: string; whatsapp: string; ativo: boolean; observacoes: string };
export type TreatmentEvent = { id: string; date: string; status: string; owner: string; note: string; origemEstoque?: StockOrigin; representante?: string; representanteOrigem?: RepresentativeSource; regraRepresentanteAplicada?: string | null };
export type Treatment = { stockId: string; status: string; representante: string; primeiroContato: string; ultimoContato: string; responsavel: string; proximaAcao: string; dataProximaAcao: string; resultado: string; origemEstoque?: StockOrigin; linha?: string; marca?: string; cliente?: string; cidade?: string; estado?: string; local?: string; history: TreatmentEvent[] };

export const initialRepresentatives: Representative[] = [
  { id: 'pi', linha: 'PI - PERIFERAL INTERVENTION', nome: 'Natália Valente', empresa: '', email: '', telefone: '', whatsapp: '', ativo: true, observacoes: '' },
  { id: 'ic', linha: 'IC - CARDIO INTERVENTIONAL', nome: 'Thânia Vieira', empresa: '', email: '', telefone: '', whatsapp: '', ativo: true, observacoes: '' },
  { id: 'cp', linha: 'CP - CARDIO PULMONAR', nome: 'Welba Lima', empresa: '', email: '', telefone: '', whatsapp: '', ativo: true, observacoes: '' },
  { id: 'crm', linha: 'CRM', nome: 'Everton Assayag', empresa: '', email: '', telefone: '', whatsapp: '', ativo: true, observacoes: '' },
  { id: 'cas', linha: 'CAS', nome: 'Everton Assayag', empresa: '', email: '', telefone: '', whatsapp: '', ativo: true, observacoes: '' },
  { id: 'endo', linha: 'ENDOVASCULAR', nome: 'Fábia Sussuarana', empresa: '', email: '', telefone: '', whatsapp: '', ativo: true, observacoes: '' },
];

export const normalizeText = (value: unknown) => String(value ?? '').replace(/^'/, '').trim().replace(/\s+/g, ' ');
export const normalizeComparable = (value: unknown) => normalizeText(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
export const normalizeState = (value: unknown) => normalizeComparable(value).replace(/[^A-Z]/g, '').slice(0, 2);

export function parseMoney(value: unknown) {
  if (typeof value === 'number') return value;
  let normalized = normalizeText(value).replace(/R\$/gi, '').replace(/\s/g, '');
  if (!normalized) return Number.NaN;
  if (normalized.includes(',')) normalized = normalized.replace(/\./g, '').replace(',', '.');
  return Number(normalized);
}

export function parseDate(value: unknown): string {
  if (value instanceof Date && !Number.isNaN(+value)) return utcISO(value);
  if (typeof value === 'number') return utcISO(new Date(Date.UTC(1899, 11, 30) + value * 86400000));
  const normalized = normalizeText(value);
  let match = normalized.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (match) {
    const day = Number(match[1]);
    const month = Number(match[2]);
    const year = Number(match[3]);
    return isValidCivilDate(year, month, day) ? civilISO(year, month, day) : '';
  }
  match = normalized.match(/^(\d{1,2})\/(\d{4})$/);
  if (match) {
    const month = Number(match[1]);
    const year = Number(match[2]);
    if (month < 1 || month > 12) return '';
    return civilISO(year, month, daysInMonth(year, month));
  }
  match = normalized.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) {
    const year = Number(match[1]); const month = Number(match[2]); const day = Number(match[3]);
    return isValidCivilDate(year, month, day) ? civilISO(year, month, day) : '';
  }
  return '';
}

const civilISO = (year: number, month: number, day: number) => `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
const utcISO = (date: Date) => civilISO(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
const daysInMonth = (year: number, month: number) => new Date(Date.UTC(year, month, 0)).getUTCDate();
const isValidCivilDate = (year: number, month: number, day: number) => year >= 1900 && month >= 1 && month <= 12 && day >= 1 && day <= daysInMonth(year, month);
export function formatISODateToBrazilian(iso: string) { const match = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/); if (!match || !isValidCivilDate(Number(match[1]), Number(match[2]), Number(match[3]))) return '—'; return `${match[3]}/${match[2]}/${match[1]}`; }
export const parseBrazilianDateToISO = parseDate;
export function daysToExpire(iso: string, now = new Date()) { if (!iso) return Number.NaN; const [year, month, day] = iso.split('-').map(Number); return Math.ceil((Date.UTC(year, month - 1, day) - Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())) / 86400000); }
export function band(days: number): Band { return days < 0 ? 'Vencido' : days <= 30 ? 'Até 30 dias' : days <= 60 ? '31–60 dias' : days <= 90 ? '61–90 dias' : days <= 180 ? '91–180 dias' : '+180 dias'; }
export const isRisk = (stock: Stock, now = new Date()) => daysToExpire(stock.dataValidade, now) <= 90;
export const value = (stock: Stock) => stock.quantidade * stock.custoMedioAtual;

export function normalizeLine(...values: unknown[]) {
  const text = values.map(normalizeComparable).join(' ');
  let linhaCodigo = '';
  let linhaNome = '';
  if (/(^|[^A-Z])(ENDOVASCULAR)([^A-Z]|$)/.test(text)) { linhaCodigo = 'ENDOVASCULAR'; linhaNome = 'ENDOVASCULAR'; }
  else if (/(^|[^A-Z])CRM([^A-Z]|$)/.test(text)) { linhaCodigo = 'CRM'; linhaNome = 'CRM'; }
  else if (/(^|[^A-Z])CAS([^A-Z]|$)/.test(text)) { linhaCodigo = 'CAS'; linhaNome = 'CARDIAC ABLATION SOLUTION'; }
  else if (/(^|[^A-Z])(CP|CARDIO PULMONAR)([^A-Z]|$)/.test(text)) { linhaCodigo = 'CP'; linhaNome = 'CARDIO PULMONAR'; }
  else if (/(^|[^A-Z])(IC|CARDIO INTERVENTIONAL)([^A-Z]|$)/.test(text)) { linhaCodigo = 'IC'; linhaNome = 'CARDIO INTERVENTIONAL'; }
  else if (/(^|[^A-Z])(PI|PERIFERAL INTERVENTION|PERIPHERAL INTERVENTION)([^A-Z]|$)/.test(text)) { linhaCodigo = 'PI'; linhaNome = 'PERIFERAL INTERVENTION'; }
  const linha = linhaCodigo === 'IC' ? 'IC - CARDIO INTERVENTIONAL' : linhaCodigo === 'CP' ? 'CP - CARDIO PULMONAR' : linhaCodigo === 'PI' ? 'PI - PERIFERAL INTERVENTION' : linhaCodigo || 'Não identificada';
  return { linha, linhaCodigo, linhaNome };
}
export const identifyLine = (...values: unknown[]) => normalizeLine(...values).linha;
export const representativeFor = (line: string, representatives: Representative[]) => {
  const normalizedLine = normalizeLine(line).linha;
  return representatives.find((representative) => representative.ativo && normalizeLine(representative.linha).linha === normalizedLine)?.nome || '';
};

type ResolutionInput = Pick<Stock, 'origemEstoque' | 'linha' | 'linhaCodigo' | 'marcaNome' | 'cidadeCliente' | 'estadoCliente'>;
type RegionalRule = { id: string; priority: number; state?: string; city?: string; line?: string; brand?: string; representative: string };
export const regionalRepresentativeRules: RegionalRule[] = [
  { id: 'AP_TODOS_MILENI', priority: 100, state: 'AP', representative: 'Mileni Nunes' },
  { id: 'AP_TODOS_MILENI', priority: 100, city: 'MACAPA', representative: 'Mileni Nunes' },
  { id: 'MA_IC_ALEX', priority: 90, state: 'MA', line: 'IC', representative: 'Alex Silveira' },
  { id: 'MA_GORE_ALEX', priority: 90, state: 'MA', brand: 'GORE', representative: 'Alex Silveira' },
  { id: 'MA_MEDTRONIC_CRM_RONEI', priority: 90, state: 'MA', brand: 'MEDTRONIC', line: 'CRM', representative: 'Ronei Gomes' },
  { id: 'MA_MEDTRONIC_CAS_RONEI', priority: 90, state: 'MA', brand: 'MEDTRONIC', line: 'CAS', representative: 'Ronei Gomes' },
  { id: 'MA_MICROPORT_RONEI', priority: 90, state: 'MA', brand: 'MICROPORT', representative: 'Ronei Gomes' },
  { id: 'PI_IC_RONEI', priority: 90, state: 'PI', line: 'IC', representative: 'Ronei Gomes' },
  { id: 'PI_GORE_RONEI', priority: 90, state: 'PI', brand: 'GORE', representative: 'Ronei Gomes' },
  { id: 'PI_MEDTRONIC_CRM_VINICIUS', priority: 90, state: 'PI', brand: 'MEDTRONIC', line: 'CRM', representative: 'Vinicius Andrade' },
  { id: 'PI_MEDTRONIC_CAS_VINICIUS', priority: 90, state: 'PI', brand: 'MEDTRONIC', line: 'CAS', representative: 'Vinicius Andrade' },
  { id: 'TO_IC_RONEI', priority: 90, state: 'TO', line: 'IC', representative: 'Ronei Gomes' },
];

export function resolveRepresentative(material: ResolutionInput, representatives: Representative[]) {
  if (material.origemEstoque === 'CONSIGNADO') {
    const state = normalizeState(material.estadoCliente);
    const city = normalizeComparable(material.cidadeCliente);
    const brand = normalizeComparable(material.marcaNome);
    const code = material.linhaCodigo || normalizeLine(material.linha).linhaCodigo;
    const rule = [...regionalRepresentativeRules].sort((a, b) => b.priority - a.priority).find((candidate) =>
      (!candidate.state || candidate.state === state) && (!candidate.city || candidate.city === city) && (!candidate.line || candidate.line === code) && (!candidate.brand || candidate.brand === brand));
    if (rule) return { representante: rule.representative, representanteOrigem: 'REGRA_REGIONAL_CONSIGNADO' as const, regraRepresentanteAplicada: rule.id };
  }
  const standard = representativeFor(material.linha, representatives);
  return standard
    ? { representante: standard, representanteOrigem: 'REGRA_PADRAO_LINHA' as const, regraRepresentanteAplicada: 'PADRAO_LINHA' }
    : { representante: 'Representante não identificado', representanteOrigem: 'NAO_IDENTIFICADO' as const, regraRepresentanteAplicada: null };
}

export const format = { money: (number: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(number || 0), number: (number: number) => new Intl.NumberFormat('pt-BR').format(number || 0), date: formatISODateToBrazilian, percent: (number: number) => new Intl.NumberFormat('pt-BR', { style: 'percent', maximumFractionDigits: 1 }).format(number || 0) };
