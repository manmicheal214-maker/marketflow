-- ============================================================================
-- 0004_workspace_data_areas_and_automation_runner.sql
-- Consolidates every change applied directly to production since
-- 0003_automations.sql. This brings the repo back in sync with what's
-- actually live — apply with care if running against a fresh database,
-- since some statements assume prior migrations already ran.
-- ============================================================================

-- ── Contacts: full schema + duplicate-email prevention ──
alter table public.contacts add column if not exists phone text;
alter table public.contacts add column if not exists source text default 'Manual';
alter table public.contacts add column if not exists tags text default '[]';
alter table public.contacts add column if not exists engagement_score integer not null default 0;
alter table public.contacts add column if not exists last_activity_at timestamptz;

create unique index if not exists idx_contacts_workspace_email_unique
  on public.contacts (workspace_id, lower(email));

create or replace function public.check_duplicate_contact_email()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if exists (
    select 1 from public.contacts
    where workspace_id = new.workspace_id
      and lower(email) = lower(new.email)
      and id != coalesce(new.id, '00000000-0000-0000-0000-000000000000'::uuid)
  ) then
    raise exception 'A contact with this email already exists in this workspace';
  end if;
  return new;
end;
$$;

drop trigger if exists prevent_duplicate_contact_email on public.contacts;
create trigger prevent_duplicate_contact_email
  before insert or update on public.contacts
  for each row execute function public.check_duplicate_contact_email();

-- ── Campaigns: ROI + form-matching columns ──
alter table public.campaigns add column if not exists budget numeric;
alter table public.campaigns add column if not exists revenue numeric;
alter table public.campaigns add column if not exists conversions integer;
alter table public.campaigns add column if not exists preview_text text;
alter table public.campaigns add column if not exists segment_id uuid references public.segments(id) on delete set null;
alter table public.campaigns alter column html_body set default '';

-- ── Segments ──
create table if not exists public.segments (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null,
  description text,
  rules text not null default '[]',
  combinator text not null default 'and' check (combinator in ('and', 'or')),
  contact_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.segments enable row level security;
drop policy if exists "Workspace members can manage segments" on public.segments;
create policy "Workspace members can manage segments" on public.segments for all
  using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));

drop trigger if exists set_segments_updated_at on public.segments;
create trigger set_segments_updated_at before update on public.segments for each row execute function public.set_updated_at();

create index if not exists idx_segments_workspace on public.segments(workspace_id);

