create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;

do $$
declare tok text;
begin
  select shared_token into tok from public.automation_config where id;
  if tok is null then return; end if;

  perform cron.unschedule(jobid) from cron.job where jobname = 'rashoudi_hourly_automation';

  perform cron.schedule(
    'rashoudi_hourly_automation',
    '5 * * * *',
    format($cmd$select net.http_get(url := 'https://alrashudi.sa/api/public/n8n', headers := jsonb_build_object('Content-Type','application/json','x-mithra-token','%s'), timeout_milliseconds := 55000);$cmd$, tok)
  );
end $$;