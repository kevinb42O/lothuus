-- Supabase Cron: daily retention independently from application traffic.
-- https://supabase.com/docs/guides/cron/install
begin;
create extension if not exists pg_cron with schema pg_catalog;
grant usage on schema cron to postgres;
grant all privileges on all tables in schema cron to postgres;
select cron.schedule('lothuus-heart-retention', '17 3 * * *', 'select public.lothuus_heart_cleanup()');
commit;