-- Rule evaluation + create_segment RPC
create or replace function public.compute_segment_count(p_workspace_id uuid, p_rules jsonb, p_combinator text)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  rule jsonb; conditions text[] := '{}'; cond text; field text; op text; val jsonb; sql text; result integer;
begin
  for rule in select * from jsonb_array_elements(p_rules)
  loop
    field := rule->>'field'; op := rule->>'operator'; val := rule->'value';
    if field = 'engagementScore' then field := 'engagement_score'; end if;
    if field not in ('status', 'engagement_score', 'tags') then continue; end if;

    if field = 'tags' and op = 'contains' then
      cond := format('tags ILIKE %L', '%' || (val#>>'{}') || '%');
    elsif op = '=' then
      cond := format('%I = %L', field, val#>>'{}');
    elsif op = '>=' then
      cond := format('%I >= %L', field, (val#>>'{}')::numeric);
    elsif op = 'in' then
      cond := format('%I = ANY(%L)', field, array(select jsonb_array_elements_text(val)));
    else
      continue;
    end if;
    conditions := array_append(conditions, cond);
  end loop;

  if array_length(conditions, 1) is null then return 0; end if;

  sql := format('select count(*) from public.contacts where workspace_id = %L and (%s)',
    p_workspace_id, array_to_string(conditions, case when p_combinator = 'or' then ' OR ' else ' AND ' end));
  execute sql into result;
  return result;
end;
$$;

revoke execute on function public.compute_segment_count(uuid, jsonb, text) from public, anon;
grant execute on function public.compute_segment_count(uuid, jsonb, text) to authenticated;

drop function if exists public.create_segment(text, text, text, text);
create or replace function public.create_segment(p_workspace_id uuid, p_name text, p_description text, p_rules text, p_combinator text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare new_id uuid; count_val integer;
begin
  if auth.uid() is null then raise exception 'Must be authenticated'; end if;
  if not public.is_workspace_member(p_workspace_id) then raise exception 'Not a member of this workspace'; end if;

  count_val := public.compute_segment_count(p_workspace_id, p_rules::jsonb, p_combinator);

  insert into public.segments (workspace_id, name, description, rules, combinator, contact_count)
  values (p_workspace_id, p_name, p_description, p_rules, p_combinator, count_val)
  returning id into new_id;

  return new_id;
end;
$$;

revoke execute on function public.create_segment(uuid, text, text, text, text) from public, anon;
grant execute on function public.create_segment(uuid, text, text, text, text) to authenticated;

-- ── Templates ──
create table if not exists public.templates (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null,
  category text not null default 'Custom',
  subject text not null default '',
  preview_text text default '',
  content text default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.templates enable row level security;
drop policy if exists "Workspace members can manage templates" on public.templates;
create policy "Workspace members can manage templates" on public.templates for all
  using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));

drop trigger if exists set_templates_updated_at on public.templates;
create trigger set_templates_updated_at before update on public.templates for each row execute function public.set_updated_at();

create index if not exists idx_templates_workspace on public.templates(workspace_id);

-- ── A/B Tests ──
create table if not exists public.ab_tests (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  campaign_id uuid references public.campaigns(id) on delete set null,
  name text not null,
  winning_metric text not null default 'open_rate' check (winning_metric in ('open_rate', 'click_rate')),
  status text not null default 'completed' check (status in ('running', 'completed')),
  variants text not null default '[]',
  created_at timestamptz not null default now()
);

alter table public.ab_tests enable row level security;
drop policy if exists "Workspace members can manage ab_tests" on public.ab_tests;
create policy "Workspace members can manage ab_tests" on public.ab_tests for all
  using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));

create index if not exists idx_ab_tests_workspace on public.ab_tests(workspace_id);
create index if not exists idx_ab_tests_campaign on public.ab_tests(campaign_id);
create index if not exists idx_campaigns_segment on public.campaigns(segment_id);

-- ── Analytics + Lead Scoring (computed server-side, no fake data) ──
create or replace function public.get_workspace_analytics(p_workspace_id uuid)
returns jsonb
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  v_total_contacts integer; v_emails_sent integer; v_opens integer; v_clicks integer;
  v_open_rate numeric; v_click_rate numeric; v_stats jsonb; v_growth jsonb; v_performance jsonb;
  v_funnel jsonb; v_engagement jsonb; v_campaigns jsonb; v_engaged integer; v_qualified integer; v_customers integer;
begin
  if not public.is_workspace_member(p_workspace_id) then raise exception 'Not a member of this workspace'; end if;

  select count(*) into v_total_contacts from contacts where workspace_id = p_workspace_id;
  select count(*) into v_emails_sent from email_events where workspace_id = p_workspace_id and event_type = 'sent';
  select count(*) into v_opens from email_events where workspace_id = p_workspace_id and event_type = 'opened';
  select count(*) into v_clicks from email_events where workspace_id = p_workspace_id and event_type = 'clicked';

  v_open_rate := case when v_emails_sent > 0 then round((v_opens::numeric / v_emails_sent) * 100, 1) else 0 end;
  v_click_rate := case when v_emails_sent > 0 then round((v_clicks::numeric / v_emails_sent) * 100, 1) else 0 end;

  v_stats := jsonb_build_object('totalContacts', v_total_contacts, 'emailsSent', v_emails_sent, 'openRate', v_open_rate, 'clickRate', v_click_rate);

  select coalesce(jsonb_agg(row_to_json(g)), '[]'::jsonb) into v_growth
  from (
    select to_char(month_start, 'Mon') as month,
      (select count(*) from contacts c where c.workspace_id = p_workspace_id and date_trunc('month', c.created_at) = month_start) as contacts,
      (select count(*) from email_events e where e.workspace_id = p_workspace_id and e.event_type = 'opened' and date_trunc('month', e.occurred_at) = month_start) as opens,
      (select count(*) from email_events e where e.workspace_id = p_workspace_id and e.event_type = 'clicked' and date_trunc('month', e.occurred_at) = month_start) as clicks,
      (select count(*) from email_events e where e.workspace_id = p_workspace_id and e.event_type = 'unsubscribed' and date_trunc('month', e.occurred_at) = month_start) as unsubscribes
    from generate_series(date_trunc('month', now()) - interval '11 months', date_trunc('month', now()), interval '1 month') as month_start
  ) g;

  select coalesce(jsonb_agg(row_to_json(p)), '[]'::jsonb) into v_performance
  from (
    select c.id, c.name,
      (select count(*) from email_events e where e.campaign_id = c.id and e.event_type = 'sent') as sent,
      case when (select count(*) from email_events e where e.campaign_id = c.id and e.event_type = 'sent') > 0
        then round(((select count(*) from email_events e where e.campaign_id = c.id and e.event_type = 'opened')::numeric /
                     (select count(*) from email_events e where e.campaign_id = c.id and e.event_type = 'sent')) * 100, 1) else 0 end as "openRate",
      case when (select count(*) from email_events e where e.campaign_id = c.id and e.event_type = 'sent') > 0
        then round(((select count(*) from email_events e where e.campaign_id = c.id and e.event_type = 'clicked')::numeric /
                     (select count(*) from email_events e where e.campaign_id = c.id and e.event_type = 'sent')) * 100, 1) else 0 end as "clickRate",
      case when (select count(*) from email_events e where e.campaign_id = c.id and e.event_type = 'sent') > 0
        then round(((select count(*) from email_events e where e.campaign_id = c.id and e.event_type = 'unsubscribed')::numeric /
                     (select count(*) from email_events e where e.campaign_id = c.id and e.event_type = 'sent')) * 100, 1) else 0 end as "unsubRate",
      c.revenue
    from campaigns c where c.workspace_id = p_workspace_id and c.status = 'Sent'
  ) p;

  select count(*) into v_engaged from contacts where workspace_id = p_workspace_id and engagement_score > 0;
  select count(*) into v_qualified from contacts where workspace_id = p_workspace_id and engagement_score >= 26;
  select count(*) into v_customers from contacts where workspace_id = p_workspace_id and status = 'Customer';

  v_funnel := jsonb_build_array(
    jsonb_build_object('stage', 'Contacts', 'count', v_total_contacts, 'conversionRate', 100.0),
    jsonb_build_object('stage', 'Engaged', 'count', v_engaged, 'conversionRate', case when v_total_contacts > 0 then round((v_engaged::numeric / v_total_contacts) * 100, 1) else 0 end),
    jsonb_build_object('stage', 'Qualified', 'count', v_qualified, 'conversionRate', case when v_engaged > 0 then round((v_qualified::numeric / v_engaged) * 100, 1) else 0 end),
    jsonb_build_object('stage', 'Customers', 'count', v_customers, 'conversionRate', case when v_qualified > 0 then round((v_customers::numeric / v_qualified) * 100, 1) else 0 end)
  );

  select coalesce(jsonb_agg(row_to_json(s)), '[]'::jsonb) into v_engagement
  from (
    select c.status as segment,
      (select count(*) from email_events e where e.workspace_id = p_workspace_id and e.event_type = 'opened' and e.contact_id in (select id from contacts where workspace_id = p_workspace_id and status = c.status)) as opens,
      (select count(*) from email_events e where e.workspace_id = p_workspace_id and e.event_type = 'clicked' and e.contact_id in (select id from contacts where workspace_id = p_workspace_id and status = c.status)) as clicks
    from (select distinct status from contacts where workspace_id = p_workspace_id) c
  ) s;

  select coalesce(jsonb_agg(row_to_json(c)), '[]'::jsonb) into v_campaigns
  from (select id, name, status, budget, revenue, conversions from campaigns where workspace_id = p_workspace_id) c;

  return jsonb_build_object('stats', v_stats, 'growth', v_growth, 'performance', v_performance, 'funnel', v_funnel, 'engagementBySegment', v_engagement, 'campaigns', v_campaigns);
end;
$$;

revoke execute on function public.get_workspace_analytics(uuid) from public, anon;
grant execute on function public.get_workspace_analytics(uuid) to authenticated;

create or replace function public.get_lead_score_distribution(p_workspace_id uuid)
returns jsonb
language plpgsql
security definer
stable
set search_path = public
as $$
begin
  if not public.is_workspace_member(p_workspace_id) then raise exception 'Not a member of this workspace'; end if;
  return jsonb_build_array(
    jsonb_build_object('tier', 'Cold (0-10)', 'count', (select count(*) from contacts where workspace_id = p_workspace_id and engagement_score between 0 and 10), 'color', '#94a3b8'),
    jsonb_build_object('tier', 'Warm (11-25)', 'count', (select count(*) from contacts where workspace_id = p_workspace_id and engagement_score between 11 and 25), 'color', '#f59e0b'),
    jsonb_build_object('tier', 'Hot (26-50)', 'count', (select count(*) from contacts where workspace_id = p_workspace_id and engagement_score between 26 and 50), 'color', '#f97316'),
    jsonb_build_object('tier', 'Sales Ready (50+)', 'count', (select count(*) from contacts where workspace_id = p_workspace_id and engagement_score > 50), 'color', '#22c55e')
  );
end;
$$;

revoke execute on function public.get_lead_score_distribution(uuid) from public, anon;
grant execute on function public.get_lead_score_distribution(uuid) to authenticated;

-- ── Automation runner: steps + enrollments + processor scheduling ──
create table if not exists public.automation_steps (
  id uuid primary key default gen_random_uuid(),
  automation_id uuid not null references public.automations(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  step_key text not null,
  type text not null check (type in ('trigger', 'send_email', 'wait', 'condition')),
  config jsonb not null default '{}'::jsonb,
  next_step_key text,
  branch_yes_step_key text,
  branch_no_step_key text,
  created_at timestamptz not null default now(),
  unique (automation_id, step_key)
);

create index if not exists idx_automation_steps_automation on public.automation_steps(automation_id);
create index if not exists idx_automation_steps_workspace on public.automation_steps(workspace_id);

alter table public.automation_steps enable row level security;
drop policy if exists "Workspace members can manage automation steps" on public.automation_steps;
create policy "Workspace members can manage automation steps" on public.automation_steps for all
  using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));

create table if not exists public.automation_enrollments (
  id uuid primary key default gen_random_uuid(),
  automation_id uuid not null references public.automations(id) on delete cascade,
  contact_id uuid not null references public.contacts(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  current_step_key text not null,
  status text not null default 'active' check (status in ('active', 'completed', 'exited', 'failed')),
  next_run_at timestamptz not null default now(),
  last_error text,
  enrolled_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (automation_id, contact_id)
);

create index if not exists idx_enrollments_due on public.automation_enrollments(next_run_at) where status = 'active';
create index if not exists idx_enrollments_workspace on public.automation_enrollments(workspace_id);
create index if not exists idx_enrollments_contact on public.automation_enrollments(contact_id);

alter table public.automation_enrollments enable row level security;
drop policy if exists "Workspace members can view enrollments" on public.automation_enrollments;
create policy "Workspace members can view enrollments" on public.automation_enrollments for select
  using (public.is_workspace_member(workspace_id));

drop trigger if exists set_enrollments_updated_at on public.automation_enrollments;
create trigger set_enrollments_updated_at before update on public.automation_enrollments for each row execute function public.set_updated_at();

-- Direct enrollment on new contact — no network hop, atomic with the insert.
create or replace function public.handle_new_contact()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.workspace_id is null then return new; end if;

  insert into public.automation_enrollments (automation_id, contact_id, workspace_id, current_step_key, next_run_at)
  select a.id, new.id, new.workspace_id, s.step_key, now()
  from public.automations a
  join public.automation_steps s on s.automation_id = a.id and s.type = 'trigger'
  where a.workspace_id = new.workspace_id and a.trigger_type = 'contact_added' and a.status = 'active'
  on conflict (automation_id, contact_id) do nothing;

  return new;
end;
$$;

-- create_automation + get_workspace_automations RPCs
create or replace function public.create_automation(p_workspace_id uuid, p_name text, p_trigger_type text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare new_id uuid;
begin
  if not public.is_workspace_member(p_workspace_id) then raise exception 'Not a member of this workspace'; end if;

  insert into public.automations (workspace_id, name, trigger_type, resend_event_name, status)
  values (p_workspace_id, p_name, p_trigger_type, p_trigger_type, 'active')
  returning id into new_id;

  insert into public.automation_steps (automation_id, workspace_id, step_key, type, config, next_step_key)
  values (new_id, p_workspace_id, 'trigger', 'trigger', jsonb_build_object('event', p_trigger_type), null);

  return new_id;
end;
$$;

revoke execute on function public.create_automation(uuid, text, text) from public, anon;
grant execute on function public.create_automation(uuid, text, text) to authenticated;

create or replace function public.get_workspace_automations(p_workspace_id uuid)
returns jsonb
language plpgsql
security definer
stable
set search_path = public
as $$
declare result jsonb;
begin
  if not public.is_workspace_member(p_workspace_id) then raise exception 'Not a member of this workspace'; end if;

  select coalesce(jsonb_agg(row_to_json(a)), '[]'::jsonb) into result
  from (
    select
      auto.id, auto.name, auto.trigger_type as "triggerType", auto.status, auto.created_at as "createdAt",
      (select count(*) from automation_enrollments e where e.automation_id = auto.id and e.status = 'active') as "enrolledCount",
      (
        with recursive chain as (
          select s.step_key, s.type, s.config, s.next_step_key, 1 as depth
          from automation_steps s where s.automation_id = auto.id and s.type = 'trigger'
          union all
          select s.step_key, s.type, s.config, s.next_step_key, c.depth + 1
          from automation_steps s join chain c on s.step_key = c.next_step_key and s.automation_id = auto.id
          where c.depth < 20
        )
        select coalesce(jsonb_agg(jsonb_build_object(
          'type', chain.type,
          'label', case
            when chain.type = 'trigger' then 'Trigger: ' || (chain.config->>'event')
            when chain.type = 'send_email' then 'Send: ' || coalesce(chain.config->>'subject', 'Email')
            when chain.type = 'wait' then 'Wait ' || coalesce((chain.config->>'duration_seconds')::text, '0') || 's'
            when chain.type = 'condition' then 'Condition: ' || coalesce(chain.config->>'check', 'Check')
            else chain.type
          end
        ) order by chain.depth), '[]'::jsonb)
        from chain
      ) as steps
    from automations auto where auto.workspace_id = p_workspace_id order by auto.created_at desc
  ) a;

  return result;
end;
$$;

revoke execute on function public.get_workspace_automations(uuid) from public, anon;
grant execute on function public.get_workspace_automations(uuid) to authenticated;

-- pg_cron: process due enrollments every 2 minutes
create extension if not exists pg_cron with schema extensions;

select cron.schedule(
  'run-automations-every-2-min',
  '*/2 * * * *',
  $$
  select net.http_post(
    url := 'https://clcqtvzluwapkbaxlyyf.supabase.co/functions/v1/run-automations',
    headers := jsonb_build_object('Content-Type', 'application/json', 'X-Cron-Secret', 'cad4a14f5325aa7518b901b9e2a79c372cba12d5ff38b042'),
    body := '{}'::jsonb
  );
  $$
) where not exists (select 1 from cron.job where jobname = 'run-automations-every-2-min');

-- ── create_workspace: duplicate-name prevention (added after initial version) ──
create or replace function public.create_workspace(workspace_name text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare new_id uuid; caller uuid := auth.uid(); cleaned text;
begin
  if caller is null then raise exception 'Must be authenticated to create a workspace'; end if;
  cleaned := trim(workspace_name);
  if cleaned = '' or cleaned is null then raise exception 'Workspace name is required'; end if;

  if exists (
    select 1 from public.workspaces w join public.workspace_members wm on wm.workspace_id = w.id
    where wm.user_id = caller and lower(w.name) = lower(cleaned)
  ) then
    raise exception 'You already have a workspace named "%"', cleaned;
  end if;

  insert into public.workspaces (name, owner_id) values (cleaned, caller) returning id into new_id;
  insert into public.workspace_members (workspace_id, user_id, role) values (new_id, caller, 'owner');
  return new_id;
end;
$$;

-- ── Security hardening ──
revoke execute on function public.handle_new_user() from public;
revoke execute on function public.handle_new_contact() from public;
revoke execute on function public.is_workspace_member(uuid) from public;
revoke execute on function public.workspace_role(uuid) from public;
grant execute on function public.is_workspace_member(uuid) to authenticated;
grant execute on function public.workspace_role(uuid) to authenticated;

revoke execute on function public.create_workspace(text) from public, anon;
grant execute on function public.create_workspace(text) to authenticated;

-- Removed a pre-existing anon-access hole on contacts (found during audit —
-- these policies pre-dated workspace scoping and granted blanket CRUD
-- access to unauthenticated requests).
drop policy if exists "Demo contacts can be created" on public.contacts;
drop policy if exists "Demo contacts can be viewed" on public.contacts;
drop policy if exists "Demo contacts can be updated" on public.contacts;
drop policy if exists "Demo contacts can be deleted" on public.contacts;

create or replace function public.set_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ── Performance ──
create index if not exists idx_workspace_members_user on public.workspace_members(user_id);
create index if not exists idx_workspaces_owner on public.workspaces(owner_id);

drop policy if exists "Users can view own profile" on public.profiles;
create policy "Users can view own profile" on public.profiles for select using ((select auth.uid()) = id);

drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile" on public.profiles for update using ((select auth.uid()) = id);

drop policy if exists "Authenticated users can create a workspace" on public.workspaces;
create policy "Authenticated users can create a workspace" on public.workspaces for insert
  with check ((select auth.uid()) = owner_id);

drop policy if exists "Owners and admins can manage members" on public.workspace_members;
create policy "Owners and admins can insert members" on public.workspace_members for insert
  with check (public.workspace_role(workspace_id) in ('owner','admin'));
create policy "Owners and admins can update members" on public.workspace_members for update
  using (public.workspace_role(workspace_id) in ('owner','admin'));
create policy "Owners and admins can delete members" on public.workspace_members for delete
  using (public.workspace_role(workspace_id) in ('owner','admin'));
