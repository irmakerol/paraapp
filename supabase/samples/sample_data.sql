-- Sample people, events and flying sites for the test server and local development.
-- Every sample record carries "(Ö)" (Örnek); the website shows it as "(S)" (Sample) in English.
-- Sample accounts have no password and cannot sign in. Safe to run more than once.
-- Delete before launch: everything with "(Ö)" in its name/title, and users @example.invalid.

-- People -------------------------------------------------------------------------------------
insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
                        raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
select '00000000-0000-0000-0000-000000000000', u.id::uuid, 'authenticated', 'authenticated', u.email, '', now(),
       '{"provider":"email","providers":["email"]}'::jsonb,
       jsonb_build_object('display_name', u.name, 'birth_date', u.birth, 'locale', 'tr'), now(), now()
from (values
  ('a0000000-0000-4000-8000-000000000001', 'ornek-ayse@example.invalid',  'Ayşe Demir (Ö)',    '1984-04-12'),
  ('a0000000-0000-4000-8000-000000000002', 'ornek-mehmet@example.invalid','Mehmet Kaya (Ö)',   '1979-09-03'),
  ('a0000000-0000-4000-8000-000000000003', 'ornek-elif@example.invalid',  'Elif Şahin (Ö)',    '1993-01-25'),
  ('a0000000-0000-4000-8000-000000000004', 'ornek-can@example.invalid',   'Can Yıldız (Ö)',    '1998-06-30'),
  ('a0000000-0000-4000-8000-000000000005', 'ornek-zeynep@example.invalid','Zeynep Arslan (Ö)', '1988-11-08'),
  ('a0000000-0000-4000-8000-000000000006', 'ornek-burak@example.invalid', 'Burak Öztürk (Ö)',  '1990-02-17'),
  ('a0000000-0000-4000-8000-000000000007', 'ornek-deniz@example.invalid', 'Deniz Aydın (Ö)',   '1986-07-21'),
  ('a0000000-0000-4000-8000-000000000008', 'ornek-selin@example.invalid', 'Selin Koç (Ö)',     '2001-03-14')
) as u(id, email, name, birth)
on conflict (id) do nothing;

update public.profiles p set
  full_name = s.full_name, city = s.city, country = 'TR', home_site = s.home_site,
  pilot_level = s.level::public.pilot_level, flying_since = s.since, wings = s.wings, bio = s.bio,
  total_flights = s.flights, total_flight_hours = s.hours
from (values
  ('a0000000-0000-4000-8000-000000000001', 'Ayşe Demir (Ö)', 'İstanbul', 'Babadağ', 'instructor', 2008, 'Ozone Rush 6',
   'Kulüp eğitmeni (örnek profil). P1–P3 kursları ve SIV hazırlığı.', 1850, 1420.5),
  ('a0000000-0000-4000-8000-000000000002', 'Mehmet Kaya (Ö)', 'Fethiye', 'Babadağ', 't3', 2004, 'Advance Bibeta 6',
   'Tandem pilotu ve eğitmen (örnek profil).', 4200, 2610.0),
  ('a0000000-0000-4000-8000-000000000003', 'Elif Şahin (Ö)', 'Ankara', 'Ali Dağı', 'p3', 2019, 'Gin Explorer 2',
   'Hafta sonu XC pilotu (örnek profil).', 180, 162.0),
  ('a0000000-0000-4000-8000-000000000004', 'Can Yıldız (Ö)', 'İstanbul', 'Sapanca', 'p2', 2023, 'Niviuk Hook 6',
   'Yeni pilot, termik öğreniyor (örnek profil).', 42, 18.5),
  ('a0000000-0000-4000-8000-000000000005', 'Zeynep Arslan (Ö)', 'İzmir', 'Pamukkale', 'p4', 2012, 'Ozone Alpina 4',
   'Kulüp gezilerini organize ediyor (örnek profil).', 760, 905.0),
  ('a0000000-0000-4000-8000-000000000006', 'Burak Öztürk (Ö)', 'Antalya', 'Kaş', 'p3', 2017, 'Phi Maestro 2',
   'Kıyı uçuşlarını seviyor (örnek profil).', 310, 240.0),
  ('a0000000-0000-4000-8000-000000000007', 'Deniz Aydın (Ö)', 'Bursa', 'Babadağ', 'p5', 2010, 'Ozone Zeno 2',
   'Yarışma pilotu (örnek profil).', 1240, 1650.0),
  ('a0000000-0000-4000-8000-000000000008', 'Selin Koç (Ö)', 'İstanbul', 'Sapanca', 'p2', 2024, 'Skywalk Arak 2',
   'İlk sezonunda (örnek profil).', 25, 9.0)
) as s(id, full_name, city, home_site, level, since, wings, bio, flights, hours)
where p.id = s.id::uuid;

