begin;

create extension if not exists pgcrypto;

create table public.imports (
  id uuid primary key,
  origin text not null check (origin in ('INTERNO','CONSIGNADO')),
  file_name text not null,
  status text not null check (status in ('processing','active','superseded','failed')),
  record_count integer not null default 0,
  error_count integer not null default 0,
  created_at timestamptz not null default now(),
  activated_at timestamptz
);

create table public.materials (
  row_id bigint generated always as identity primary key,
  id text not null,
  origin text not null check (origin in ('INTERNO','CONSIGNADO')),
  status text,
  original_expiry text,
  normalized_expiry date not null,
  product text,
  description text,
  brand text,
  line text,
  line_code text,
  line_name text,
  representative text,
  representative_source text,
  representative_rule text,
  manufacturer_lot text,
  internal_lot text,
  quantity numeric not null default 0,
  customer text,
  city text,
  state text,
  location text,
  document_type text,
  average_cost numeric not null default 0,
  total_value numeric generated always as (quantity * average_cost) stored,
  import_batch_id uuid not null references public.imports(id) on delete restrict,
  active boolean not null default false,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(import_batch_id, id)
);
create index materials_current_origin_idx on public.materials(origin) where active;
create index materials_current_scope_idx on public.materials(origin, representative, state) where active;

create table public.dataset_metadata (
  origin text primary key check (origin in ('INTERNO','CONSIGNADO')),
  active_import_batch_id uuid references public.imports(id),
  current_file text not null default '',
  updated_at timestamptz not null default now()
);

create table public.shared_dashboards (
  id uuid primary key default gen_random_uuid(),
  token_hash text not null unique check (length(token_hash) = 64),
  name text not null default '',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  expires_at timestamptz,
  allow_downloads boolean not null default false,
  filters jsonb not null default '{}'::jsonb,
  scope text not null default 'current_dataset'
);
create index shared_dashboards_token_hash_idx on public.shared_dashboards(token_hash);

create table public.representatives (id text primary key, payload jsonb not null, created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table public.treatments (stock_id text primary key, payload jsonb not null, updated_at timestamptz not null default now());

alter table public.imports enable row level security;
alter table public.materials enable row level security;
alter table public.dataset_metadata enable row level security;
alter table public.shared_dashboards enable row level security;
alter table public.representatives enable row level security;
alter table public.treatments enable row level security;
-- Nenhuma policy pública: somente a service role das Functions acessa estas tabelas.

create or replace function public.replace_material_import(
  p_import_id uuid, p_origin text, p_file_name text, p_error_count integer,
  p_materials jsonb, p_representatives jsonb default '[]', p_treatments jsonb default '{}'
) returns jsonb language plpgsql security definer set search_path = public as $$
declare item jsonb; rep jsonb; treatment record; imported integer := jsonb_array_length(p_materials);
begin
  if p_origin not in ('INTERNO','CONSIGNADO') or jsonb_typeof(p_materials) <> 'array' or imported = 0 then raise exception 'invalid import'; end if;
  if exists(select 1 from jsonb_array_elements(p_materials) x where x->>'origemEstoque' is distinct from p_origin or coalesce(x->>'id','') = '' or coalesce(x->>'dataValidade','') = '') then raise exception 'invalid material'; end if;
  insert into imports(id,origin,file_name,status,record_count,error_count) values(p_import_id,p_origin,p_file_name,'processing',imported,p_error_count);
  for item in select * from jsonb_array_elements(p_materials) loop
    insert into materials(id,origin,status,original_expiry,normalized_expiry,product,description,brand,line,line_code,line_name,representative,representative_source,representative_rule,manufacturer_lot,internal_lot,quantity,customer,city,state,location,document_type,average_cost,import_batch_id,payload)
    values(item->>'id',p_origin,null,item->>'validadeOriginal',(item->>'dataValidade')::date,item->>'codigoProduto',item->>'descricaoProduto',coalesce(item->>'marcaNome',item->>'marca'),item->>'linha',item->>'linhaCodigo',item->>'linhaNome',item->>'representante',item->>'representanteOrigem',item->>'regraRepresentanteAplicada',item->>'loteFabricante',item->>'loteInterno',coalesce((item->>'quantidade')::numeric,0),item->>'nomeCliente',item->>'cidadeCliente',item->>'estadoCliente',item->>'local',item->>'tipoDocumento',coalesce((item->>'custoMedioAtual')::numeric,0),p_import_id,item - 'original');
  end loop;
  update materials set active=false,updated_at=now() where origin=p_origin and active;
  update imports set status='superseded' where origin=p_origin and status='active';
  update materials set active=true,updated_at=now() where import_batch_id=p_import_id;
  update imports set status='active',activated_at=now() where id=p_import_id;
  insert into dataset_metadata(origin,active_import_batch_id,current_file,updated_at) values(p_origin,p_import_id,p_file_name,now()) on conflict(origin) do update set active_import_batch_id=excluded.active_import_batch_id,current_file=excluded.current_file,updated_at=excluded.updated_at;
  for rep in select * from jsonb_array_elements(p_representatives) loop insert into representatives(id,payload) values(rep->>'id',rep) on conflict(id) do update set payload=excluded.payload,updated_at=now(); end loop;
  for treatment in select key,value from jsonb_each(p_treatments) loop insert into treatments(stock_id,payload) values(treatment.key,treatment.value) on conflict(stock_id) do update set payload=excluded.payload,updated_at=now(); end loop;
  return jsonb_build_object('importBatchId',p_import_id,'origin',p_origin,'records',imported,'updatedAt',now());
end $$;
revoke all on function public.replace_material_import(uuid,text,text,integer,jsonb,jsonb,jsonb) from public, anon, authenticated;
grant execute on function public.replace_material_import(uuid,text,text,integer,jsonb,jsonb,jsonb) to service_role;

commit;
