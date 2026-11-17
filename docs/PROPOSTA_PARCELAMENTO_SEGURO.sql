-- Aplicado em 17/11/2026 após validação em banco isolado.
begin;
alter table public.finance_card_lines add column purchase_paid boolean;
alter table public.finance_nubank_personal_import add column purchase_paid boolean;
alter table public.finance_card_lines add column installment_plan_id uuid references public.finance_installment_plans(id);
alter table public.finance_card_lines add column installment_number integer;
alter table public.finance_card_lines add column payment_due_date date;
alter table public.finance_card_lines add constraint finance_card_lines_plan_number_unique unique (installment_plan_id, installment_number);
alter table public.finance_installment_plans add column purchase_type text not null default 'installment' check (purchase_type in ('installment','recurring'));
alter table public.finance_installment_plans add column allocation text check (allocation in ('family','hellen','karina'));
alter table public.finance_installment_plans add column category text;
alter table public.finance_installment_plans add column active boolean not null default true;
alter table public.finance_installment_plans add column first_payment_date date;

create or replace function public.finance_create_installment_plan(
  plan_id uuid, statement_id uuid, purchase_title text, total_cents bigint,
  installments integer, first_month date, assigned_to text, purchase_category text
) returns void language plpgsql security definer set search_path = '' as $function$
declare t record; existing record; new_statement uuid; current_month date; item_cents bigint; i integer;
begin
  if plan_id is null or total_cents is null or installments is null or assigned_to is null
     or total_cents < 0 or total_cents > 99999999999999 or installments not between 1 and 360
     or first_month is null
     or nullif(btrim(purchase_title),'') is null or length(btrim(purchase_title))>240
     or assigned_to not in ('family','hellen','karina') then
    raise exception 'Dados da compra inválidos';
  end if;
  select * into t from public.finance_transactions where id=statement_id;
  if not found or t.title<>'Cartão Nubank' or t.direction<>'expense' or t.owner_id is not null
     or not public.finance_allowed(t.family_id,t.owner_id) then raise exception 'Fatura indisponível'; end if;
  perform pg_advisory_xact_lock(hashtextextended(t.family_id::text || ':' || t.account_id::text,0));
  select * into t from public.finance_transactions where id=statement_id for update;
  if not found or t.title<>'Cartão Nubank' or t.direction<>'expense' or t.owner_id is not null
     or not public.finance_allowed(t.family_id,t.owner_id) then raise exception 'Fatura indisponível'; end if;
  select * into existing from public.finance_installment_plans where id=plan_id;
  if found then
    if existing.family_id<>t.family_id or existing.account_id<>t.account_id or existing.title<>btrim(purchase_title)
       or existing.total_amount<>total_cents::numeric/100 or existing.installment_count<>installments
       or existing.first_competence<>date_trunc('month',first_month)::date or existing.first_payment_date is distinct from first_month or exists(select 1 from public.finance_card_lines l
         where l.installment_plan_id=plan_id and (l.allocation is distinct from assigned_to or l.category is distinct from nullif(btrim(purchase_category),'')))
       or (select count(*) from public.finance_card_lines l where l.installment_plan_id=plan_id)<>installments
       then raise exception 'Identificador da compra em conflito'; end if;
    return;
  end if;
  insert into public.finance_installment_plans(id,family_id,owner_id,account_id,title,total_amount,installment_count,first_competence,first_payment_date,purchase_type,allocation,category)
  values(plan_id,t.family_id,t.owner_id,t.account_id,btrim(purchase_title),total_cents::numeric/100,installments,date_trunc('month',first_month)::date,first_month,'installment',assigned_to,nullif(btrim(purchase_category),''));
  for i in 1..installments loop
    current_month := (date_trunc('month',first_month) + ((i-1) * interval '1 month'))::date;
    if (select count(*) from public.finance_transactions where family_id=t.family_id and owner_id is null and account_id=t.account_id and title='Cartão Nubank' and competence=current_month and direction='expense')>1 then raise exception 'Mais de uma fatura encontrada na competência'; end if;
    select id into new_statement from public.finance_transactions
      where family_id=t.family_id and owner_id is null and account_id=t.account_id and title='Cartão Nubank'
        and competence=current_month and direction='expense' order by id limit 1 for update;
    if not found then
      insert into public.finance_transactions(family_id,owner_id,account_id,title,amount,direction,status,competence,source,category)
      values(t.family_id,null,t.account_id,'Cartão Nubank',0,'expense','planned',current_month,'manual','Cartões') returning id into new_statement;
    end if;
    if exists(select 1 from public.finance_transactions where id=new_statement and payment_status='paid') then raise exception 'Uma das faturas já está marcada como paga'; end if;
    item_cents := total_cents/installments + case when i<=total_cents%installments then 1 else 0 end;
    insert into public.finance_card_lines(family_id,owner_id,account_id,statement_transaction_id,competence,source_sheet,source_row,title,installment_label,amount,allocation,category,installment_plan_id,installment_number,payment_due_date)
    values(t.family_id,null,t.account_id,new_statement,current_month,'plano-'||plan_id::text,i,btrim(purchase_title),i::text||' de '||installments::text,item_cents::numeric/100,assigned_to,nullif(btrim(purchase_category),''),plan_id,i,(first_month+((i-1)*interval '1 month'))::date);
    update public.finance_transactions set amount=amount+item_cents::numeric/100,updated_at=now() where id=new_statement;
  end loop;
