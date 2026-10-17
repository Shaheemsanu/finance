create extension if not exists pgcrypto;

create type public.business_role as enum ('owner', 'admin', 'member');
create type public.site_status as enum ('active', 'inactive', 'archived');
create type public.invoice_status as enum ('draft', 'sent', 'partially_paid', 'paid', 'overdue', 'cancelled');
create type public.transaction_kind as enum ('income', 'expense', 'transfer_in', 'transfer_out', 'owner_capital', 'owner_drawing');

create table public.businesses (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 1 and 120),
  default_currency char(3) not null default 'INR',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.business_users (
  business_id uuid not null references public.businesses(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.business_role not null default 'member',
  created_at timestamptz not null default now(),
  primary key (business_id, user_id)
);

create table public.sites (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 120),
  code text not null check (length(trim(code)) between 1 and 12),
  type text not null default 'business',
  description text,
  address jsonb not null default '{}'::jsonb,
  phone text,
  email text,
  currency char(3) not null default 'INR',
  financial_year_start smallint not null default 4 check (financial_year_start between 1 and 12),
  start_date date,
  status public.site_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, id),
  unique (business_id, code)
);

create table public.site_users (
  site_id uuid not null references public.sites(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (site_id, user_id)
);

create or replace function public.is_business_member(target_business uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.business_users bu
    where bu.business_id = target_business and bu.user_id = (select auth.uid())
  );
$$;

create or replace function public.is_business_admin(target_business uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.business_users bu
    where bu.business_id = target_business and bu.user_id = (select auth.uid()) and bu.role in ('owner', 'admin')
  );
$$;

create or replace function public.can_access_site(target_site uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from public.sites s
    join public.business_users bu on bu.business_id = s.business_id
    where s.id = target_site and bu.user_id = (select auth.uid())
      and (bu.role in ('owner', 'admin') or exists (
        select 1 from public.site_users su
        where su.site_id = s.id and su.user_id = (select auth.uid())
      ))
  );
$$;

create or replace function public.can_manage_site(target_site uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.sites s
    where s.id = target_site and public.is_business_admin(s.business_id)
  );
$$;

create or replace function public.create_business(business_name text, business_currency char(3) default 'INR')
returns uuid language plpgsql security definer set search_path = '' as $$
declare new_business_id uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  insert into public.businesses (name, default_currency)
  values (trim(business_name), upper(business_currency)) returning id into new_business_id;
  insert into public.business_users (business_id, user_id, role)
  values (new_business_id, auth.uid(), 'owner');
  return new_business_id;
end;
$$;

create table public.customers (
  id uuid primary key default gen_random_uuid(), site_id uuid not null references public.sites(id) on delete cascade,
  name text not null check (length(trim(name)) > 0), phone text, email text, address jsonb not null default '{}'::jsonb,
  tax_number text, notes text, status text not null default 'active' check (status in ('active','inactive')),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique (site_id, id)
);
create table public.vendors (
  id uuid primary key default gen_random_uuid(), site_id uuid not null references public.sites(id) on delete cascade,
  name text not null check (length(trim(name)) > 0), phone text, email text, address jsonb not null default '{}'::jsonb,
  tax_number text, notes text, status text not null default 'active' check (status in ('active','inactive')),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique (site_id, id)
);
create table public.employees (
  id uuid primary key default gen_random_uuid(), site_id uuid not null references public.sites(id) on delete cascade,
  name text not null check (length(trim(name)) > 0), employee_code text, phone text, email text, designation text,
  joining_date date, salary_type text not null default 'monthly' check (salary_type in ('monthly','hourly','contract')),
  basic_salary numeric(20,2) not null default 0 check (basic_salary >= 0),
  status text not null default 'active' check (status in ('active','inactive','terminated')),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique (site_id, id), unique (site_id, employee_code)
);
create table public.platforms (
  id uuid primary key default gen_random_uuid(), site_id uuid not null references public.sites(id) on delete cascade,
  name text not null check (length(trim(name)) > 0), is_archived boolean not null default false,
  created_at timestamptz not null default now(), unique (site_id, id), unique (site_id, name)
);
create table public.projects (
  id uuid primary key default gen_random_uuid(), site_id uuid not null references public.sites(id) on delete cascade,
  customer_id uuid, name text not null check (length(trim(name)) > 0), description text,
  start_date date, end_date date, budget numeric(20,2) not null default 0 check (budget >= 0),
  status text not null default 'planning' check (status in ('planning','active','completed','cancelled','on_hold')),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique (site_id, id),
  foreign key (site_id, customer_id) references public.customers(site_id, id) on delete set null (customer_id)
);
create table public.expense_categories (
  id uuid primary key default gen_random_uuid(), site_id uuid not null references public.sites(id) on delete cascade,
  name text not null check (length(trim(name)) > 0), is_archived boolean not null default false,
  created_at timestamptz not null default now(), unique (site_id, id), unique (site_id, name)
);
create table public.vehicles (
  id uuid primary key default gen_random_uuid(), site_id uuid not null references public.sites(id) on delete cascade,
  registration_number text not null, vehicle_type text not null, model text, status text not null default 'active' check (status in ('active','inactive')),
  created_at timestamptz not null default now(), unique (site_id, id), unique (site_id, registration_number)
);
create table public.bank_accounts (
  id uuid primary key default gen_random_uuid(), site_id uuid not null references public.sites(id) on delete cascade,
  name text not null check (length(trim(name)) > 0), type text not null check (type in ('bank','cash','upi','other')),
  currency char(3) not null default 'INR', opening_balance numeric(20,2) not null default 0,
  account_number text, status text not null default 'active' check (status in ('active','inactive')),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique (site_id, id),
  check (opening_balance >= 0)
);
create table public.invoices (
  id uuid primary key default gen_random_uuid(), site_id uuid not null references public.sites(id) on delete cascade,
  customer_id uuid not null, project_id uuid, invoice_number text not null,
  invoice_date date not null, due_date date, subtotal numeric(20,2) not null default 0 check (subtotal >= 0),
  discount numeric(20,2) not null default 0 check (discount >= 0), tax numeric(20,2) not null default 0 check (tax >= 0),
  total numeric(20,2) not null check (total >= 0), amount_paid numeric(20,2) not null default 0 check (amount_paid >= 0 and amount_paid <= total),
  status public.invoice_status not null default 'draft', notes text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique (site_id, id), unique (site_id, invoice_number),
  foreign key (site_id, customer_id) references public.customers(site_id, id),
  foreign key (site_id, project_id) references public.projects(site_id, id)
);
create table public.invoice_items (
  id uuid primary key default gen_random_uuid(), site_id uuid not null, invoice_id uuid not null,
  description text not null, quantity numeric(14,4) not null check (quantity > 0), unit_price numeric(20,2) not null check (unit_price >= 0),
  amount numeric(20,2) generated always as (round(quantity * unit_price, 2)) stored,
  foreign key (site_id, invoice_id) references public.invoices(site_id, id) on delete cascade
);
create table public.invoice_payments (
  id uuid primary key default gen_random_uuid(), site_id uuid not null, invoice_id uuid not null,
  account_id uuid, amount numeric(20,2) not null check (amount > 0), payment_date date not null,
  method text, reference text, notes text, created_at timestamptz not null default now(),
  foreign key (site_id, invoice_id) references public.invoices(site_id, id) on delete cascade,
  foreign key (site_id, account_id) references public.bank_accounts(site_id, id)
);
create table public.income (
  id uuid primary key default gen_random_uuid(), site_id uuid not null references public.sites(id) on delete cascade,
  customer_id uuid, project_id uuid, platform_id uuid, invoice_id uuid, account_id uuid,
  transaction_date date not null, gross_amount numeric(20,2) not null check (gross_amount >= 0),
  platform_fee numeric(20,2) not null default 0 check (platform_fee >= 0), other_fee numeric(20,2) not null default 0 check (other_fee >= 0),
  tax_amount numeric(20,2) not null default 0 check (tax_amount >= 0), net_amount numeric(20,2) not null check (net_amount >= 0),
  amount_received numeric(20,2) not null default 0 check (amount_received >= 0 and amount_received <= net_amount),
  payment_method text, reference_number text, description text, notes text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique (site_id, id),
  foreign key (site_id, customer_id) references public.customers(site_id, id),
  foreign key (site_id, project_id) references public.projects(site_id, id),
  foreign key (site_id, platform_id) references public.platforms(site_id, id),
  foreign key (site_id, invoice_id) references public.invoices(site_id, id),
  foreign key (site_id, account_id) references public.bank_accounts(site_id, id)
);
create table public.expenses (
  id uuid primary key default gen_random_uuid(), site_id uuid not null references public.sites(id) on delete cascade,
  category_id uuid, vendor_id uuid, employee_id uuid, project_id uuid, vehicle_id uuid, account_id uuid,
  transaction_date date not null, amount numeric(20,2) not null check (amount >= 0),
  payment_method text, reference_number text, description text, notes text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique (site_id, id),
  foreign key (site_id, category_id) references public.expense_categories(site_id, id),
  foreign key (site_id, vendor_id) references public.vendors(site_id, id),
  foreign key (site_id, employee_id) references public.employees(site_id, id),
  foreign key (site_id, project_id) references public.projects(site_id, id),
  foreign key (site_id, vehicle_id) references public.vehicles(site_id, id),
  foreign key (site_id, account_id) references public.bank_accounts(site_id, id)
);
create table public.bills (
  id uuid primary key default gen_random_uuid(), site_id uuid not null references public.sites(id) on delete cascade,
  vendor_id uuid, bill_number text, bill_date date not null, due_date date,
  total numeric(20,2) not null check (total >= 0), amount_paid numeric(20,2) not null default 0 check (amount_paid >= 0 and amount_paid <= total),
  status text not null default 'pending' check (status in ('pending','partially_paid','paid','overdue','cancelled')),
  created_at timestamptz not null default now(), unique (site_id, id),
  foreign key (site_id, vendor_id) references public.vendors(site_id, id)
);
create table public.bill_items (
  id uuid primary key default gen_random_uuid(), site_id uuid not null, bill_id uuid not null,
  description text not null, quantity numeric(14,4) not null check (quantity > 0), unit_price numeric(20,2) not null check (unit_price >= 0),
  foreign key (site_id, bill_id) references public.bills(site_id, id) on delete cascade
);
create table public.bill_payments (
  id uuid primary key default gen_random_uuid(), site_id uuid not null, bill_id uuid not null, account_id uuid,
  amount numeric(20,2) not null check (amount > 0), payment_date date not null, method text, reference text,
  created_at timestamptz not null default now(),
  foreign key (site_id, bill_id) references public.bills(site_id, id) on delete cascade,
  foreign key (site_id, account_id) references public.bank_accounts(site_id, id)
);
create table public.salary_records (
  id uuid primary key default gen_random_uuid(), site_id uuid not null, employee_id uuid not null,
  salary_month date not null, basic_salary numeric(20,2) not null check (basic_salary >= 0),
  allowance numeric(20,2) not null default 0 check (allowance >= 0), bonus numeric(20,2) not null default 0 check (bonus >= 0),
  deduction numeric(20,2) not null default 0 check (deduction >= 0), net_salary numeric(20,2) not null check (net_salary >= 0),
  payment_date date, payment_status text not null default 'pending' check (payment_status in ('pending','paid')),
  account_id uuid, created_at timestamptz not null default now(),
  foreign key (site_id, employee_id) references public.employees(site_id, id),
  foreign key (site_id, account_id) references public.bank_accounts(site_id, id), unique (site_id, employee_id, salary_month)
);
create table public.bank_transactions (
  id uuid primary key default gen_random_uuid(), site_id uuid not null, account_id uuid not null,
  kind public.transaction_kind not null, amount numeric(20,2) not null check (amount > 0),
  transaction_date date not null, transfer_group uuid, related_entity_type text, related_entity_id uuid,
  description text, created_by uuid not null default auth.uid(), created_at timestamptz not null default now(),
  foreign key (site_id, account_id) references public.bank_accounts(site_id, id),
  check ((kind in ('transfer_in','transfer_out')) = (transfer_group is not null))
);
create table public.attachments (
  id uuid primary key default gen_random_uuid(), site_id uuid not null references public.sites(id) on delete cascade,
  entity_type text not null, entity_id uuid not null, file_name text not null, file_path text not null unique,
  file_type text, created_by uuid not null default auth.uid(), created_at timestamptz not null default now()
);
create table public.recurring_transactions (
  id uuid primary key default gen_random_uuid(), site_id uuid not null references public.sites(id) on delete cascade,
  kind text not null check (kind in ('income','expense','salary')), name text not null,
  amount numeric(20,2) not null check (amount >= 0), frequency text not null check (frequency in ('weekly','monthly','quarterly','yearly')),
  start_date date not null, end_date date, next_run date not null, category_id uuid, account_id uuid,
  status text not null default 'active' check (status in ('active','paused','completed')),
  created_at timestamptz not null default now(),
  foreign key (site_id, category_id) references public.expense_categories(site_id, id),
  foreign key (site_id, account_id) references public.bank_accounts(site_id, id)
);
create table public.audit_logs (
  id uuid primary key default gen_random_uuid(), business_id uuid not null references public.businesses(id) on delete cascade,
  site_id uuid references public.sites(id) on delete set null, actor_id uuid default auth.uid(),
  action text not null, entity_type text not null, entity_id uuid, changes jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index sites_business_id_idx on public.sites(business_id);
create index customers_site_id_idx on public.customers(site_id);
create index vendors_site_id_idx on public.vendors(site_id);
create index employees_site_id_idx on public.employees(site_id);
create index projects_site_id_idx on public.projects(site_id, status);
create index income_site_date_idx on public.income(site_id, transaction_date desc);
create index income_customer_idx on public.income(site_id, customer_id);
create index income_project_idx on public.income(site_id, project_id);
create index expenses_site_date_idx on public.expenses(site_id, transaction_date desc);
create index expenses_project_idx on public.expenses(site_id, project_id);
create index invoices_site_status_idx on public.invoices(site_id, status, due_date);
create index bills_site_status_idx on public.bills(site_id, status, due_date);
create index bank_transactions_account_date_idx on public.bank_transactions(site_id, account_id, transaction_date desc);
create index attachments_site_entity_idx on public.attachments(site_id, entity_type, entity_id);

create view public.account_balances with (security_invoker = true) as
select a.site_id, a.id as account_id, a.name, a.type, a.currency,
  a.opening_balance + coalesce(sum(case
    when bt.kind in ('income','owner_capital','transfer_in') then bt.amount
    when bt.kind in ('expense','owner_drawing','transfer_out') then -bt.amount
    else 0 end), 0) as current_balance
from public.bank_accounts a
left join public.bank_transactions bt on bt.site_id = a.site_id and bt.account_id = a.id
group by a.site_id, a.id, a.name, a.type, a.currency, a.opening_balance;

create or replace function public.refresh_invoice_status()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.status <> 'cancelled' and new.status <> 'draft' then
    new.status := case
      when new.amount_paid >= new.total then 'paid'::public.invoice_status
      when new.amount_paid > 0 then 'partially_paid'::public.invoice_status
      when new.due_date < current_date then 'overdue'::public.invoice_status
      else 'sent'::public.invoice_status
    end;
  end if;
  new.updated_at := now();
  return new;
end;
$$;
create trigger invoices_refresh_status before insert or update of amount_paid, total, due_date, status on public.invoices
for each row execute function public.refresh_invoice_status();

create or replace function public.record_invoice_payment(
  target_site uuid, target_invoice uuid, target_account uuid, payment_amount numeric,
  payment_day date, payment_method text default null, payment_reference text default null
) returns uuid language plpgsql security invoker set search_path = '' as $$
declare invoice_row public.invoices%rowtype; payment_id uuid;
begin
  if payment_amount <= 0 then raise exception 'Payment must be greater than zero'; end if;
  if not public.can_access_site(target_site) then raise exception 'Site access denied' using errcode = '42501'; end if;
  select * into invoice_row from public.invoices
    where id = target_invoice and site_id = target_site for update;
  if not found then raise exception 'Invoice not found'; end if;
  if invoice_row.status in ('cancelled', 'draft') then raise exception 'Draft or cancelled invoices cannot receive payments'; end if;
  if payment_amount > invoice_row.total - invoice_row.amount_paid then raise exception 'Payment exceeds the invoice balance'; end if;
  if target_account is not null and not exists (
    select 1 from public.bank_accounts where id = target_account and site_id = target_site and status = 'active'
  ) then raise exception 'Account does not belong to this site or is inactive'; end if;
  insert into public.invoice_payments(site_id, invoice_id, account_id, amount, payment_date, method, reference)
    values (target_site, target_invoice, target_account, payment_amount, payment_day, payment_method, payment_reference)
    returning id into payment_id;
  update public.invoices set amount_paid = amount_paid + payment_amount where id = target_invoice and site_id = target_site;
  if target_account is not null then
    insert into public.bank_transactions(site_id, account_id, kind, amount, transaction_date, related_entity_type, related_entity_id, description)
      values (target_site, target_account, 'income', payment_amount, payment_day, 'invoice', target_invoice, 'Invoice payment');
  end if;
  return payment_id;
end;
$$;

create or replace function public.enforce_site_access()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if not public.can_access_site(new.site_id) then raise exception 'Site access denied' using errcode = '42501'; end if;
  return new;
end;
$$;

do $$
declare table_name text;
begin
  foreach table_name in array array[
    'customers','vendors','employees','platforms','projects','expense_categories','vehicles','bank_accounts',
    'invoices','invoice_items','invoice_payments','income','expenses','bills','bill_items','bill_payments',
    'salary_records','bank_transactions','attachments','recurring_transactions'
  ] loop
    execute format('create trigger enforce_site_access before insert or update on public.%I for each row execute function public.enforce_site_access()', table_name);
  end loop;
end $$;

alter table public.businesses enable row level security;
alter table public.business_users enable row level security;
alter table public.sites enable row level security;
alter table public.site_users enable row level security;
do $$
declare table_name text;
begin
  foreach table_name in array array[
    'customers','vendors','employees','platforms','projects','expense_categories','vehicles','bank_accounts',
    'invoices','invoice_items','invoice_payments','income','expenses','bills','bill_items','bill_payments',
    'salary_records','bank_transactions','attachments','recurring_transactions'
  ] loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('create policy site_select on public.%I for select to authenticated using (public.can_access_site(site_id))', table_name);
    execute format('create policy site_insert on public.%I for insert to authenticated with check (public.can_access_site(site_id))', table_name);
    execute format('create policy site_update on public.%I for update to authenticated using (public.can_access_site(site_id)) with check (public.can_access_site(site_id))', table_name);
    execute format('create policy site_delete on public.%I for delete to authenticated using (public.can_access_site(site_id))', table_name);
  end loop;
end $$;
create policy business_member_read on public.businesses for select to authenticated using (public.is_business_member(id));
create policy business_member_update on public.businesses for update to authenticated using (public.is_business_admin(id)) with check (public.is_business_admin(id));
create policy business_users_read on public.business_users for select to authenticated using (user_id = (select auth.uid()) or public.is_business_admin(business_id));
create policy sites_member_read on public.sites for select to authenticated using (public.is_business_member(business_id));
create policy sites_admin_write on public.sites for all to authenticated using (public.is_business_admin(business_id)) with check (public.is_business_admin(business_id));
create policy site_users_read on public.site_users for select to authenticated using (user_id = (select auth.uid()) or public.can_access_site(site_id));
create policy site_users_admin_write on public.site_users for all to authenticated using (public.can_manage_site(site_id)) with check (public.can_manage_site(site_id));

alter table public.audit_logs enable row level security;
create policy audit_logs_business_read on public.audit_logs for select to authenticated using (public.is_business_member(business_id));

grant execute on function public.is_business_member(uuid) to authenticated;
grant execute on function public.is_business_admin(uuid) to authenticated;
grant execute on function public.can_access_site(uuid) to authenticated;
grant execute on function public.can_manage_site(uuid) to authenticated;
grant execute on function public.create_business(text, char) to authenticated;
grant execute on function public.record_invoice_payment(uuid, uuid, uuid, numeric, date, text, text) to authenticated;
grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant select on public.account_balances to authenticated;
