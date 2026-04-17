-- Patagonia Source v8.0 MVP final
-- SQL seguro para: adjuntos, notificaciones y solicitudes de actualización company_update

-- 0) Compatibilidad mínima de notifications para el inbox del usuario
alter table if exists public.notifications add column if not exists is_read boolean default false;
alter table if exists public.notifications add column if not exists read_at timestamptz;

-- 1) Normalización de paths ya guardados
-- companies / company_certifications van al bucket certificates
update public.companies
set cuit_constancia_url = 'certificates:' || cuit_constancia_url
where cuit_constancia_url is not null
  and cuit_constancia_url <> ''
  and cuit_constancia_url not like 'certificates:%'
  and cuit_constancia_url not like 'attachments:%'
  and cuit_constancia_url not like 'company-requests/%'
  and cuit_constancia_url not like 'company-docs/%';

update public.company_certifications
set file_url = 'certificates:' || file_url
where file_url is not null
  and file_url <> ''
  and file_url not like 'certificates:%'
  and file_url not like 'attachments:%'
  and file_url not like 'company-requests/%'
  and file_url not like 'company-docs/%';

-- company_requests.attachments: si el path empieza con company-requests/ o company-docs/ => attachments:
-- si no tiene prefijo y no es company-requests/company-docs => certificates:
update public.company_requests
set attachments = (
  select jsonb_agg(
    case
      when (elem->>'path') is null or (elem->>'path') = '' then elem
      when (elem->>'path') like 'attachments:%' or (elem->>'path') like 'certificates:%' then elem
      when (elem->>'path') like 'company-requests/%' or (elem->>'path') like 'company-docs/%'
        then jsonb_set(elem, '{path}', to_jsonb('attachments:' || (elem->>'path')))
      else jsonb_set(elem, '{path}', to_jsonb('certificates:' || (elem->>'path')))
    end
  )
  from jsonb_array_elements(attachments) as elem
)
where attachments is not null
  and jsonb_typeof(attachments) = 'array'
  and jsonb_array_length(attachments) > 0;

-- 2) create_notification seguro
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

alter table if exists public.notifications enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='notifications' and policyname='notifications_select_own'
  ) then
    create policy notifications_select_own
      on public.notifications
      for select
      to authenticated
      using (user_id = auth.uid());
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='notifications' and policyname='notifications_update_own'
  ) then
    create policy notifications_update_own
      on public.notifications
      for update
      to authenticated
      using (user_id = auth.uid())
      with check (user_id = auth.uid());
  end if;
end;
$$;

-- 3) submit_company_update_request_secure
create or replace function public.submit_company_update_request_secure(
  p_company_id uuid,
  p_request_payload jsonb default '{}'::jsonb,
  p_requester_message text default null,
  p_requester_phone text default null,
  p_attachments jsonb default '[]'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_request_id uuid;
begin
  if v_uid is null then
    raise exception 'No autenticado';
  end if;

  if not exists (
    select 1
    from public.company_members cm
    where cm.company_id = p_company_id
      and cm.user_id = v_uid
      and cm.role in ('owner','admin')
  )
  and not exists (
    select 1
    from public.profiles p
    where p.id = v_uid
      and p.rol_global = 'master'
  ) then
    raise exception 'Sin permisos para generar la solicitud de actualización';
  end if;

  select cr.id
    into v_request_id
  from public.company_requests cr
  where cr.requester_user_id = v_uid
    and cr.target_company_id = p_company_id
    and cr.request_type = 'company_update'
    and cr.status in ('pending','under_review','need_more_info')
  order by cr.created_at desc
  limit 1;

  if v_request_id is not null then
    update public.company_requests
       set status = 'pending',
           request_payload = coalesce(p_request_payload, '{}'::jsonb),
           requester_message = p_requester_message,
           requester_phone = p_requester_phone,
           attachments = coalesce(p_attachments, '[]'::jsonb)
     where id = v_request_id;
    return v_request_id;
  end if;

  insert into public.company_requests (
    requester_user_id,
    request_type,
    target_company_id,
    assigned_role,
    status,
    request_payload,
    requester_message,
    requester_phone,
    attachments
  )
  values (
    v_uid,
    'company_update',
    p_company_id,
    'owner',
    'pending',
    coalesce(p_request_payload, '{}'::jsonb),
    p_requester_message,
    p_requester_phone,
    coalesce(p_attachments, '[]'::jsonb)
  )
  returning id into v_request_id;

  return v_request_id;
end;
$$;
revoke all on function public.submit_company_update_request_secure(uuid, jsonb, text, text, jsonb) from public;
grant execute on function public.submit_company_update_request_secure(uuid, jsonb, text, text, jsonb) to authenticated;
