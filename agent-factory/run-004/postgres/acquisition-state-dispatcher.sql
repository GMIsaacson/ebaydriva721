-- Run 004 / SourceMargin acquisition-state dispatcher.
-- Existing private Factory PostgreSQL only. This is transport/observation state,
-- not canonical SourceMargin product state and not Work Control execution state.

create schema if not exists sourcemargin;

create table if not exists sourcemargin.sm_acquisition_dispatch_state (
  route_id uuid primary key,
  cohort_position integer not null,
  route_type text not null,
  route_status text not null,
  is_primary boolean not null,
  active boolean not null,
  state_fingerprint text not null,
  source_updated_at timestamptz,
  last_seen_at timestamptz not null default now(),
  last_execution_id text not null
);

create table if not exists sourcemargin.sm_acquisition_dispatch_events (
  event_id bigserial primary key,
  route_id uuid not null,
  cohort_position integer not null,
  route_type text not null,
  route_status text not null,
  previous_fingerprint text,
  state_fingerprint text not null,
  execution_id text not null,
  observed_at timestamptz not null default now(),
  recommended_work_type text not null,
  approval_required boolean not null default false,
  authority_level text not null check (authority_level in ('Observe','Recommend')),
  external_actions_enabled boolean not null default false check (external_actions_enabled = false),
  spending_authority_cents integer not null default 0 check (spending_authority_cents = 0),
  work_control_dispatch_allowed boolean not null default false check (work_control_dispatch_allowed = false),
  route_mutation_allowed boolean not null default false check (route_mutation_allowed = false),
  work_packet jsonb not null,
  unique(route_id, state_fingerprint)
);

create index if not exists sm_acquisition_dispatch_events_observed_idx
  on sourcemargin.sm_acquisition_dispatch_events(observed_at desc);

create index if not exists sm_acquisition_dispatch_events_route_idx
  on sourcemargin.sm_acquisition_dispatch_events(route_id, observed_at desc);

create or replace function sourcemargin.sm_acquisition_dispatch_observe(
  p_routes jsonb,
  p_execution_id text,
  p_observed_at timestamptz default now()
)
returns table(packet jsonb)
language plpgsql
as $$
declare
  v_state_count integer;
  v_current_count integer;
  v_processed integer := 0;
  v_event_id bigint;
  v_work_type text;
  v_approval_required boolean;
  v_packet jsonb;
  r record;
