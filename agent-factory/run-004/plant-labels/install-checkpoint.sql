-- Reviewed deployment script, not applied automatically. Existing research tables only.
-- Caller must already have server-side service_role credentials. No public mutation.
create or replace function public.run004_plant_labels_checkpoint(
  p_run_id text, p_expected_version integer, p_checkpoint jsonb
) returns jsonb language plpgsql security invoker set search_path='' as $$
declare
  w public.amazon_leaf_work_items;
  previous jsonb;
  phase text;
  target_state text;
  event jsonb;
begin
  if p_run_id is distinct from 'SM-AMZ-PLANT-LABELS-001'
     or p_checkpoint->>'runId' is distinct from p_run_id
     or p_checkpoint->>'leafId' is distinct from '14623206011'
     or p_expected_version is null or p_expected_version < 0
     or (p_checkpoint->>'version')::integer is distinct from p_expected_version+1
     or octet_length(p_checkpoint::text)>500000 then
    raise exception 'INVALID_CHECKPOINT_SCOPE';
  end if;
  phase:=p_checkpoint->>'phase';
  if phase is null or phase not in ('READY','DISPATCH_INTENT','WAITING','BLOCKED','REJECTED','RESEARCH_FINISHED','PAUSED','CANCELLED')
     or jsonb_typeof(p_checkpoint->'events') is distinct from 'array'
     or jsonb_array_length(p_checkpoint->'events')<>p_expected_version+1 then
    raise exception 'INVALID_CHECKPOINT';
  end if;
  -- Transaction lock serializes first creation as well as subsequent checkpoints.
  perform pg_advisory_xact_lock(hashtextextended(p_run_id,0));
  select * into w from public.amazon_leaf_work_items where category_browse_node_id='14623206011' for update;
  if found then
    previous:=w.state_details->'run004_controller';
    if previous is null then raise exception 'EXISTING_RESEARCH_NOT_OWNED'; end if;
    if previous->>'runId' is distinct from p_run_id then raise exception 'RUN_CONFLICT'; end if;
    if (previous->>'version')::integer is distinct from p_expected_version then raise exception 'CHECKPOINT_CONFLICT'; end if;
    if (p_checkpoint->'events') - p_expected_version is distinct from previous->'events' then raise exception 'EVENT_HISTORY_CHANGED'; end if;
  else
    if p_expected_version<>0 then raise exception 'CHECKPOINT_CONFLICT'; end if;
    if not exists(select 1 from public.amazon_categories where amazon_browse_node_id='14623206011' and is_leaf and active) then raise exception 'LEAF_NOT_ACTIVE'; end if;
    insert into public.amazon_leaf_work_items(category_browse_node_id,workflow_version,current_state,state_actor)
      values('14623206011','run004_plant_labels_v1','QUEUED','Run 004') returning * into w;
  end if;
  -- Proposals remain proposals. Never grant readiness, publication or exhaustive coverage.
  target_state:=case
    when phase in ('BLOCKED','PAUSED','CANCELLED','RESEARCH_FINISHED','REJECTED') then 'HOLD'
    else case (p_checkpoint->>'stage')::integer
      when 0 then 'ASIN_DISCOVERY' when 1 then 'DEMAND_VALIDATION'
      when 2 then 'SOURCING' when 3 then 'ECONOMICS' when 4 then 'ECONOMICS'
      when 5 then 'ECONOMICS' else 'HOLD' end end;
  event:=p_checkpoint->'events'->-1;
  -- Existing trigger records state changes. Explicit events cover same-state ticks only.
  if target_state = w.current_state then
  insert into public.amazon_state_events(work_item_id,workflow_version,from_state,to_state,actor,details)
    values(w.id,'run004_plant_labels_v1',w.current_state,target_state,'Run 004',
      event || jsonb_build_object('runId',p_run_id,'executionPhase',phase,'checkpointVersion',p_expected_version+1));
  end if;
  update public.amazon_leaf_work_items set current_state=target_state,state_version=state_version+1,
    state_details=state_details || jsonb_build_object('run004_controller',p_checkpoint,'controller_event',event),
    decision_summary='Bounded Plant Labels research execution: '||phase,
    next_action=case when target_state='HOLD' then 'Review controller event, Work Control receipt and evidence before continuing.' else 'Await next existing Factory controller tick.' end,
    last_error=case when phase='BLOCKED' then event->>'kind' else null end,
    state_actor='Run 004', updated_at=now()
    where id=w.id;
  return jsonb_build_object('workItemId',w.id,'version',p_expected_version+1,'state',target_state);
end $$;
revoke all on function public.run004_plant_labels_checkpoint(text,integer,jsonb) from public,anon,authenticated;
grant execute on function public.run004_plant_labels_checkpoint(text,integer,jsonb) to service_role;
