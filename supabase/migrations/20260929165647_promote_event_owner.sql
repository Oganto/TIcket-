do $$
declare
  owner_id uuid;
begin
  select u.id into owner_id
  from auth.users u
  join public.profiles p on p.id = u.id
  where lower(u.email) = lower('tomilolaisraeloginni@gmail.com')
    and u.email_confirmed_at is not null;

  if owner_id is null then
    raise exception 'The confirmed owner account was not found';
  end if;

  update public.profiles
  set role = 'admin'
  where id = owner_id;
end;
$$;