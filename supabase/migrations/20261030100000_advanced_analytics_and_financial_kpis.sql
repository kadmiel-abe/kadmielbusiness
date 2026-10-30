-- =========================================================================
-- MIGRATION : Module de Statistiques Avancées & Pilotage Financier
-- Date : 2026-10-30
-- Description : 
--   - Index de performance pour les calculs analytiques en temps réel
--   - Fonctions SQL agrégées :
--       * calculate_payment_delay_stats : Délai moyen de règlement (heures/jours)
--       * calculate_revenue_growth : Comparaison CA vs période précédente (MoM)
--       * calculate_payment_methods_breakdown : Répartition Wave / Orange / MTN / Moov
--       * calculate_top_services : Top des prestations les plus rentables
--       * calculate_top_clients : Top des meilleurs clients (volume, CA, ticket moyen)
--       * get_advanced_financial_analytics : Master RPC retournant un JSON complet
-- =========================================================================

begin;

-- 1. Index de performance pour les agrégations temporelles et par opérateur
create index if not exists idx_payments_status_paid_at
  on public.payments (status, paid_at desc)
  where status = 'paye';

create index if not exists idx_payments_status_created_at
  on public.payments (status, created_at desc);

create index if not exists idx_payments_payment_method
  on public.payments (payment_method)
  where payment_method is not null;

create index if not exists idx_payments_service_name
  on public.payments (service_name);


