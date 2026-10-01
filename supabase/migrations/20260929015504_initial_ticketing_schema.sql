create extension if not exists pgcrypto;

create type public.app_role as enum ('customer', 'staff', 'admin');
create type public.event_status as enum ('draft', 'published', 'archived');
create type public.ticket_type_status as enum ('active', 'paused', 'sold_out');
create type public.payment_status as enum ('pending', 'approved', 'rejected');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  email text not null,
  phone text,
  role public.app_role not null default 'customer',
  created_at timestamptz not null default now()
);

create table public.events (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text not null default '',
  event_date date,
  event_time text,
  venue text not null default '',
  image_path text,
  status public.event_status not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.ticket_types (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  name text not null,
  description text not null default '',
  price numeric(12, 2) not null check (price >= 0),
  quantity_available integer not null check (quantity_available >= 0),
  quantity_sold integer not null default 0 check (quantity_sold >= 0),
  status public.ticket_type_status not null default 'active',
  created_at timestamptz not null default now(),
  check (quantity_sold <= quantity_available)
);

create table public.payment_settings (
  event_id uuid primary key references public.events(id) on delete cascade,
  bank text not null default '',
  account_name text not null default '',
  account_number text not null default '',
  updated_at timestamptz not null default now()
);

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete restrict,
  event_id uuid not null references public.events(id) on delete restrict,
  ticket_type_id uuid not null references public.ticket_types(id) on delete restrict,
  quantity integer not null check (quantity > 0),
  total_amount numeric(12, 2) not null check (total_amount >= 0),
  payment_status public.payment_status not null default 'pending',
  payment_proof_path text not null,
  rejection_reason text,
  created_at timestamptz not null default now(),
  approved_at timestamptz,
  reviewed_at timestamptz
);

create table public.tickets (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete restrict,
  user_id uuid not null references public.profiles(id) on delete restrict,
  ticket_type_id uuid not null references public.ticket_types(id) on delete restrict,
  ticket_code text not null unique,
  qr_value uuid not null unique default gen_random_uuid(),
  status text not null default 'valid' check (status in ('valid', 'cancelled')),
  checked_in boolean not null default false,
  checked_in_at timestamptz,
  created_at timestamptz not null default now()
);

create index orders_user_created_idx on public.orders(user_id, created_at desc);
create index orders_status_created_idx on public.orders(payment_status, created_at desc);
create index tickets_user_created_idx on public.tickets(user_id, created_at desc);
create index tickets_order_idx on public.tickets(order_id);

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and role = 'admin'
  );
$$;

create or replace function public.can_check_in()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and role in ('admin', 'staff')
  );
$$;

create or replace function public.create_profile_for_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, phone)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    new.raw_user_meta_data ->> 'phone'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.create_profile_for_auth_user();

alter table public.profiles enable row level security;
alter table public.events enable row level security;
alter table public.ticket_types enable row level security;
alter table public.payment_settings enable row level security;
alter table public.orders enable row level security;
alter table public.tickets enable row level security;

create policy "Profiles visible to owner and admins"
  on public.profiles for select to authenticated
  using (id = (select auth.uid()) or (select public.is_admin()));

create policy "Published events are public"
  on public.events for select to anon, authenticated
  using (status = 'published' or (select public.is_admin()));
create policy "Admins manage events"
  on public.events for all to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

create policy "Active ticket types for published events are public"
  on public.ticket_types for select to anon, authenticated
  using (
    (status = 'active' and exists (
      select 1 from public.events e
      where e.id = event_id and e.status = 'published'
    )) or (select public.is_admin())
  );
create policy "Admins manage ticket types"
  on public.ticket_types for all to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

create policy "Signed-in customers can read payment details for published events"
  on public.payment_settings for select to authenticated
  using (
    exists (select 1 from public.events e where e.id = event_id and e.status = 'published')
    or (select public.is_admin())
  );