begin
  if jsonb_typeof(p_routes) is distinct from 'array' then
    raise exception 'acquisition routes payload must be a JSON array';
  end if;
  if coalesce(length(trim(p_execution_id)),0) = 0 then
    raise exception 'execution id is required';
  end if;

  select count(*) into v_current_count
  from jsonb_array_elements(p_routes) x
  where coalesce((x->>'is_primary')::boolean,false)
    and coalesce((x->>'active')::boolean,false);

  if v_current_count > 25 then
    raise exception 'active primary route count exceeds bounded limit: %', v_current_count;
  end if;

  select count(*) into v_state_count
  from sourcemargin.sm_acquisition_dispatch_state;

  -- First live run establishes a baseline only. Existing states are not
  -- treated as newly-triggered work.
  if v_state_count = 0 then
    insert into sourcemargin.sm_acquisition_dispatch_state(
      route_id,cohort_position,route_type,route_status,is_primary,active,
      state_fingerprint,source_updated_at,last_seen_at,last_execution_id
    )
    select
      (x->>'id')::uuid,
      (x->>'cohort_position')::integer,
      lower(x->>'route_type'),
      lower(x->>'route_status'),
      true,
      true,
      md5(concat_ws('|',
        x->>'id',
        lower(coalesce(x->>'route_type','')),
        lower(coalesce(x->>'route_status','')),
        coalesce(x->>'is_primary','false'),
        coalesce(x->>'active','false'),
        coalesce(x->>'target_delivered_cost',''),
        coalesce(x->>'max_hammer_bid',''),
        coalesce(x->>'watch_source_count','0')
      )),
      nullif(x->>'updated_at','')::timestamptz,
      p_observed_at,
      p_execution_id
    from jsonb_array_elements(p_routes) x
    where coalesce((x->>'is_primary')::boolean,false)
      and coalesce((x->>'active')::boolean,false)
    on conflict (route_id) do update
    set cohort_position=excluded.cohort_position,
        route_type=excluded.route_type,
        route_status=excluded.route_status,
        is_primary=excluded.is_primary,
        active=excluded.active,
        state_fingerprint=excluded.state_fingerprint,
        source_updated_at=excluded.source_updated_at,
        last_seen_at=excluded.last_seen_at,
        last_execution_id=excluded.last_execution_id;

    packet := jsonb_build_object(
      'eventType','BASELINE_SYNC',
      'changed',false,
      'activePrimaryRoutes',v_current_count,
      'executionId',p_execution_id,
      'observedAt',p_observed_at,
      'authorityLevel','Observe',
      'control',jsonb_build_object(
        'maxChangedPerRun',3,
        'externalActionsEnabled',false,
        'spendingAuthorityCents',0,
        'workControlDispatchAllowed',false,
        'routeMutationAllowed',false
      )
    );
    return next;
    return;
  end if;

  for r in
    with current_routes as (
      select
        (x->>'id')::uuid as route_id,
        (x->>'cohort_position')::integer as cohort_position,
        x->>'part_number' as part_number,
        x->>'normalized_title' as normalized_title,
        x->>'listing_url' as listing_url,
        lower(x->>'route_type') as route_type,
        lower(x->>'route_status') as route_status,
        nullif(x->>'target_delivered_cost','')::numeric as target_delivered_cost,
        nullif(x->>'max_hammer_bid','')::numeric as max_hammer_bid,
        coalesce((x->>'watch_source_count')::integer,0) as watch_source_count,
        x->>'next_action' as next_action,
        x->>'rationale' as rationale,
        coalesce(x->'evidence_refs','[]'::jsonb) as evidence_refs,
        nullif(x->>'updated_at','')::timestamptz as source_updated_at,
        md5(concat_ws('|',
          x->>'id',
          lower(coalesce(x->>'route_type','')),
          lower(coalesce(x->>'route_status','')),
          coalesce(x->>'is_primary','false'),
          coalesce(x->>'active','false'),
          coalesce(x->>'target_delivered_cost',''),
          coalesce(x->>'max_hammer_bid',''),
          coalesce(x->>'watch_source_count','0')
        )) as state_fingerprint
      from jsonb_array_elements(p_routes) x
      where coalesce((x->>'is_primary')::boolean,false)
        and coalesce((x->>'active')::boolean,false)
    )
    select c.*, s.state_fingerprint as previous_fingerprint
    from current_routes c
    left join sourcemargin.sm_acquisition_dispatch_state s using(route_id)
    where s.route_id is null
       or s.state_fingerprint is distinct from c.state_fingerprint
    order by
      case c.route_status
        when 'buy_ready' then 1
        when 'sample_ready' then 2
        when 'price_trigger_ready' then 3
        when 'watch' then 4
        when 'rfq_ready' then 5
        when 'failed' then 6
        when 'exhausted' then 6
        when 'research' then 7
        else 8
      end,
      c.cohort_position
    limit 3
  loop
    v_approval_required := r.route_status in ('sample_ready','buy_ready');
    v_work_type := case
      when r.route_status='buy_ready' then 'OWNER_BUY_APPROVAL'
      when r.route_status='sample_ready' then 'OWNER_SAMPLE_APPROVAL'
      when r.route_status='price_trigger_ready' then 'PRICE_TRIGGER_MONITOR'
      when r.route_status='watch' then 'SOURCE_WATCH_MONITOR'
      when r.route_status='rfq_ready' then 'RFQ_PACKAGE_REVIEW'
      when r.route_status in ('failed','exhausted') then 'ROUTE_FALLBACK_REVIEW'
      when r.route_status='research' and r.route_type in ('direct_rfq','oem_manufacturer','factory_wholesale','distributor')
        then 'SUPPLIER_RESEARCH'
      when r.route_status='research' and r.route_type in ('liquidation','auction','returns_inventory','closeout_overstock','retail','source_watch','price_trigger')
        then 'EVENT_SOURCE_RESEARCH'
      else 'ACQUISITION_RESEARCH'
    end;

    v_packet := jsonb_build_object(
      'eventType','STATE_CHANGED',
      'changed',true,
      'executionId',p_execution_id,
      'observedAt',p_observed_at,
      'routeId',r.route_id,
      'cohortPosition',r.cohort_position,
      'partNumber',r.part_number,
      'product',r.normalized_title,
      'ebayUrl',r.listing_url,
      'routeType',r.route_type,
      'routeStatus',r.route_status,
      'targetDeliveredCost',r.target_delivered_cost,
      'maxHammerBid',r.max_hammer_bid,
      'watchSourceCount',r.watch_source_count,
      'recommendedWorkType',v_work_type,
      'approvalRequired',v_approval_required,
      'authorityLevel','Recommend',
      'nextAction',r.next_action,
      'rationale',r.rationale,
      'evidenceRefs',r.evidence_refs,
      'control',jsonb_build_object(
        'maxChangedPerRun',3,
        'externalActionsEnabled',false,
        'spendingAuthorityCents',0,
        'workControlDispatchAllowed',false,
        'routeMutationAllowed',false
      )
    );

    v_event_id := null;
    insert into sourcemargin.sm_acquisition_dispatch_events(
      route_id,cohort_position,route_type,route_status,previous_fingerprint,
      state_fingerprint,execution_id,observed_at,recommended_work_type,
      approval_required,authority_level,external_actions_enabled,
      spending_authority_cents,work_control_dispatch_allowed,route_mutation_allowed,
      work_packet
    ) values (
      r.route_id,r.cohort_position,r.route_type,r.route_status,r.previous_fingerprint,
      r.state_fingerprint,p_execution_id,p_observed_at,v_work_type,
      v_approval_required,'Recommend',false,0,false,false,v_packet
    )
    on conflict(route_id,state_fingerprint) do nothing
    returning event_id into v_event_id;

    if v_event_id is null then
      select event_id into v_event_id
      from sourcemargin.sm_acquisition_dispatch_events
      where route_id=r.route_id and state_fingerprint=r.state_fingerprint;
    end if;

    v_packet := v_packet || jsonb_build_object('eventId',v_event_id);
    update sourcemargin.sm_acquisition_dispatch_events
      set work_packet=v_packet
      where event_id=v_event_id;

    insert into sourcemargin.sm_acquisition_dispatch_state(
      route_id,cohort_position,route_type,route_status,is_primary,active,
      state_fingerprint,source_updated_at,last_seen_at,last_execution_id
    ) values (
      r.route_id,r.cohort_position,r.route_type,r.route_status,true,true,
      r.state_fingerprint,r.source_updated_at,p_observed_at,p_execution_id
    )
    on conflict(route_id) do update
    set cohort_position=excluded.cohort_position,
        route_type=excluded.route_type,
        route_status=excluded.route_status,
        is_primary=true,
        active=true,
        state_fingerprint=excluded.state_fingerprint,
        source_updated_at=excluded.source_updated_at,
        last_seen_at=excluded.last_seen_at,
        last_execution_id=excluded.last_execution_id;

    v_processed := v_processed + 1;
    packet := v_packet;
    return next;
  end loop;

  -- Refresh heartbeat only for unchanged active primary routes. Changed routes
  -- beyond the three-item cap keep their old fingerprint so they remain
  -- eligible on the next cycle.
  with current_routes as (
    select
      (x->>'id')::uuid as route_id,
      md5(concat_ws('|',
        x->>'id',
        lower(coalesce(x->>'route_type','')),
        lower(coalesce(x->>'route_status','')),
        coalesce(x->>'is_primary','false'),
        coalesce(x->>'active','false'),
        coalesce(x->>'target_delivered_cost',''),
        coalesce(x->>'max_hammer_bid',''),
        coalesce(x->>'watch_source_count','0')
      )) as state_fingerprint
    from jsonb_array_elements(p_routes) x
    where coalesce((x->>'is_primary')::boolean,false)
      and coalesce((x->>'active')::boolean,false)
  )
  update sourcemargin.sm_acquisition_dispatch_state s
  set last_seen_at=p_observed_at,
      last_execution_id=p_execution_id
  from current_routes c
  where s.route_id=c.route_id
    and s.state_fingerprint=c.state_fingerprint;

  if v_processed = 0 then
    packet := jsonb_build_object(
      'eventType','NO_CHANGE',
      'changed',false,
      'activePrimaryRoutes',v_current_count,
      'executionId',p_execution_id,
      'observedAt',p_observed_at,
      'authorityLevel','Observe',
      'control',jsonb_build_object(
        'maxChangedPerRun',3,
        'externalActionsEnabled',false,
        'spendingAuthorityCents',0,
        'workControlDispatchAllowed',false,
        'routeMutationAllowed',false
      )
    );
    return next;
  end if;
end;
$;

comment on table sourcemargin.sm_acquisition_dispatch_state is
'Non-authoritative transport memory for the bounded SourceMargin acquisition-state monitor. Work Control remains execution-state owner.';

comment on table sourcemargin.sm_acquisition_dispatch_events is
'Append-only internal recommendation observations emitted from changed active primary acquisition-route state. No external action authority.';

comment on function sourcemargin.sm_acquisition_dispatch_observe(jsonb,text,timestamptz) is
'Observe changed SourceMargin acquisition-route state; emit at most three internal recommendation packets. Does not mutate SourceMargin operational state or Work Control.';
