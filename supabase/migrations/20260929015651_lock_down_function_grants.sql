revoke all on function public.is_admin() from public, anon, authenticated;
revoke all on function public.can_check_in() from public, anon, authenticated;
revoke all on function public.create_profile_for_auth_user() from public, anon, authenticated;
revoke all on function public.submit_order(uuid, uuid, integer, text) from public, anon, authenticated;
revoke all on function public.approve_order(uuid) from public, anon, authenticated;
revoke all on function public.reject_order(uuid, text) from public, anon, authenticated;
revoke all on function public.verify_ticket(uuid) from public, anon, authenticated;
revoke all on function public.check_in_ticket(uuid) from public, anon, authenticated;

grant execute on function public.is_admin() to authenticated;
grant execute on function public.can_check_in() to authenticated;
grant execute on function public.submit_order(uuid, uuid, integer, text) to authenticated;
grant execute on function public.approve_order(uuid) to authenticated;
grant execute on function public.reject_order(uuid, text) to authenticated;
grant execute on function public.verify_ticket(uuid) to authenticated;
grant execute on function public.check_in_ticket(uuid) to authenticated;

create index ticket_types_event_idx on public.ticket_types(event_id);
create index orders_event_idx on public.orders(event_id);
create index orders_ticket_type_idx on public.orders(ticket_type_id);
create index tickets_ticket_type_idx on public.tickets(ticket_type_id);

drop policy "Published events are public" on public.events;
drop policy "Admins manage events" on public.events;
create policy "Published events are public to anon"
  on public.events for select to anon using (status = 'published');
create policy "Published events and admin events visible to authenticated"
  on public.events for select to authenticated
  using (status = 'published' or (select public.is_admin()));
create policy "Admins insert events"
  on public.events for insert to authenticated
  with check ((select public.is_admin()));
create policy "Admins update events"
  on public.events for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "Admins delete events"
  on public.events for delete to authenticated
  using ((select public.is_admin()));

drop policy "Active ticket types for published events are public" on public.ticket_types;
drop policy "Admins manage ticket types" on public.ticket_types;
create policy "Active ticket types are public to anon"
  on public.ticket_types for select to anon
  using (status = 'active' and exists (
    select 1 from public.events e where e.id = event_id and e.status = 'published'
  ));
create policy "Active ticket types and admin inventory visible to authenticated"
  on public.ticket_types for select to authenticated
  using (
    (status = 'active' and exists (
      select 1 from public.events e where e.id = event_id and e.status = 'published'
    )) or (select public.is_admin())
  );
create policy "Admins insert ticket types"
  on public.ticket_types for insert to authenticated
  with check ((select public.is_admin()));
create policy "Admins update ticket types"
  on public.ticket_types for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "Admins delete ticket types"
  on public.ticket_types for delete to authenticated
  using ((select public.is_admin()));

drop policy "Admins manage payment details" on public.payment_settings;
create policy "Admins insert payment details"
  on public.payment_settings for insert to authenticated
  with check ((select public.is_admin()));
create policy "Admins update payment details"
  on public.payment_settings for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "Admins delete payment details"
  on public.payment_settings for delete to authenticated
  using ((select public.is_admin()));