end $function$;
revoke all on function public.finance_create_installment_plan(uuid,uuid,text,bigint,integer,date,text,text) from public,anon;
grant execute on function public.finance_create_installment_plan(uuid,uuid,text,bigint,integer,date,text,text) to authenticated;
create or replace function public.finance_ensure_recurring_month(fid uuid,requested_month date)
returns void language plpgsql security definer set search_path='' as $function$
declare p record; statement uuid; inserted uuid; idx integer;
begin
 if fid is null or requested_month is null or requested_month<>date_trunc('month',requested_month)::date
    or not public.finance_allowed(fid,null) then raise exception 'Acesso negado'; end if;
 perform pg_advisory_xact_lock(hashtextextended(fid::text||':recurring',0));
 for p in select * from public.finance_installment_plans where family_id=fid and purchase_type='recurring' and active and first_competence<=requested_month loop
  idx := (extract(year from requested_month)::integer-extract(year from p.first_competence)::integer)*12 + extract(month from requested_month)::integer-extract(month from p.first_competence)::integer+1;
  if exists(select 1 from public.finance_card_lines where installment_plan_id=p.id and installment_number=idx) then continue; end if;
  perform pg_advisory_xact_lock(hashtextextended(fid::text||':'||p.account_id::text,0));
  if (select count(*) from public.finance_transactions where family_id=fid and owner_id is null and account_id=p.account_id and title='Cartão Nubank' and competence=requested_month and direction='expense')>1 then raise exception 'Mais de uma fatura encontrada na competência'; end if;
  select id into statement from public.finance_transactions where family_id=fid and owner_id is null and account_id=p.account_id and title='Cartão Nubank' and competence=requested_month and direction='expense' order by id limit 1 for update;
  if not found then insert into public.finance_transactions(family_id,owner_id,account_id,title,amount,direction,status,competence,source,category) values(fid,null,p.account_id,'Cartão Nubank',0,'expense','planned',requested_month,'recurring','Cartões') returning id into statement; end if;
  if exists(select 1 from public.finance_transactions where id=statement and payment_status='paid') then raise exception 'A fatura recorrente já está marcada como paga'; end if;
  insert into public.finance_card_lines(family_id,owner_id,account_id,statement_transaction_id,competence,source_sheet,source_row,title,installment_label,amount,allocation,category,installment_plan_id,installment_number,payment_due_date)
  values(fid,null,p.account_id,statement,requested_month,'recorrente-'||p.id::text,idx,p.title,'Recorrente',p.total_amount,p.allocation,p.category,p.id,idx,(p.first_payment_date+((idx-1)*interval '1 month'))::date)
  on conflict (installment_plan_id,installment_number) do nothing returning id into inserted;
  if inserted is not null then update public.finance_transactions set amount=amount+p.total_amount,updated_at=now() where id=statement; end if;
 end loop;