-- 2. Fonction SQL : Délai moyen de paiement (en heures et en jours)
create or replace function public.calculate_payment_delay_stats(
  p_start_date timestamptz default null,
  p_end_date timestamptz default null
)
returns table (
  total_paid_count bigint,
  avg_delay_hours numeric,
  avg_delay_days numeric,
  median_delay_hours numeric,
  min_delay_hours numeric,
  max_delay_hours numeric,
  under_1h_count bigint,
  under_24h_count bigint,
  under_3d_count bigint,
  over_3d_count bigint
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  return query
  with delays as (
    select
      extract(epoch from (coalesce(p.paid_at, p.updated_at) - p.created_at)) / 3600.0 as delay_hours
    from public.payments p
    where p.status = 'paye'
      and (p_start_date is null or coalesce(p.paid_at, p.created_at) >= p_start_date)
      and (p_end_date is null or coalesce(p.paid_at, p.created_at) <= p_end_date)
  )
  select
    count(*)::bigint as total_paid_count,
    coalesce(round(avg(delay_hours)::numeric, 1), 0.0) as avg_delay_hours,
    coalesce(round((avg(delay_hours) / 24.0)::numeric, 1), 0.0) as avg_delay_days,
    coalesce(round(percentile_cont(0.5) within group (order by delay_hours)::numeric, 1), 0.0) as median_delay_hours,
    coalesce(round(min(delay_hours)::numeric, 1), 0.0) as min_delay_hours,
    coalesce(round(max(delay_hours)::numeric, 1), 0.0) as max_delay_hours,
    count(case when delay_hours < 1.0 then 1 end)::bigint as under_1h_count,
    count(case when delay_hours >= 1.0 and delay_hours < 24.0 then 1 end)::bigint as under_24h_count,
    count(case when delay_hours >= 24.0 and delay_hours < 72.0 then 1 end)::bigint as under_3d_count,
    count(case when delay_hours >= 72.0 then 1 end)::bigint as over_3d_count
  from delays;
end;
$$;


-- 3. Fonction SQL : Comparaison du Chiffre d'Affaires avec le mois précédent (MoM)
create or replace function public.calculate_revenue_growth(
  p_reference_date timestamptz default now()
)
returns table (
  current_month_revenue bigint,
  previous_month_revenue bigint,
  difference_amount bigint,
  growth_rate_pct numeric,
  trend_direction text,
  current_month_count bigint,
  previous_month_count bigint
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_cur_start timestamptz;
  v_cur_end timestamptz;
  v_prev_start timestamptz;
  v_prev_end timestamptz;
begin
  -- Délimitation du mois en cours
  v_cur_start := date_trunc('month', p_reference_date);
  v_cur_end   := (date_trunc('month', p_reference_date) + interval '1 month') - interval '1 microsecond';

  -- Délimitation du mois précédent
  v_prev_start := date_trunc('month', p_reference_date - interval '1 month');
  v_prev_end   := (date_trunc('month', p_reference_date) - interval '1 microsecond');

  return query
  with cur_data as (
    select
      coalesce(sum(coalesce(amount_net, montant_net, amount_total, montant_total, 0)), 0)::bigint as rev,
      count(*)::bigint as cnt
    from public.payments
    where status = 'paye'
      and coalesce(paid_at, created_at) >= v_cur_start
      and coalesce(paid_at, created_at) <= v_cur_end
  ),
  prev_data as (
    select
      coalesce(sum(coalesce(amount_net, montant_net, amount_total, montant_total, 0)), 0)::bigint as rev,
      count(*)::bigint as cnt
    from public.payments
    where status = 'paye'
      and coalesce(paid_at, created_at) >= v_prev_start
      and coalesce(paid_at, created_at) <= v_prev_end
  )
  select
    c.rev as current_month_revenue,
    p.rev as previous_month_revenue,
    (c.rev - p.rev)::bigint as difference_amount,
    case
      when p.rev > 0 then round((((c.rev::numeric - p.rev::numeric) / p.rev::numeric) * 100.0), 1)
      when c.rev > 0 then 100.0
      else 0.0
    end as growth_rate_pct,
    case
      when c.rev > p.rev then 'up'
      when c.rev < p.rev then 'down'
      else 'neutral'
    end as trend_direction,
    c.cnt as current_month_count,
    p.cnt as previous_month_count
  from cur_data c
  cross join prev_data p;
end;
$$;


-- 4. Fonction SQL : Répartition Volume & Montant par Moyen de Paiement
create or replace function public.calculate_payment_methods_breakdown(
  p_start_date timestamptz default null,
  p_end_date timestamptz default null
)
returns table (
  operator_code text,
  operator_label text,
  transactions_count bigint,
  volume_percentage numeric,
  total_amount bigint,
  amount_percentage numeric
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  return query
  with normalized_payments as (
    select
      case
        when lower(coalesce(p.payment_method, '')) like '%wave%' then 'wave'
        when lower(coalesce(p.payment_method, '')) like '%orange%' or lower(coalesce(p.payment_method, '')) = 'om' then 'orange'
        when lower(coalesce(p.payment_method, '')) like '%mtn%' or lower(coalesce(p.payment_method, '')) like '%momo%' then 'mtn'
        when lower(coalesce(p.payment_method, '')) like '%moov%' or lower(coalesce(p.payment_method, '')) like '%flooz%' then 'moov'
        else 'wave' -- Standard Mobile Money par défaut
      end as op_code,
      case
        when lower(coalesce(p.payment_method, '')) like '%wave%' then 'Wave'
        when lower(coalesce(p.payment_method, '')) like '%orange%' or lower(coalesce(p.payment_method, '')) = 'om' then 'Orange Money'
        when lower(coalesce(p.payment_method, '')) like '%mtn%' or lower(coalesce(p.payment_method, '')) like '%momo%' then 'MTN MoMo'
        when lower(coalesce(p.payment_method, '')) like '%moov%' or lower(coalesce(p.payment_method, '')) like '%flooz%' then 'Moov Money'
        else 'Wave'
      end as op_name,
      coalesce(p.amount_net, p.montant_net, p.amount_total, p.montant_total, 0)::bigint as amount
    from public.payments p
    where p.status = 'paye'
      and (p_start_date is null or coalesce(p.paid_at, p.created_at) >= p_start_date)
      and (p_end_date is null or coalesce(p.paid_at, p.created_at) <= p_end_date)
  ),
  overall as (
    select
      coalesce(count(*), 0)::numeric as grand_count,
      coalesce(sum(amount), 0)::numeric as grand_amount
    from normalized_payments
  ),
  grouped as (
    select
      op_code,
      op_name,
      count(*)::bigint as cnt,
      sum(amount)::bigint as total_amt
    from normalized_payments
    group by op_code, op_name
  )
  select
    g.op_code as operator_code,
    g.op_name as operator_label,
    g.cnt as transactions_count,
    case when o.grand_count > 0 then round((g.cnt::numeric / o.grand_count) * 100.0, 1) else 0.0 end as volume_percentage,
    g.total_amt as total_amount,
    case when o.grand_amount > 0 then round((g.total_amt::numeric / o.grand_amount) * 100.0, 1) else 0.0 end as amount_percentage
  from grouped g
  cross join overall o
  order by g.total_amt desc;
end;
$$;


-- 5. Fonction SQL : Top des Prestations les Plus Rentables
create or replace function public.calculate_top_services(
  p_limit integer default 5,
  p_start_date timestamptz default null,
  p_end_date timestamptz default null
)
returns table (
  service_name text,
  total_revenue bigint,
  transactions_count bigint,
  revenue_percentage numeric,
  average_ticket bigint
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  return query
  with filtered as (
    select
      coalesce(nullif(btrim(p.service_name), ''), nullif(btrim(p.service), ''), 'Prestation générale') as s_name,
      coalesce(p.amount_net, p.montant_net, p.amount_total, p.montant_total, 0)::bigint as amount
    from public.payments p
    where p.status = 'paye'
      and (p_start_date is null or coalesce(p.paid_at, p.created_at) >= p_start_date)
      and (p_end_date is null or coalesce(p.paid_at, p.created_at) <= p_end_date)
  ),
  overall as (
    select coalesce(sum(amount), 0)::numeric as grand_total from filtered
  ),
  grouped as (
    select
      s_name,
      sum(amount)::bigint as rev,
      count(*)::bigint as cnt
    from filtered
    group by s_name
  )
  select
    g.s_name as service_name,
    g.rev as total_revenue,
    g.cnt as transactions_count,
    case when o.grand_total > 0 then round((g.rev::numeric / o.grand_total) * 100.0, 1) else 0.0 end as revenue_percentage,
    case when g.cnt > 0 then (g.rev / g.cnt)::bigint else 0::bigint end as average_ticket
  from grouped g
  cross join overall o
  order by g.rev desc
  limit p_limit;
end;
$$;


-- 6. Fonction SQL : Top des Meilleurs Clients
create or replace function public.calculate_top_clients(
  p_limit integer default 5,
  p_start_date timestamptz default null,
  p_end_date timestamptz default null
)
returns table (
  client_id uuid,
  client_name text,
  client_phone text,
  client_email text,
  total_revenue bigint,
  transactions_count bigint,
  average_ticket bigint,
  last_payment_at timestamptz,
  avg_delay_hours numeric
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  return query
  with client_payments as (
    select
      coalesce(c.id, p.client_id) as c_id,
      coalesce(c.name, c.nom, p.client_name, 'Client sans nom') as c_name,
      coalesce(c.phone, c.telephone, p.client_phone, '') as c_phone,
      c.email as c_email,
      coalesce(p.amount_net, p.montant_net, p.amount_total, p.montant_total, 0)::bigint as amount,
      coalesce(p.paid_at, p.updated_at, p.created_at) as pay_date,
      extract(epoch from (coalesce(p.paid_at, p.updated_at) - p.created_at)) / 3600.0 as delay_hours
    from public.payments p
    left join public.clients c on c.id = p.client_id
    where p.status = 'paye'
      and (p_start_date is null or coalesce(p.paid_at, p.created_at) >= p_start_date)
      and (p_end_date is null or coalesce(p.paid_at, p.created_at) <= p_end_date)
  ),
  grouped as (
    select
      c_id,
      c_name,
      c_phone,
      c_email,
      sum(amount)::bigint as rev,
      count(*)::bigint as cnt,
      max(pay_date) as last_pay,
      coalesce(round(avg(delay_hours)::numeric, 1), 0.0) as avg_delay
    from client_payments
    group by c_id, c_name, c_phone, c_email
  )
  select
    g.c_id as client_id,
    g.c_name as client_name,
    g.c_phone as client_phone,
    g.c_email as client_email,
    g.rev as total_revenue,
    g.cnt as transactions_count,
    case when g.cnt > 0 then (g.rev / g.cnt)::bigint else 0::bigint end as average_ticket,
    g.last_pay as last_payment_at,
    g.avg_delay as avg_delay_hours
  from grouped g
  order by g.rev desc
  limit p_limit;
end;
$$;


-- 7. Fonction Maîtresse RPC : get_advanced_financial_analytics (retourne un JSON complet)
create or replace function public.get_advanced_financial_analytics(
  p_start_date timestamptz default null,
  p_end_date timestamptz default null
)
returns json
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_delays json;
  v_growth json;
  v_methods json;
  v_services json;
  v_clients json;
  v_result json;
begin
  -- 1. Statistiques de délai
  select row_to_json(d) into v_delays
  from (select * from public.calculate_payment_delay_stats(p_start_date, p_end_date)) d;

  -- 2. Croissance CA MoM
  select row_to_json(g) into v_growth
  from (select * from public.calculate_revenue_growth(coalesce(p_end_date, now()))) g;

  -- 3. Répartition Opérateurs
  select coalesce(json_agg(row_to_json(m)), '[]'::json) into v_methods
  from (select * from public.calculate_payment_methods_breakdown(p_start_date, p_end_date)) m;

  -- 4. Top Services
  select coalesce(json_agg(row_to_json(s)), '[]'::json) into v_services
  from (select * from public.calculate_top_services(6, p_start_date, p_end_date)) s;

  -- 5. Top Clients
  select coalesce(json_agg(row_to_json(c)), '[]'::json) into v_clients
  from (select * from public.calculate_top_clients(6, p_start_date, p_end_date)) c;

  -- Construction du résultat global
  v_result := json_build_object(
    'delay_stats', v_delays,
    'revenue_growth', v_growth,
    'payment_methods', v_methods,
    'top_services', v_services,
    'top_clients', v_clients,
    'generated_at', now()
  );

  return v_result;
end;
$$;

commit;
