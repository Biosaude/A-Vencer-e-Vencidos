export type Band='Vencido'|'Até 30 dias'|'31–60 dias'|'61–90 dias'|'91–180 dias'|'+180 dias';
export type Stock={id:string;codigoProduto:string;descricaoProduto:string;marca:string;marcaCodigo:string;marcaNome:string;topico:string;tipo:string;registroAnvisa:string;loteFabricante:string;loteInterno:string;dataValidade:string;quantidade:number;local:string;dataConferenciaEstoque:string;valorCompraLote:number;custoMedioAtual:number;valorUltimaCompra:number;linha:string;representante:string;original:Record<string,unknown>};
export type Representative={id:string;linha:string;nome:string;empresa:string;email:string;telefone:string;whatsapp:string;ativo:boolean;observacoes:string};
export type TreatmentEvent={id:string;date:string;status:string;owner:string;note:string};
export type Treatment={stockId:string;status:string;representante:string;primeiroContato:string;ultimoContato:string;responsavel:string;proximaAcao:string;dataProximaAcao:string;resultado:string;history:TreatmentEvent[]};
export const initialRepresentatives:Representative[]=[
 {id:'pi',linha:'PI - PERIFERAL INTERVENTION',nome:'Natália Valente',empresa:'',email:'',telefone:'',whatsapp:'',ativo:true,observacoes:''},
 {id:'ic',linha:'IC - CARDIO INTERVENTIONAL',nome:'Thânia Vieira',empresa:'',email:'',telefone:'',whatsapp:'',ativo:true,observacoes:''},
 {id:'cp',linha:'CP - CARDIO PULMONAR',nome:'Welba Lima',empresa:'',email:'',telefone:'',whatsapp:'',ativo:true,observacoes:''},
 {id:'crm',linha:'CRM',nome:'Everton Assayag',empresa:'',email:'',telefone:'',whatsapp:'',ativo:true,observacoes:''},
 {id:'cas',linha:'CAS',nome:'Everton Assayag',empresa:'',email:'',telefone:'',whatsapp:'',ativo:true,observacoes:''},
 {id:'endo',linha:'ENDOVASCULAR',nome:'Fábia Sussuarana',empresa:'',email:'',telefone:'',whatsapp:'',ativo:true,observacoes:''},
];
const clean=(v:unknown)=>String(v??'').replace(/^'/,'').trim().replace(/\s+/g,' ');
export function parseMoney(v:unknown){if(typeof v==='number')return v;let s=clean(v).replace(/R\$/gi,'').replace(/\s/g,'');if(!s)return NaN;if(s.includes(','))s=s.replace(/\./g,'').replace(',','.');return Number(s)}
export function parseDate(v:unknown):string{if(v instanceof Date&&!isNaN(+v))return localISO(v);if(typeof v==='number'){const d=new Date(Date.UTC(1899,11,30)+v*86400000);return localISO(d)}const s=clean(v);let m=s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);if(m){const d=new Date(+m[3],+m[2]-1,+m[1]);return d.getFullYear()==+m[3]&&d.getMonth()==+m[2]-1&&d.getDate()==+m[1]?localISO(d):''}m=s.match(/^(\d{4})-(\d{2})-(\d{2})/);if(m){const d=new Date(+m[1],+m[2]-1,+m[3]);return isNaN(+d)?'':localISO(d)}return ''}
const localISO=(d:Date)=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
export function daysToExpire(iso:string,now=new Date()){if(!iso)return NaN;const [y,m,d]=iso.split('-').map(Number);return Math.ceil((Date.UTC(y,m-1,d)-Date.UTC(now.getFullYear(),now.getMonth(),now.getDate()))/86400000)}
export function band(days:number):Band{return days<0?'Vencido':days<=30?'Até 30 dias':days<=60?'31–60 dias':days<=90?'61–90 dias':days<=180?'91–180 dias':'+180 dias'}
export const isRisk=(s:Stock,now=new Date())=>daysToExpire(s.dataValidade,now)<=90;
export const value=(s:Stock)=>s.quantidade*s.custoMedioAtual;
export function identifyLine(...values:unknown[]){const text=values.map(clean).join(' ').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase();if(/\bENDOVASCULAR\b/.test(text))return'ENDOVASCULAR';if(/\bCRM\b/.test(text))return'CRM';if(/\bCAS\b/.test(text))return'CAS';if(/\b(CP|CARDIO PULMONAR)\b/.test(text))return'CP - CARDIO PULMONAR';if(/\b(IC|CARDIO INTERVENTIONAL)\b/.test(text))return'IC - CARDIO INTERVENTIONAL';if(/\b(PI|PERIFERAL INTERVENTION|PERIPHERAL INTERVENTION)\b/.test(text))return'PI - PERIFERAL INTERVENTION';return'Não identificada'}
export const representativeFor=(line:string,reps:Representative[])=>reps.find(r=>r.ativo&&r.linha===line)?.nome||'Sem representante';
export const format={money:(n:number)=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(n||0),number:(n:number)=>new Intl.NumberFormat('pt-BR').format(n||0),date:(s:string)=>s?s.split('-').reverse().join('/'):'—',percent:(n:number)=>new Intl.NumberFormat('pt-BR',{style:'percent',maximumFractionDigits:1}).format(n||0)};