create policy "Admins manage payment details"
  on public.payment_settings for all to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

create policy "Customers and admins can read orders"
  on public.orders for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));

create policy "Customers and authorized staff can read tickets"
  on public.tickets for select to authenticated
  using (
    user_id = (select auth.uid())
    or (select public.is_admin())
    or (select public.can_check_in())
  );

create or replace function public.submit_order(
  p_event_id uuid,
  p_ticket_type_id uuid,
  p_quantity integer,
  p_payment_proof_path text
)
returns uuid
language plpgsql
security definer
set search_path = public, storage
as $$
declare
  current_user_id uuid := auth.uid();
  selected_ticket public.ticket_types%rowtype;
  new_order_id uuid;
begin
  if current_user_id is null then
    raise exception 'Authentication required';
  end if;
  if p_quantity < 1 or p_quantity > 20 then
    raise exception 'Quantity must be between 1 and 20';
  end if;
  if p_payment_proof_path not like current_user_id::text || '/%' then
    raise exception 'Invalid payment proof path';
  end if;
  if not exists (
    select 1 from storage.objects
    where bucket_id = 'payment-proofs' and name = p_payment_proof_path
  ) then
    raise exception 'Payment proof was not uploaded';
  end if;

  select * into selected_ticket
  from public.ticket_types
  where id = p_ticket_type_id and event_id = p_event_id
    and status = 'active'
  for share;

  if not found or not exists (
    select 1 from public.events where id = p_event_id and status = 'published'
  ) then
    raise exception 'Ticket type is unavailable';
  end if;

  insert into public.orders (
    user_id, event_id, ticket_type_id, quantity, total_amount, payment_proof_path
  ) values (
    current_user_id, p_event_id, p_ticket_type_id, p_quantity,
    selected_ticket.price * p_quantity, p_payment_proof_path
  ) returning id into new_order_id;

  return new_order_id;
end;
$$;

