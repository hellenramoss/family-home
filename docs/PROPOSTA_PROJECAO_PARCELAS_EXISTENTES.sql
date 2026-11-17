-- Aplicado em 17/11/2026. Projetar somente parcelas remanescentes identificáveis.
create or replace function public.finance_project_legacy_installments(fid uuid, source_month date)
returns integer language plpgsql security definer set search_path='' as $function$
declare r record; invoice uuid; plan uuid; remain integer; cents bigint; j integer; created integer:=0; family_account uuid;
begin
 if fid is null or source_month is null or source_month<>date_trunc('month',source_month)::date or not public.finance_allowed(fid,null) then raise exception 'Acesso negado'; end if;
 perform pg_advisory_xact_lock(hashtextextended(fid::text||':legacy-projection:'||source_month::text,0));
 if (select count(*) from public.finance_transactions where family_id=fid and owner_id is null and title='Cartão Nubank' and competence=source_month and direction='expense')<>1 then raise exception 'Fatura de origem ausente ou duplicada'; end if;
 select id,account_id into invoice,family_account from public.finance_transactions where family_id=fid and owner_id is null and title='Cartão Nubank' and competence=source_month and direction='expense' order by id limit 1;
 if invoice is null then raise exception 'Fatura de origem não encontrada'; end if;
 for r in
  with src as (
   select 'family'::text as source_kind,l.id,l.title,l.amount,coalesce(l.allocation,'family') as allocation,l.category,l.installment_label as label
   from public.finance_card_lines l where l.statement_transaction_id=invoice and l.installment_plan_id is null
   union all
   select 'personal',p.id,p.description,p.amount,p.person,p.note,p.installment
   from public.finance_nubank_personal_import p where p.family_id=fid and p.month=source_month
  ), parsed as (select *,regexp_match(lower(trim(label)),'^([0-9]+)\s*(?:de|/)\s*([0-9]+)$') as parsed_label from src)
  select * from parsed where parsed_label is not null and parsed_label[1]::integer>0 and parsed_label[1]::integer<parsed_label[2]::integer
 loop
  remain:=r.parsed_label[2]::integer-r.parsed_label[1]::integer;
  if remain>360 or r.amount is null or r.amount<0 or r.allocation not in ('family','hellen','karina') then raise exception 'Parcela de origem necessita revisão'; end if;
  cents:=ceil(r.amount*100)::bigint;
  plan:=md5('family-home-legacy-v1:'||r.source_kind||':'||r.id::text)::uuid;
  if exists(select 1 from public.finance_installment_plans p where p.id=plan) then
   if not exists(select 1 from public.finance_installment_plans p where p.id=plan and p.family_id=fid and p.account_id=family_account and p.title=btrim(r.title) and p.total_amount=cents::numeric*remain/100 and p.installment_count=remain and p.first_competence=(source_month+interval '1 month')::date and p.allocation is not distinct from r.allocation and p.category is not distinct from nullif(btrim(r.category),'')) then raise exception 'Projeção existente diverge da origem'; end if;
   continue;
  end if;
  -- Não sobrepor lançamentos futuros já cadastrados, mesmo que a origem seja distinta.
  if exists(select 1 from public.finance_card_lines l where l.family_id=fid and l.account_id=family_account
      and l.competence>source_month and l.competence<=(source_month+remain*interval '1 month')::date
      and lower(btrim(l.title))=lower(btrim(r.title)) and l.amount=cents::numeric/100
      and coalesce(l.allocation,'family')=r.allocation) then raise exception 'Possível compra futura duplicada; revisão necessária'; end if;
  perform public.finance_create_installment_plan(plan,invoice,r.title,cents*remain,remain,(source_month+interval '1 month')::date,r.allocation,r.category);
  for j in 1..remain loop
   update public.finance_card_lines set installment_label=(r.parsed_label[1]::integer+j)::text||' de '||r.parsed_label[2],payment_due_date=null where installment_plan_id=plan and installment_number=j;
  end loop;
  update public.finance_installment_plans set notes='Projeção das parcelas restantes; total original e dia do pagamento desconhecidos.',first_payment_date=null where id=plan;
  created:=created+1;
 end loop;
 return created;
end $function$;
revoke all on function public.finance_project_legacy_installments(uuid,date) from public,anon;
grant execute on function public.finance_project_legacy_installments(uuid,date) to authenticated;
