create table public.owner_followup_config (
  id boolean primary key default true check (id),
  enabled boolean not null default true,
  template text,
  updated_at timestamptz not null default now(),
  updated_by uuid
);
alter table public.owner_followup_config enable row level security;
grant select, insert, update on public.owner_followup_config to authenticated;
create policy "staff read owner followup config" on public.owner_followup_config for select to authenticated using (public.is_staff(auth.uid()));
create policy "owners editors write owner followup config" on public.owner_followup_config for all to authenticated using (public.has_perm(auth.uid(), 'owners', 'edit')) with check (public.has_perm(auth.uid(), 'owners', 'edit'));
insert into public.owner_followup_config (id, enabled) values (true, true) on conflict do nothing;

alter table public.message_log add column if not exists contact_id uuid references public.contacts(id) on delete set null;
alter table public.message_log add column if not exists kind text;
create index if not exists message_log_kind_contact_idx on public.message_log (kind, contact_id, created_at desc);
create policy "owners viewers read owner followup log" on public.message_log for select to authenticated using (kind = 'owner_biweekly' and public.has_perm(auth.uid(), 'owners', 'view'));