create or replace function public.approve_order(p_order_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  selected_order public.orders%rowtype;
  selected_ticket public.ticket_types%rowtype;
  random_code text;
  ticket_index integer;
begin
  if not public.is_admin() then
    raise exception 'Admin access required';
  end if;

  select * into selected_order from public.orders where id = p_order_id for update;
  if not found or selected_order.payment_status <> 'pending' then
    raise exception 'Order is not pending';
  end if;

  select * into selected_ticket
  from public.ticket_types where id = selected_order.ticket_type_id for update;
  if selected_ticket.quantity_sold + selected_order.quantity > selected_ticket.quantity_available then
    raise exception 'Not enough tickets remain for this order';
  end if;

  update public.ticket_types
  set quantity_sold = quantity_sold + selected_order.quantity
  where id = selected_ticket.id;

  update public.orders
  set payment_status = 'approved', approved_at = now(), reviewed_at = now(), rejection_reason = null
  where id = p_order_id;

  for ticket_index in 1..selected_order.quantity loop
    random_code := 'EVT-' || upper(substr(encode(gen_random_bytes(8), 'hex'), 1, 8))
      || '-' || upper(substr(encode(gen_random_bytes(8), 'hex'), 1, 8));
    insert into public.tickets (order_id, user_id, ticket_type_id, ticket_code)
    values (p_order_id, selected_order.user_id, selected_order.ticket_type_id, random_code);
  end loop;

  return p_order_id;
end;
$$;

create or replace function public.reject_order(p_order_id uuid, p_reason text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Admin access required';
  end if;
  update public.orders
  set payment_status = 'rejected', rejection_reason = nullif(trim(p_reason), ''), reviewed_at = now()
  where id = p_order_id and payment_status = 'pending';
  if not found then
    raise exception 'Order is not pending';
  end if;
  return p_order_id;
end;
$$;

create or replace function public.verify_ticket(p_qr_value uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  ticket_record record;
begin
  if not public.can_check_in() then
    raise exception 'Staff access required';
  end if;
  select t.id, t.ticket_code, t.status, t.checked_in, t.checked_in_at,
    e.name as event_name, e.event_date, e.event_time, e.venue,
    tt.name as ticket_type, p.full_name as customer_name
  into ticket_record
  from public.tickets t
  join public.orders o on o.id = t.order_id
  join public.events e on e.id = o.event_id
  join public.ticket_types tt on tt.id = t.ticket_type_id
  join public.profiles p on p.id = t.user_id
  where t.qr_value = p_qr_value;

  if not found then
    return jsonb_build_object('result', 'invalid');
  end if;
  return jsonb_build_object(
    'result', case when ticket_record.checked_in then 'used' when ticket_record.status <> 'valid' then 'invalid' else 'valid' end,
    'ticket_id', ticket_record.id,
    'ticket_code', ticket_record.ticket_code,
    'checked_in_at', ticket_record.checked_in_at,
    'event_name', ticket_record.event_name,
    'event_date', ticket_record.event_date,
    'event_time', ticket_record.event_time,
    'venue', ticket_record.venue,
    'ticket_type', ticket_record.ticket_type,
    'customer_name', ticket_record.customer_name
  );
end;
$$;

create or replace function public.check_in_ticket(p_qr_value uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  selected_ticket public.tickets%rowtype;
  result_data jsonb;
begin
  if not public.can_check_in() then
    raise exception 'Staff access required';
  end if;

  select * into selected_ticket from public.tickets where qr_value = p_qr_value for update;
  if not found or selected_ticket.status <> 'valid' then
    return jsonb_build_object('result', 'invalid');
  end if;
  if selected_ticket.checked_in then
    return public.verify_ticket(p_qr_value);
  end if;

  update public.tickets set checked_in = true, checked_in_at = now()
  where id = selected_ticket.id;
  result_data := public.verify_ticket(p_qr_value);
  return result_data;
end;
$$;

revoke all on function public.submit_order(uuid, uuid, integer, text) from public;
revoke all on function public.approve_order(uuid) from public;
revoke all on function public.reject_order(uuid, text) from public;
revoke all on function public.verify_ticket(uuid) from public;
revoke all on function public.check_in_ticket(uuid) from public;
grant execute on function public.submit_order(uuid, uuid, integer, text) to authenticated;
grant execute on function public.approve_order(uuid) to authenticated;
grant execute on function public.reject_order(uuid, text) to authenticated;
grant execute on function public.verify_ticket(uuid) to authenticated;
grant execute on function public.check_in_ticket(uuid) to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('payment-proofs', 'payment-proofs', false, 10485760, array['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
on conflict (id) do update set public = false, file_size_limit = 10485760,
  allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('event-assets', 'event-assets', true, 10485760, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = true, file_size_limit = 10485760,
  allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp'];

create policy "Event flyer images are public"
  on storage.objects for select to anon, authenticated
  using (bucket_id = 'event-assets');
create policy "Admins manage event flyer images"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'event-assets' and (select public.is_admin()));
create policy "Admins update event flyer images"
  on storage.objects for update to authenticated
  using (bucket_id = 'event-assets' and (select public.is_admin()))
  with check (bucket_id = 'event-assets' and (select public.is_admin()));
create policy "Admins delete event flyer images"
  on storage.objects for delete to authenticated
  using (bucket_id = 'event-assets' and (select public.is_admin()));

create policy "Customers upload their own payment proofs"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'payment-proofs'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
create policy "Customers and admins read payment proofs"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'payment-proofs'
    and (
      (storage.foldername(name))[1] = (select auth.uid())::text
      or (select public.is_admin())
    )
  );

grant select on public.profiles, public.events, public.ticket_types, public.payment_settings,
  public.orders, public.tickets to anon, authenticated;
grant insert, update, delete on public.events, public.ticket_types, public.payment_settings
  to authenticated;