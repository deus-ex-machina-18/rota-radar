# Güncel Durum

Uygulama GitHub → Netlify sürekli dağıtımına hazırlanmış ve GitHub'a yüklenmiştir.

Tamamlananlar:

- Cloudflare Sites/Vinext bağımlılıkları kaldırıldı.
- Standart Next.js komutlarına geçildi.
- D1 fiyat geçmişi Netlify Blobs uyumlu depolamaya taşındı.
- Mevcut canlı sistemdeki 1 ve 3 kişilik kayıtlar başlangıç verisine aktarıldı.
- SearchAPI anahtarı yalnız ortam değişkeninden okunuyor.
- Netlify yapılandırması ve kurulum belgesi eklendi.
- Kaynak kod `deus-ex-machina-18/rota-radar` deposunun `main` dalında yayınlandı.

Sıradaki işlem:

1. Netlify'da `deus-ex-machina-18/rota-radar` deposunu seç.
2. `SEARCHAPI_API_KEY` ortam değişkenini ekle.
3. İlk deploy sonrası ana ekran, `/api/history?destination=ALL&adults=3` ve bilet kontrol akışını doğrula.
