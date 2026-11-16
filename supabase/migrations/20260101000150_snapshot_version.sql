-- keep snapshot.version in lockstep with the identity version
create or replace function public.sync_snapshot_version()
returns trigger language plpgsql as $$
begin
  new.snapshot := jsonb_set(new.snapshot, '{version}', to_jsonb(new.version));
  return new;
end $$;

create trigger published_configs_sync_version before insert on public.published_configs
  for each row execute function public.sync_snapshot_version();
