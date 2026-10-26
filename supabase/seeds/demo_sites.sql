-- Example sites so the sites page and flight matching work on a fresh local database.
-- Coordinates are APPROXIMATE and unverified: a moderator must check them before launch.

insert into public.sites (slug, name, kind, lat, lng, elevation_m, wind_directions, region, description, verified) values
  ('babadag', 'Babadağ', 'launch', 36.5338, 29.1857, 1700, '{W,SW,S}', 'Fethiye, Muğla',
   'Örnek kayıt: koordinatlar yaklaşıktır. / Example entry: approximate coordinates.', false),
  ('oludeniz-plaj', 'Ölüdeniz plaj inişi', 'landing', 36.5495, 29.1150, 2, '{}', 'Fethiye, Muğla',
   'Örnek kayıt: koordinatlar yaklaşıktır. / Example entry: approximate coordinates.', false),
  ('pamukkale', 'Pamukkale', 'launch', 37.9090, 29.1310, 600, '{W,SW}', 'Denizli',
   'Örnek kayıt: koordinatlar yaklaşıktır. / Example entry: approximate coordinates.', false),
  ('ali-dagi', 'Ali Dağı', 'launch', 38.6930, 35.5440, 1850, '{N,NW,W}', 'Kayseri',
   'Örnek kayıt: koordinatlar yaklaşıktır. / Example entry: approximate coordinates.', false)
on conflict (slug) do nothing;