end $function$;
revoke all on function public.finance_ensure_recurring_month(uuid,date) from public,anon;
grant execute on function public.finance_ensure_recurring_month(uuid,date) to authenticated;
create or replace function public.finance_create_recurring_purchase(plan_id uuid,statement_id uuid,purchase_title text,amount_cents bigint,first_month date,assigned_to text,purchase_category text)
returns void language plpgsql security definer set search_path='' as $function$
declare t record; existing record;
begin
 if plan_id is null or amount_cents is null or amount_cents<0 or amount_cents>99999999999999 or first_month is null or nullif(btrim(purchase_title),'') is null or length(btrim(purchase_title))>240 or assigned_to is null or assigned_to not in ('family','hellen','karina') then raise exception 'Dados da compra inválidos'; end if;
 select * into t from public.finance_transactions where id=statement_id;
 if not found or t.title<>'Cartão Nubank' or t.direction<>'expense' or t.owner_id is not null or not public.finance_allowed(t.family_id,t.owner_id) then raise exception 'Fatura indisponível'; end if;
 perform pg_advisory_xact_lock(hashtextextended(t.family_id::text||':recurring',0));
 select * into existing from public.finance_installment_plans where id=plan_id;
 if found then
  if existing.family_id<>t.family_id or existing.account_id<>t.account_id or existing.title<>btrim(purchase_title) or existing.total_amount<>amount_cents::numeric/100 or existing.first_payment_date is distinct from first_month or existing.purchase_type<>'recurring' or existing.allocation is distinct from assigned_to or existing.category is distinct from nullif(btrim(purchase_category),'') then raise exception 'Identificador da compra em conflito'; end if;
 else
  insert into public.finance_installment_plans(id,family_id,owner_id,account_id,title,total_amount,installment_count,first_competence,first_payment_date,purchase_type,allocation,category) values(plan_id,t.family_id,null,t.account_id,btrim(purchase_title),amount_cents::numeric/100,600,date_trunc('month',first_month)::date,first_month,'recurring',assigned_to,nullif(btrim(purchase_category),''));
 end if;
 perform public.finance_ensure_recurring_month(t.family_id,date_trunc('month',first_month)::date);
end $function$;
revoke all on function public.finance_create_recurring_purchase(uuid,uuid,text,bigint,date,text,text) from public,anon;
grant execute on function public.finance_create_recurring_purchase(uuid,uuid,text,bigint,date,text,text) to authenticated;
create or replace function public.finance_stop_recurring_purchase(plan_id uuid)
returns void language plpgsql security definer set search_path='' as $function$
declare p record;
begin
 select * into p from public.finance_installment_plans where id=plan_id;
 if not found or p.purchase_type<>'recurring' or not public.finance_allowed(p.family_id,p.owner_id) then raise exception 'Recorrência indisponível'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p.family_id::text||':recurring',0));
 select * into p from public.finance_installment_plans where id=plan_id for update;
 if not found or p.purchase_type<>'recurring' or not public.finance_allowed(p.family_id,p.owner_id) then raise exception 'Recorrência indisponível'; end if;
 update public.finance_installment_plans set active=false where id=plan_id;
end $function$;
revoke all on function public.finance_stop_recurring_purchase(uuid) from public,anon;
grant execute on function public.finance_stop_recurring_purchase(uuid) to authenticated;
create or replace function public.finance_set_invoice_payment(statement_id uuid,is_paid boolean)
returns void language plpgsql security definer set search_path='' as $function$
declare t record;
begin
 select family_id,owner_id,title,direction into t from public.finance_transactions where id=statement_id for update;
 if not found or is_paid is null or t.direction<>'expense' or t.title not like 'Cartão %'
    or not public.finance_allowed(t.family_id,t.owner_id) then raise exception 'Fatura indisponível'; end if;
 update public.finance_transactions set payment_status=case when is_paid then 'paid' else 'unpaid' end,
 paid_on=case when is_paid then current_date else null end,status=case when is_paid then 'posted' else status end,updated_at=now() where id=statement_id;
end $function$;
revoke all on function public.finance_set_invoice_payment(uuid,boolean) from public,anon;
grant execute on function public.finance_set_invoice_payment(uuid,boolean) to authenticated;
commit;