insert into public.user_roles (user_id, role)
select u.id::uuid, r.role::public.app_role
from (values
  ('a0000000-0000-4000-8000-000000000001', 'member'), ('a0000000-0000-4000-8000-000000000001', 'instructor'),
  ('a0000000-0000-4000-8000-000000000002', 'member'), ('a0000000-0000-4000-8000-000000000002', 'instructor'),
  ('a0000000-0000-4000-8000-000000000003', 'member'), ('a0000000-0000-4000-8000-000000000003', 'safety_officer'),
  ('a0000000-0000-4000-8000-000000000004', 'member'), ('a0000000-0000-4000-8000-000000000004', 'admin'),
  ('a0000000-0000-4000-8000-000000000005', 'member'), ('a0000000-0000-4000-8000-000000000005', 'trip_organiser'),
  ('a0000000-0000-4000-8000-000000000006', 'member'), ('a0000000-0000-4000-8000-000000000006', 'guide'),
  ('a0000000-0000-4000-8000-000000000007', 'member'), ('a0000000-0000-4000-8000-000000000007', 'moderator'),
  ('a0000000-0000-4000-8000-000000000008', 'member'), ('a0000000-0000-4000-8000-000000000008', 'student_pilot'),
  -- Licensed pilots (everyone except Selin, who is still in training).
  ('a0000000-0000-4000-8000-000000000001', 'pilot'), ('a0000000-0000-4000-8000-000000000002', 'pilot'),
  ('a0000000-0000-4000-8000-000000000003', 'pilot'), ('a0000000-0000-4000-8000-000000000004', 'pilot'),
  ('a0000000-0000-4000-8000-000000000005', 'pilot'), ('a0000000-0000-4000-8000-000000000006', 'pilot'),
  ('a0000000-0000-4000-8000-000000000007', 'pilot')
) as r(id, role)
join auth.users u on u.id = r.id::uuid
on conflict do nothing;
-- Earlier versions made Selin a licensed pilot.
delete from public.user_roles
where user_id = 'a0000000-0000-4000-8000-000000000008' and role = 'pilot';

-- Sample pilots agreed to a public profile so guests can see them too.
insert into public.consents (user_id, consent_type, granted, method)
select u.id, c.consent_type::public.consent_type, c.granted, 'signup'
from auth.users u
cross join (values ('public_profile', true), ('marketing_notifications', false), ('analytics', false))
  as c(consent_type, granted)
where u.email like 'ornek-%@example.invalid'
  and not exists (select 1 from public.consents x where x.user_id = u.id);

-- Flying sites (coordinates and heights are APPROXIMATE) ----------------------------------------
insert into public.sites (slug, name, kind, lat, lng, elevation_m, wind_directions, region, description, verified) values
  ('babadag-1900', 'Babadağ 1900 kalkışı (Ö)', 'launch', 36.5372, 29.1905, 1900, '{W,SW,S}', 'Fethiye, Muğla',
   'Örnek kayıt: Babadağ''ın üst kalkışı. Koordinatlar ve yükseklik yaklaşıktır.', false),
  ('kas-asas', 'Kaş – Asas kalkışı (Ö)', 'launch', 36.2265, 29.6395, 980, '{S,SW}', 'Kaş, Antalya',
   'Örnek kayıt: Kaş üzerinde kıyı uçuşu. Koordinatlar ve yükseklik yaklaşıktır.', false),
  ('kas-inis', 'Kaş iniş alanı (Ö)', 'landing', 36.2005, 29.6375, 5, '{}', 'Kaş, Antalya',
   'Örnek kayıt: Kaş sahilinde iniş. Koordinatlar yaklaşıktır.', false),
  ('alanya-kale', 'Alanya kalkışı (Ö)', 'launch', 36.5560, 31.9890, 650, '{S,SW}', 'Alanya, Antalya',
   'Örnek kayıt: Alanya üzerinde kıyı uçuşu. Koordinatlar ve yükseklik yaklaşıktır.', false),
  ('alanya-kleopatra', 'Alanya Kleopatra plajı inişi (Ö)', 'landing', 36.5480, 31.9840, 2, '{}', 'Alanya, Antalya',
   'Örnek kayıt: plaj inişi. Koordinatlar yaklaşıktır.', false),
  ('sapanca-kirkpinar', 'Sapanca – Kırkpınar (Ö)', 'launch', 40.6965, 30.2740, 480, '{N,NW}', 'Sapanca, Sakarya',
   'Örnek kayıt: İstanbul''a yakın eğitim ve hafta sonu tepesi. Koordinatlar ve yükseklik yaklaşıktır.', false),
  ('sapanca-inis', 'Sapanca iniş alanı (Ö)', 'landing', 40.7130, 30.2610, 40, '{}', 'Sapanca, Sakarya',
   'Örnek kayıt: göl kenarında iniş. Koordinatlar yaklaşıktır.', false),
  ('ali-dagi-inis', 'Ali Dağı iniş alanı (Ö)', 'landing', 38.7120, 35.5280, 1080, '{}', 'Kayseri',
   'Örnek kayıt: Ali Dağı eteklerinde iniş. Koordinatlar yaklaşıktır.', false)
