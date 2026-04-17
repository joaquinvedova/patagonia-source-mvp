-- Ejecutar solo si create_notification(...) no existe con esta firma
create or replace function public.create_notification(
  p_user_id uuid,
  p_type text,
  p_title text,
  p_body text,
  p_category text,
  p_meta jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  insert into public.notifications (user_id, type, title, body, category, meta)
  values (p_user_id, p_type, p_title, p_body, p_category, coalesce(p_meta, '{}'::jsonb))
  returning id into v_id;
  return v_id;
end;
$$;

revoke all on function public.create_notification(uuid, text, text, text, text, jsonb) from public;
grant execute on function public.create_notification(uuid, text, text, text, text, jsonb) to authenticated;
