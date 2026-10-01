with new_event as (
  insert into public.events (name, description, event_date, event_time, venue, status)
  values (
    'THE TAKE OVER',
    'ONE CAMPUS ONE NIGHT NO LIMIT',
    null,
    '9 PM',
    'Club Luna, Opposite EKSU Field',
    'draft'
  )
  returning id
)
insert into public.ticket_types (event_id, name, description, price, quantity_available, quantity_sold, status)
select id, ticket.name, ticket.description, ticket.price, 0, 0, 'paused'
from new_event
cross join (values
  ('Regular Ladies', '', 1000::numeric),
  ('Regular Guys', '', 1500::numeric),
  ('VIP', '', 5000::numeric),
  ('VVIP', '', 50000::numeric),
  ('Table for 4', '', 10000::numeric),
  ('Silver Table 4', 'Includes 2 ladies', 50000::numeric),
  ('Golden Table 6', 'Includes 3 ladies', 100000::numeric)
) as ticket(name, description, price);