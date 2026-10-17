create or replace function public.record_financial_transaction(
  target_site uuid,
  transaction_type text,
  transaction_day date,
  transaction_description text,
  amount numeric,
  received_amount numeric default 0,
  source_name text default null,
  category_name text default null,
  target_account uuid default null
) returns uuid language plpgsql security invoker set search_path = '' as $$
declare
  new_transaction_id uuid;
  relation_id uuid;
begin
  if not public.can_access_site(target_site) then
    raise exception 'Site access denied' using errcode = '42501';
  end if;
  if transaction_type not in ('income', 'expense') then
    raise exception 'Transaction type must be income or expense';
  end if;
  if amount <= 0 then raise exception 'Amount must be greater than zero'; end if;
  if transaction_type = 'income' and (received_amount < 0 or received_amount > amount) then
    raise exception 'Received amount must be between zero and the income total';
  end if;
  if transaction_type = 'expense' and received_amount <> 0 then
    raise exception 'Expenses do not accept received amounts';
  end if;
  if target_account is not null and not exists (
    select 1 from public.bank_accounts where id = target_account and site_id = target_site and status = 'active'
  ) then
    raise exception 'Account does not belong to this site or is inactive';
  end if;

  if transaction_type = 'income' then
    if nullif(trim(source_name), '') is not null then
      insert into public.platforms(site_id, name) values (target_site, trim(source_name))
      on conflict (site_id, name) do update set is_archived = false returning id into relation_id;
    end if;
    insert into public.income(site_id, platform_id, account_id, transaction_date, gross_amount, net_amount, amount_received, description)
    values (target_site, relation_id, target_account, transaction_day, amount, amount, received_amount, nullif(trim(transaction_description), ''))
    returning id into new_transaction_id;
    if target_account is not null and received_amount > 0 then
      insert into public.bank_transactions(site_id, account_id, kind, amount, transaction_date, related_entity_type, related_entity_id, description)
      values (target_site, target_account, 'income', received_amount, transaction_day, 'income', new_transaction_id, nullif(trim(transaction_description), ''));
    end if;
  else
    insert into public.expense_categories(site_id, name) values (target_site, coalesce(nullif(trim(category_name), ''), 'Other'))
    on conflict (site_id, name) do update set is_archived = false returning id into relation_id;
    insert into public.expenses(site_id, category_id, account_id, transaction_date, amount, description)
    values (target_site, relation_id, target_account, transaction_day, amount, nullif(trim(transaction_description), ''))
    returning id into new_transaction_id;
    if target_account is not null then
      insert into public.bank_transactions(site_id, account_id, kind, amount, transaction_date, related_entity_type, related_entity_id, description)
      values (target_site, target_account, 'expense', amount, transaction_day, 'expense', new_transaction_id, nullif(trim(transaction_description), ''));
    end if;
  end if;
  return new_transaction_id;
end;
$$;

grant execute on function public.record_financial_transaction(uuid, text, date, text, numeric, numeric, text, text, uuid) to authenticated;
