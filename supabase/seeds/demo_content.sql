-- Local demo content so the news and tips pages are not empty on a fresh `pnpm db:reset`.
-- Marked as examples; delete from the admin area before launch.

insert into public.news (slug, locale, title, summary, body_md, tags, pinned, status, published_at) values
  ('paraapp-e-hos-geldiniz', 'tr', 'ParaApp''e hoş geldiniz',
   'Fly Anatolia''nın yeni topluluk uygulaması yayında. (Örnek içerik)',
   E'Kulüp duyuruları, ipuçları ve ekipman pazarı artık tek yerde.\n\n- **Haberler:** gezi, eğitim ve güvenlik duyuruları\n- **İpuçları:** eğitmenlerimizden pratik bilgiler\n- **Ekipman pazarı:** ikinci el kanat, harness ve yedek paraşüt\n\n> Bu bir örnek haberdir; yayına almadan önce yönetim panelinden silin.',
   array['duyuru'], true, 'published', now() - interval '2 days'),
  ('welcome-to-paraapp', 'en', 'Welcome to ParaApp',
   'Fly Anatolia''s new community app is live. (Example content)',
   E'Club news, tips and the gear market, all in one place.\n\n> This is an example article; delete it from the admin area before launch.',
   array['announcement'], false, 'published', now() - interval '2 days'),
  ('uyeler-icin-sezon-plani', 'tr', 'Üyeler için sezon planı',
   'Yalnızca kulüp üyelerinin görebildiği örnek bir haber.',
   E'Bu haber yalnızca üyelere görünür. (Örnek içerik)',
   array['üyeler'], false, 'published', now() - interval '1 day')
on conflict (slug) do nothing;
update public.news set members_only = true where slug = 'uyeler-icin-sezon-plani';

insert into public.tips (slug, locale, title, summary, body_md, category, difficulty, status, published_at) values
  ('kalkis-oncesi-bes-kontrol', 'tr', 'Kalkış öncesi 5 kontrol',
   'Her kalkıştan önce aynı sırayla yapılan kısa bir kontrol listesi. (Örnek içerik)',
   E'1. **Harness:** bacak ve göğüs kayışları kapalı mı?\n2. **Kask:** çene kayışı bağlı mı?\n3. **Yedek paraşüt:** pim yerinde, kolu erişilebilir mi?\n4. **Hatlar:** düğüm ya da dolaşık hat yok mu?\n5. **Hava ve hava sahası:** rüzgâr yönü ve şiddeti uygun, önünüz boş mu?\n\nBu liste eğitmeninizin verdiği eğitimin yerini tutmaz.',
   'launching', 'beginner', 'published', now() - interval '3 days'),
  ('termikte-ilk-turlar', 'tr', 'Termikte ilk turlar',
   'Termiği bulduktan sonra merkezlemek için temel fikirler. (Örnek içerik)',
   E'Termiğe girdiğinizde varyonun sesine odaklanın. En güçlü kaldırmayı hissettiğiniz tarafa doğru, yumuşak ve sabit bir yatışla dönün. Turunuzu her seferinde biraz kaydırarak çekirdeği arayın.\n\nKalabalık termikte herkes aynı yöne döner: ilk girenin yönüne uyun.',
   'thermalling', 'intermediate', 'published', now() - interval '3 days'),
  ('yedek-parasut-katlama-araligi', 'tr', 'Yedek paraşüt ne sıklıkla katlanmalı?',
   'Üretici talimatı ve sertifikalı katlama hakkında kısa bilgi. (Örnek içerik)',
   E'Çoğu üretici yedek paraşütün **en az yılda bir** (bazıları 6 ayda bir) yeniden katlanmasını önerir. Katlamayı sertifikalı bir katlayıcıya yaptırın ve tarihi kaydedin.\n\nHer zaman kendi yedeğinizin kullanım kılavuzunu esas alın.',
   'reserve_repacking', 'beginner', 'published', now() - interval '3 days'),
  ('reading-a-wind-forecast', 'en', 'Reading a wind forecast for your site',
   'What to look at besides the surface wind. (Example content)',
   E'Check the wind at surface **and** at ridge or cloudbase height, and look at how it changes through the day. A gentle surface breeze with strong wind aloft is a classic trap.\n\nWhen in doubt, don''t fly, and ask the instructors on site.',
   'weather', 'beginner', 'published', now() - interval '3 days')
on conflict (slug) do nothing;
