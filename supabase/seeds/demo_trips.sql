-- Example trips so the trips pages are not empty on a fresh `pnpm db:reset`.
-- Marked as examples; delete or edit them from Admin → Trips before launch.

insert into public.trips (
  slug, title, summary, description_md, itinerary_md, destination_country, destination_region,
  starts_on, ends_on, meeting_point, meeting_at, registration_deadline,
  max_pilots, min_pilots, companions_allowed, min_pilot_level, min_years_flying, min_flights,
  required_equipment, price_amount, price_currency, deposit_amount, payment_deadline,
  price_includes, price_excludes, cancellation_policy, accommodation, transport, auto_accept, status
) values
  ('babadag-sonbahar-kampi', 'Babadağ sonbahar kampı (örnek)',
   'Ölüdeniz''de dört gün termik ve kıyı uçuşu. (Örnek içerik)',
   E'Sezon sonu Babadağ kampı. Sabahları kısa termik uçuşları, öğleden sonra kıyı boyunca uçuş.\n\n> Bu bir örnek gezidir; yayına almadan önce yönetim panelinden silin.',
   E'**1. gün:** Varış, brifing, akşam yemeği\n**2.–3. gün:** Babadağ uçuşları\n**4. gün:** Sabah uçuşu ve dönüş',
   'TR', 'Ölüdeniz, Fethiye', current_date + 30, current_date + 33,
   'Ölüdeniz plaj inişi', (current_date + 30 + time '10:00') at time zone 'Europe/Istanbul',
   (current_date + 20)::timestamptz,
   12, 5, true, 'p3', 1, 30, '{reserve,helmet,radio,harness_protector}',
   9500, 'TRY', 2500, current_date + 22,
   'Konaklama (3 gece), kahvaltı, kalkışa transfer, rehberlik',
   'Ulaşım, öğle ve akşam yemekleri, sigorta',
   '30 günden önce iptal: kapora iade edilir. Sonrasında: yalnızca yerinize biri gelirse iade.',
   'Ölüdeniz''de pansiyon, iki kişilik odalar', 'Kulüp minibüsü İstanbul''dan; kendi aracınızla da gelebilirsiniz.',
   false, 'open'),
  ('nepal-pokhara-2027', 'Pokhara, Nepal (example)',
   'Two weeks of Himalayan thermals for experienced pilots. (Example content)',
   E'Fly Sarangkot with the Annapurna range in front of you.\n\n> This is an example trip; delete it from the admin area before launch.',
   '', 'NP', 'Pokhara', current_date + 120, current_date + 133,
   'İstanbul Airport', null, null,
   8, null, false, 'p4', 3, 150, '{reserve,helmet,radio,insurance,live_tracker}',
   1800, 'EUR', 500, current_date + 90,
   'Guesthouse, guides, daily transfers', 'Flights to Nepal, visa, meals',
   null, null, null, false, 'open')
on conflict (slug) do nothing;

insert into public.trip_sites (trip_id, site_id, position)
select t.id, s.id, x.pos
from (values ('babadag-sonbahar-kampi', 'babadag', 0), ('babadag-sonbahar-kampi', 'oludeniz-plaj', 1))
  as x(trip, site, pos)
join public.trips t on t.slug = x.trip
join public.sites s on s.slug = x.site
on conflict do nothing;
