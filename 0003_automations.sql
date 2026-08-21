-- ============================================================================
-- MarketFlow: Automations metadata + auto-trigger on new contact
-- ============================================================================

create table if not exists public.automations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  trigger_type text not null
    check (trigger_type in ('contact_added','enters_segment','tag_added','campaign_clicked','campaign_opened')),
  resend_event_name text not null,
  resend_automation_id text,
  status text not null default 'active' check (status in ('active','paused')),
  enrollment_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.automations enable row level security;

drop policy if exists "Authenticated users can manage automations" on public.automations;
create policy "Authenticated users can manage automations"
  on public.automations for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

drop trigger if exists set_automations_updated_at on public.automations;
create trigger set_automations_updated_at
  before update on public.automations
  for each row execute function public.set_updated_at();

-- Registers the Welcome Series automation created in Resend.
-- Replace the resend_automation_id if you recreate it under a different project.
insert into public.automations (name, trigger_type, resend_event_name, resend_automation_id, status)
values ('Welcome Series', 'contact_added', 'contact.added', '01a02377-a8d4-7619-8ce3-cd3803d4ce3a', 'active')
on conflict do nothing;

create extension if not exists pg_net with schema extensions;

create or replace function public.handle_new_contact()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  project_url text := 'https://clcqtvzluwapkbaxlyyf.supabase.co';
begin
  perform net.http_post(
    url := project_url || '/functions/v1/notify-automation-event',
    headers := jsonb_build_object('Content-Type', 'application/json'),
    body := jsonb_build_object(
      'eventName', 'contact.added',
      'contactEmail', new.email,
      'contactName', coalesce(new.name, ''),
      'contactId', new.id
    )
  );
  return new;
end;
$$;

drop trigger if exists on_contact_created on public.contacts;
create trigger on_contact_created
  after insert on public.contacts
  for each row
  execute function public.handle_new_contact();