on conflict (slug) do nothing;

-- Events ---------------------------------------------------------------------------------------
insert into public.events (slug, title, description_md, kind, starts_at, ends_at, site_id, location_text,
                           members_only, capacity, rsvp_deadline, status, created_by)
select e.slug, e.title, e.body, e.kind::public.event_kind,
       (current_date + e.day_offset + e.start_time) at time zone 'Europe/Istanbul',
       (current_date + e.day_offset + e.end_days + e.end_time) at time zone 'Europe/Istanbul',
       (select id from public.sites where slug = e.site), e.location, e.members_only, e.capacity,
       case when e.capacity is not null
            then (current_date + e.day_offset - 2 + time '20:00') at time zone 'Europe/Istanbul' end,
       'published', 'a0000000-0000-4000-8000-000000000001'::uuid
from (values
  ('ornek-babadag-hafta-sonu', 'Babadağ hafta sonu uçuşu (Ö)',
   E'Kulüpçe Babadağ''da iki gün uçuyoruz. Cumartesi sabah 07:30''da Ölüdeniz''de buluşma.\n\n> Örnek etkinlik.',
   'club_trip', 9, time '07:30', 1, time '18:00', 'babadag', 'Ölüdeniz', false, 20),
  ('ornek-yer-calismasi', 'Yer çalışması (ground handling) atölyesi (Ö)',
   E'Kanadı yerde kontrol etmeyi çalışıyoruz: ters kalkış, rüzgârda bekletme. Tüm seviyelere açık.\n\n> Örnek etkinlik.',
   'course', 4, time '10:00', 0, time '13:00', 'sapanca-kirkpinar', 'Sapanca', false, 15),
  ('ornek-yedek-katlama', 'Yedek paraşüt katlama günü (Ö)',
   E'Sertifikalı katlayıcı kulüpte. Yedeğinizi ve harness''ınızı getirin, sıra listesi için kayıt olun.\n\n> Örnek etkinlik.',
   'course', 12, time '11:00', 0, time '17:00', null, 'Kulüp lokali, Kartal / İstanbul', true, 24),
  ('ornek-kulup-yemegi', 'Sezon sonu kulüp yemeği (Ö)',
   E'Sezonu birlikte kapatıyoruz: yemek, sunumlar ve yılın uçuşları.\n\n> Örnek etkinlik.',
   'social', 21, time '19:30', 0, time '23:00', null, 'Kadıköy, İstanbul', false, 60),
  ('ornek-uye-toplantisi', 'Aylık üye toplantısı (Ö)',
   E'Gündem: kış eğitim programı, güvenlik raporu, gezi planları.\n\n> Örnek etkinlik (yalnızca üyeler).',
   'meeting', 7, time '20:00', 0, time '21:30', null, 'Çevrim içi', true, null),
  ('ornek-ali-dagi-xc', 'Ali Dağı XC günleri (Ö)',
   E'Üç gün mesafe uçuşu ve görev planlama. P3 ve üzeri.\n\n> Örnek etkinlik.',
   'competition', 35, time '09:00', 2, time '18:00', 'ali-dagi', 'Kayseri', false, 30)
) as e(slug, title, body, kind, day_offset, start_time, end_days, end_time, site, location, members_only, capacity)
where exists (select 1 from auth.users where id = 'a0000000-0000-4000-8000-000000000001')
on conflict (slug) do nothing;
