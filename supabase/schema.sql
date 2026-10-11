-- Postbox Finder – Community-Beiträge
-- Ausführen im Supabase SQL-Editor (Free Tier reicht).
-- Sicherheitsmodell: Der öffentliche anon-Key darf NUR Beiträge anlegen und die
-- aggregierte Sicht lesen. Einzelne Beiträge (inkl. client_id) sind nicht lesbar.

create extension if not exists postgis;
create extension if not exists pgcrypto;

do $$ begin
  create type report_kind as enum (
    'correction',            -- Information korrigieren
    'missing',               -- Briefkasten fehlt
    'removed',               -- Briefkasten entfernt
    'collection_times',      -- Leerungszeit aktualisieren
    'colour_inscription',    -- Farbe oder Beschriftung ergänzen
    'shipping'               -- Internationalen Versand bestätigen / nur Inland
  );
exception when duplicate_object then null; end $$;

create table if not exists public.postbox_reports (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  kind        report_kind not null,
  -- Id aus der Datenquelle, z. B. "osm:node/123". NULL bei "Briefkasten fehlt".
  postbox_id  text check (postbox_id is null or postbox_id ~ '^[a-z]+:[a-z]+/[0-9]+$'),
  location    geography(point, 4326) not null,
  -- betroffenes Attribut, z. B. "colour", "inscription", "collection_times", "shipping", "exists"
  field       text not null check (char_length(field) <= 40),
  value       text check (char_length(value) <= 300),
  comment     text check (char_length(comment) <= 1000),
  -- zufällige Geräte-Id (keine personenbezogenen Daten), für Mehrfach-Bestätigungen und Rate-Limit
  client_id   uuid not null,
  -- Moderation: 'hidden' blendet Spam aus
  moderation  text not null default 'visible' check (moderation in ('visible', 'hidden')),
  source_app  text not null default 'postbox-finder'
);

create index if not exists postbox_reports_postbox_idx on public.postbox_reports (postbox_id);
create index if not exists postbox_reports_location_idx on public.postbox_reports using gist (location);
create index if not exists postbox_reports_client_idx on public.postbox_reports (client_id, created_at);

-- Einfaches Rate-Limit: max. 20 Beiträge pro Gerät und Stunde, 1 identischer Beitrag pro Tag.
create or replace function public.postbox_reports_rate_limit() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from postbox_reports
      where client_id = new.client_id and created_at > now() - interval '1 hour') >= 20 then
    raise exception 'rate_limited';
  end if;
  if exists (select 1 from postbox_reports
      where client_id = new.client_id and postbox_id is not distinct from new.postbox_id
        and field = new.field and value is not distinct from new.value
        and created_at > now() - interval '1 day') then
    raise exception 'duplicate';
  end if;
  new.created_at := now();
  new.moderation := 'visible';
  return new;
end $$;

drop trigger if exists postbox_reports_rate_limit on public.postbox_reports;
create trigger postbox_reports_rate_limit before insert on public.postbox_reports
  for each row execute function public.postbox_reports_rate_limit();

alter table public.postbox_reports enable row level security;

drop policy if exists "anon can insert reports" on public.postbox_reports;
create policy "anon can insert reports" on public.postbox_reports
  for insert to anon, authenticated with check (true);
-- Keine select-Policy: einzelne Beiträge sind über die API nicht lesbar.

-- Aggregierte Sicht mit Verifizierungsstatus:
--   confirmed   = mind. 2 verschiedene Geräte nennen denselben Wert, kein anderer Wert
--   conflicting = es wurden unterschiedliche Werte gemeldet
--   unverified  = sonst
create or replace view public.postbox_report_summary as
with v as (
  select postbox_id, field, coalesce(value, '') as value,
         count(distinct client_id) as devices,
         max(created_at) as last_report,
         min(st_y(location::geometry)) as lat,
         min(st_x(location::geometry)) as lon
  from public.postbox_reports
  where moderation = 'visible' and created_at > now() - interval '3 years'
  group by postbox_id, field, coalesce(value, '')
), f as (
  select postbox_id, field, count(*) as distinct_values from v group by postbox_id, field
)
select v.postbox_id, v.field, v.value, v.devices, v.last_report, v.lat, v.lon,
  case
    when f.distinct_values > 1 then 'conflicting'
    when v.devices >= 2 then 'confirmed'
    else 'unverified'
  end as status
from v join f on f.postbox_id is not distinct from v.postbox_id and f.field = v.field;

grant select on public.postbox_report_summary to anon, authenticated;
grant insert on public.postbox_reports to anon, authenticated;
