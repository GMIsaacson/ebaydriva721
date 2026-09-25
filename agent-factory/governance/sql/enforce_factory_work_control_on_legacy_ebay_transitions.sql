
create table if not exists public.source_margin_factory_transition_audit (
  factory_command_id text primary key,
  work_item_id uuid not null references public.source_margin_work_items(id) on delete cascade,
  requested_state text not null,
  actor text not null,
  metadata jsonb not null default '{}'::jsonb,
  authorized_at timestamptz not null default now(),
  consumed_at timestamptz
);

alter table public.source_margin_factory_transition_audit enable row level security;
revoke all on table public.source_margin_factory_transition_audit from public, anon, authenticated;
revoke all on table public.source_margin_factory_transition_audit from service_role;

CREATE OR REPLACE FUNCTION public.advance_source_margin_item(p_work_item_id uuid, p_to_state text, p_actor text, p_details jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  w public.source_margin_work_items%rowtype;
  latest record;
  allowed boolean := false;
  req_count integer := 0;
  eq_status text;
  econ_status text;
  econ_payload jsonb;
  structural_state text;
  evidence_ids uuid[];
  demand_gate jsonb;
begin
  if coalesce(current_setting('sourcemargin.factory_authorized',true),'0') <> '1'
     or coalesce(current_setting('sourcemargin.factory_command_id',true),'') = '' then
    raise exception 'FACTORY_AUTHORIZATION_REQUIRED';
  end if;

  select * into w
  from public.source_margin_work_items
  where id=p_work_item_id
  for update;

  if not found then
    raise exception 'WORK_ITEM_NOT_FOUND';
  end if;

  if p_to_state = w.current_state then
    return jsonb_build_object('ok',true,'state',w.current_state,'noop',true);
  end if;

  allowed := (w.current_state,p_to_state) in (
    ('OBSERVED','DEMAND_BASELINE'),
    ('OBSERVED','DEMAND_PENDING'),
    ('OBSERVED','DEMAND_ESTIMATED'),
    ('OBSERVED','DEMAND_VERIFIED'),
    ('OBSERVED','REJECT_LOW_DEMAND'),
    ('DEMAND_BASELINE','DEMAND_PENDING'),
    ('DEMAND_BASELINE','DEMAND_ESTIMATED'),
    ('DEMAND_BASELINE','DEMAND_VERIFIED'),
    ('DEMAND_BASELINE','REJECT_LOW_DEMAND'),
    ('DEMAND_PENDING','DEMAND_ESTIMATED'),
    ('DEMAND_PENDING','DEMAND_VERIFIED'),
    ('DEMAND_PENDING','REJECT_LOW_DEMAND'),
    ('DEMAND_PENDING','HOLD_DEMAND_CONFIRMATION'),
    ('DEMAND_ESTIMATED','DEMAND_PENDING'),
    ('DEMAND_ESTIMATED','DEMAND_VERIFIED'),
    ('DEMAND_ESTIMATED','HOLD_DEMAND_CONFIRMATION'),
    ('HOLD_DEMAND_CONFIRMATION','DEMAND_ESTIMATED'),
    ('HOLD_DEMAND_CONFIRMATION','DEMAND_VERIFIED'),
    ('HOLD_DEMAND_CONFIRMATION','REJECT_LOW_DEMAND'),
    ('DEMAND_VERIFIED','SOURCING'),
    ('SOURCING','SOURCE_EXHAUSTED'),
    ('SOURCING','QUOTE_NEEDED'),
    ('SOURCE_EXHAUSTED','EQUIVALENCE_PENDING'),
    ('SOURCE_EXHAUSTED','EQUIVALENCE_VERIFIED'),
    ('SOURCE_EXHAUSTED','REJECT_NO_EQUIVALENT_SOURCE'),
    ('SOURCE_EXHAUSTED','QUOTE_NEEDED'),
    ('EQUIVALENCE_PENDING','EQUIVALENCE_VERIFIED'),
    ('EQUIVALENCE_PENDING','REJECT_NO_EQUIVALENT_SOURCE'),
    ('EQUIVALENCE_PENDING','QUOTE_NEEDED'),
    ('EQUIVALENCE_VERIFIED','ECONOMICS_COMPLETE'),
    ('ECONOMICS_COMPLETE','STRUCTURAL_REVIEW'),
    ('ECONOMICS_COMPLETE','SOURCE_READY'),
    ('ECONOMICS_COMPLETE','SAMPLE_READY'),
    ('ECONOMICS_COMPLETE','HOLD_PRICE_CHANGE'),
    ('ECONOMICS_COMPLETE','REJECT_ECONOMICS'),
    ('ECONOMICS_COMPLETE','REJECT_MARKET_CEILING'),
    ('ECONOMICS_COMPLETE','REJECT_STRUCTURAL_ADVANTAGE_GAP'),
    ('STRUCTURAL_REVIEW','SOURCE_READY'),
    ('STRUCTURAL_REVIEW','SAMPLE_READY'),
    ('STRUCTURAL_REVIEW','HOLD_PRICE_CHANGE'),
    ('STRUCTURAL_REVIEW','QUOTE_NEEDED'),
    ('STRUCTURAL_REVIEW','REJECT_ECONOMICS'),
    ('STRUCTURAL_REVIEW','REJECT_MARKET_CEILING'),
    ('STRUCTURAL_REVIEW','REJECT_STRUCTURAL_ADVANTAGE_GAP'),
    ('QUOTE_NEEDED','SOURCING'),
    ('QUOTE_NEEDED','SOURCE_EXHAUSTED'),
    ('HOLD_PRICE_CHANGE','ECONOMICS_COMPLETE')
  );

  if not allowed then
    raise exception 'ILLEGAL_TRANSITION: % -> %',w.current_state,p_to_state;
  end if;

  select o.evidence_status,o.sold_30d,o.estimated_sold_30d,o.observed_at,o.id
    into latest
  from public.ebay_census_observations o
  where o.listing_id=w.census_listing_id
  order by o.observed_at desc,o.id desc
  limit 1;

  demand_gate := public.source_margin_demand_gate_status(w.id);

  if p_to_state='DEMAND_VERIFIED' or p_to_state='SOURCING' then
    if coalesce((demand_gate->>'satisfied')::boolean,false) is not true then
      raise exception 'GATE_DENIED: DEMAND_NOT_VERIFIED_AT_THRESHOLD';
    end if;
  end if;

  if p_to_state='REJECT_LOW_DEMAND' then
    if latest.evidence_status is distinct from 'verified'
       or latest.sold_30d is null
       or latest.observed_at < now()-interval '30 days'
       or latest.sold_30d >= w.demand_threshold_30d then
      raise exception 'GATE_DENIED: LOW_DEMAND_NOT_VERIFIED';
    end if;
  end if;

  if p_to_state='SOURCE_EXHAUSTED' then
    select count(distinct evidence_type),array_agg(id)
      into req_count,evidence_ids
    from public.source_margin_gate_evidence
    where work_item_id=w.id
      and gate='source_exhaustion'
      and evidence_type in ('exact_model','synonym_title','spec_fingerprint','marketplace_competitors','manufacturer_direct')
      and evidence_status in ('completed','not_applicable');
    if req_count < 5 then
      raise exception 'GATE_DENIED: SOURCE_EXHAUSTION_INCOMPLETE (%/5 required scopes)',req_count;
    end if;
  end if;

  if p_to_state='EQUIVALENCE_VERIFIED' then
    select evidence_status into eq_status
    from public.source_margin_gate_evidence
    where work_item_id=w.id and gate='equivalence'
    order by created_at desc limit 1;
    if eq_status is distinct from 'pass' then
      raise exception 'GATE_DENIED: EQUIVALENCE_NOT_VERIFIED';
    end if;
  end if;

  if p_to_state='REJECT_NO_EQUIVALENT_SOURCE' then
    select evidence_status into eq_status
    from public.source_margin_gate_evidence
    where work_item_id=w.id and gate='equivalence'
    order by created_at desc limit 1;
    if eq_status is distinct from 'fail' then
      raise exception 'GATE_DENIED: EQUIVALENCE_FAILURE_NOT_PROVEN';
    end if;
  end if;

  if p_to_state in ('ECONOMICS_COMPLETE','SOURCE_READY','SAMPLE_READY','HOLD_PRICE_CHANGE',
                    'REJECT_ECONOMICS','REJECT_MARKET_CEILING','REJECT_STRUCTURAL_ADVANTAGE_GAP',
                    'STRUCTURAL_REVIEW') then
    select evidence_status,payload into econ_status,econ_payload
    from public.source_margin_gate_evidence
    where work_item_id=w.id and gate='economics'
    order by created_at desc limit 1;

    if econ_status is distinct from 'completed' then
      raise exception 'GATE_DENIED: ECONOMICS_NOT_COMPLETE';
    end if;

    if not (
      econ_payload ? 'sale_price'
      and econ_payload ? 'landed_cost'
      and econ_payload ? 'marketplace_fees'
      and econ_payload ? 'outbound_shipping'
      and econ_payload ? 'returns_reserve'
      and econ_payload ? 'pack_handling'
      and econ_payload ? 'target_margin_pct'
      and econ_payload ? 'outcome'
    ) then
      raise exception 'GATE_DENIED: ECONOMICS_REQUIRED_FIELDS_MISSING';
    end if;
  end if;

  if p_to_state in ('SOURCE_READY','SAMPLE_READY') then
    if coalesce(econ_payload->>'outcome','') <> 'pass' then
      raise exception 'GATE_DENIED: ECONOMICS_NOT_PASS';
    end if;
    select evidence_status into eq_status
    from public.source_margin_gate_evidence
    where work_item_id=w.id and gate='equivalence'
    order by created_at desc limit 1;
    if eq_status is distinct from 'pass' then
      raise exception 'GATE_DENIED: EQUIVALENCE_NOT_PASS';
    end if;
    demand_gate := public.source_margin_demand_gate_status(w.id);
    if coalesce((demand_gate->>'satisfied')::boolean,false) is not true then
      raise exception 'GATE_DENIED: DEMAND_NOT_VERIFIED_AT_TERMINAL';
    end if;
  end if;

  if p_to_state in ('REJECT_ECONOMICS','REJECT_MARKET_CEILING','REJECT_STRUCTURAL_ADVANTAGE_GAP','HOLD_PRICE_CHANGE') then
    if coalesce(econ_payload->>'outcome','') <> 'fail' then
      raise exception 'GATE_DENIED: ECONOMICS_FAILURE_NOT_PROVEN';
    end if;
  end if;

  if p_to_state='REJECT_MARKET_CEILING'
     and coalesce((econ_payload->>'market_ceiling_proven')::boolean,false) is not true then
    raise exception 'GATE_DENIED: MARKET_CEILING_NOT_PROVEN';
  end if;

  if p_to_state='REJECT_STRUCTURAL_ADVANTAGE_GAP' then
    select a.advantage_state into structural_state
    from public.listing_seller_advantage_assessments a
    where a.listing_id=w.ebay_listing_id
    order by a.assessed_at desc limit 1;
    if structural_state not in ('evidence_present','strong_evidence_present') then
      raise exception 'GATE_DENIED: STRUCTURAL_ADVANTAGE_NOT_EVIDENCED';
    end if;
  end if;

  perform set_config('sourcemargin.transition_authorized','1',true);
  update public.source_margin_work_items
  set current_state=p_to_state,
      state_version=state_version+1,
      last_gate_error=null,
      updated_at=now()
  where id=w.id;

  insert into public.source_margin_state_events(
    work_item_id,workflow_version,from_state,to_state,actor,evidence_ids,details
  )
  values(
    w.id,w.workflow_version,w.current_state,p_to_state,coalesce(nullif(p_actor,''),'unknown'),
    coalesce(evidence_ids,'{}'::uuid[]),
    coalesce(p_details,'{}'::jsonb) || jsonb_build_object(
      'demand_gate',demand_gate,
      'factory_command_id',current_setting('sourcemargin.factory_command_id',true)
    )
  );

  return jsonb_build_object(
    'ok',true,
    'work_item_id',w.id,
    'from_state',w.current_state,
    'to_state',p_to_state,
    'state_version',w.state_version+1,
    'demand_gate',demand_gate,
    'factory_command_id',current_setting('sourcemargin.factory_command_id',true)
  );
exception when others then
  update public.source_margin_work_items
    set last_gate_error=sqlerrm,updated_at=now()
  where id=p_work_item_id;
  raise;
end;
$function$
;

create or replace function public.factory_request_source_margin_transition(
  p_work_item_id uuid,
  p_to_state text,
  p_actor text,
  p_details jsonb,
  p_factory_command_id text,
  p_factory_token text
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $function$
declare
  expected_hash text;
  supplied_hash text;
  result jsonb;
begin
  if p_factory_command_id is null
     or p_factory_command_id !~ '^WC-[0-9]{14}-[A-Za-z0-9]{10}$' then
    raise exception 'FACTORY_COMMAND_INVALID';
  end if;

  if coalesce(trim(p_factory_token),'')='' then
    raise exception 'FACTORY_TOKEN_REQUIRED';
  end if;

  select token_sha256 into expected_hash
  from public.amazon_observe_bridge_auth
  where singleton=true
  limit 1;

  supplied_hash := encode(extensions.digest(convert_to(p_factory_token,'UTF8'),'sha256'),'hex');

  if expected_hash is null or supplied_hash is distinct from expected_hash then
    raise exception 'FACTORY_TOKEN_INVALID';
  end if;

  begin
    insert into public.source_margin_factory_transition_audit(
      factory_command_id,work_item_id,requested_state,actor,metadata
    )
    values(
      p_factory_command_id,p_work_item_id,p_to_state,
      coalesce(nullif(p_actor,''),'unknown'),
      coalesce(p_details,'{}'::jsonb)
    );
  exception when unique_violation then
    raise exception 'FACTORY_COMMAND_REPLAY_DENIED';
  end;

  perform set_config('sourcemargin.factory_authorized','1',true);
  perform set_config('sourcemargin.factory_command_id',p_factory_command_id,true);

  result := public.advance_source_margin_item(
    p_work_item_id,p_to_state,p_actor,coalesce(p_details,'{}'::jsonb)
  );

  update public.source_margin_factory_transition_audit
  set consumed_at=now()
  where factory_command_id=p_factory_command_id;

  return result || jsonb_build_object(
    'factory_authorized',true,
    'factory_command_id',p_factory_command_id
  );
end;
$function$;

revoke execute on function public.factory_request_source_margin_transition(uuid,text,text,jsonb,text,text) from public,anon,authenticated;
grant execute on function public.factory_request_source_margin_transition(uuid,text,text,jsonb,text,text) to service_role;

create or replace function public.source_margin_guard_state_write()
returns trigger
language plpgsql
set search_path=''
as $function$
begin
  if tg_op='INSERT' then
    if new.current_state is distinct from 'OBSERVED' then
      raise exception 'DIRECT_INITIAL_STATE_DENIED: new SourceMargin work must start OBSERVED';
    end if;
    return new;
  end if;

  if new.current_state is distinct from old.current_state
     and (
       coalesce(current_setting('sourcemargin.transition_authorized',true),'0') <> '1'
       or coalesce(current_setting('sourcemargin.factory_authorized',true),'0') <> '1'
       or coalesce(current_setting('sourcemargin.factory_command_id',true),'') = ''
     ) then
    raise exception 'DIRECT_STATE_WRITE_DENIED: Factory Work Control authorization required';
  end if;
  return new;
end;
$function$;

drop trigger if exists source_margin_guard_state_write on public.source_margin_work_items;
create trigger source_margin_guard_state_write
before insert or update on public.source_margin_work_items
for each row execute function public.source_margin_guard_state_write();

create or replace function public.source_margin_sync_from_demand_observation()
returns trigger
language plpgsql
security definer
set search_path=''
as $function$
declare
  w public.source_margin_work_items%rowtype;
  ebay_listing uuid;
  desired text;
begin
  select e.id into ebay_listing
  from public.ebay_listings e
  join public.ebay_census_listings cl on cl.ebay_item_id=e.ebay_item_id
  where cl.id=new.listing_id
  limit 1;

  desired := case
    when new.evidence_status='verified' and coalesce(new.sold_30d,0)>=25 then 'DEMAND_VERIFIED'
    when new.evidence_status='verified' and coalesce(new.sold_30d,0)<25 then 'REJECT_LOW_DEMAND'
    when new.evidence_status='estimated' then 'DEMAND_ESTIMATED'
    when new.evidence_status in ('baseline_only','counter_not_exposed','conflicting','no_baseline') then 'DEMAND_PENDING'
    else 'OBSERVED'
  end;

  select * into w
  from public.source_margin_work_items
  where census_listing_id=new.listing_id
  for update;

  if not found then
    insert into public.source_margin_work_items(
      census_listing_id,category_id,ebay_listing_id,current_state,state_version,demand_threshold_30d
    )
    values(new.listing_id,new.category_id,ebay_listing,'OBSERVED',1,25)
    returning * into w;

    insert into public.source_margin_state_events(
      work_item_id,workflow_version,from_state,to_state,actor,details
    )
    values(
      w.id,w.workflow_version,null,'OBSERVED','demand_observation_sync',
      jsonb_build_object(
        'observation_id',new.id,
        'initial_state_only',true,
        'factory_transition_required',desired <> 'OBSERVED'
      )
    );
  else
    if w.ebay_listing_id is null and ebay_listing is not null then
      update public.source_margin_work_items
      set ebay_listing_id=ebay_listing,category_id=coalesce(category_id,new.category_id),updated_at=now()
      where id=w.id;
    end if;
  end if;

  insert into public.source_margin_gate_evidence(
    work_item_id,gate,evidence_type,evidence_status,source_ref,source_url,payload,actor,observed_at
  )
  values(
    w.id,'demand','census_observation',
    case
      when new.evidence_status='verified' then 'verified'
      when new.evidence_status='estimated' then 'estimated'
      when new.evidence_status='conflicting' then 'conflicting'
      else 'pending'
    end,
    'ebay_census_observations:'||new.id,
    new.source_url,
    jsonb_build_object(
      'evidence_status',new.evidence_status,
      'sold_30d',new.sold_30d,
      'estimated_sold_30d',new.estimated_sold_30d,
      'confidence',new.confidence,
      'interval_days',new.interval_days,
      'suggested_transition',desired,
      'factory_transition_required',desired <> w.current_state
    ),
    'demand_observation_sync',
    new.observed_at
  );

  if desired is distinct from w.current_state then
    insert into public.research_events(event_type,target_type,target_id,actor,details)
    values(
      'source_margin_factory_transition_required',
      'evidence',
      'source_margin_work_item:'||w.id,
      'demand_observation_sync',
      jsonb_build_object(
        'work_item_id',w.id,
        'current_state',w.current_state,
        'suggested_state',desired,
        'observation_id',new.id,
        'factory_required',true
      )
    );
  end if;

  return new;
end;
$function$;

revoke execute on function public.advance_source_margin_item(uuid,text,text,jsonb) from public,anon,authenticated;
grant execute on function public.advance_source_margin_item(uuid,text,text,jsonb) to service_role;

revoke execute on function public.request_source_margin_transition(uuid,text,text,jsonb) from public,anon,authenticated;
grant execute on function public.request_source_margin_transition(uuid,text,text,jsonb) to service_role;
