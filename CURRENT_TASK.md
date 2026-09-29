# Güncel Durum

Uygulama GitHub → Netlify sürekli dağıtımına hazırlanmıştır.

Tamamlananlar:

- Cloudflare Sites/Vinext bağımlılıkları kaldırıldı.
- Standart Next.js komutlarına geçildi.
- D1 fiyat geçmişi Netlify Blobs uyumlu depolamaya taşındı.
- Mevcut canlı sistemdeki 1 ve 3 kişilik kayıtlar başlangıç verisine aktarıldı.
- SearchAPI anahtarı yalnız ortam değişkeninden okunuyor.
- Netlify yapılandırması ve kurulum belgesi eklendi.

Sıradaki işlem:

1. Kaynak kodu GitHub'daki `deus-ex-machina-18/rota-radar` deposuna gönder.
2. Netlify'da depoyu seç.
3. `SEARCHAPI_API_KEY` ortam değişkenini ekle.
4. İlk deploy sonrası ana ekran, `/api/history?destination=ALL&adults=3` ve bilet kontrol akışını doğrula.
