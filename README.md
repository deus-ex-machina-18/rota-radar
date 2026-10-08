# Rota Radar

Ankara, İstanbul ve Sabiha Gökçen çıkışlı uçuşları karşılaştıran; vize, mevsim, aktarma, gerçek ulaşım maliyeti ve rota tercihlerini birlikte değerlendiren mobil öncelikli seyahat fırsatı uygulaması.

## Özellikler

- 83 destinasyonluk kişisel rota kataloğu
- 1 veya 3 yolcu için canlı uçuş taraması
- ESB / IST / SAW alternatif kalkış karşılaştırması
- Fırsat yüzdesi, fiyat geçmişi ve canlı doğrulama durumu
- Satın alma kontrolü ve güvenli satıcı yönlendirmesi
- Open-jaw ve çok şehirli rota planlama
- Uçak, tren, otobüs ve feribot dahil gerçek ulaşım maliyeti
- Android ana ekrana kurulabilen PWA
- Netlify Blobs üzerinde kalıcı fiyat geçmişi
- İlk yayında boş görünmemesi için mevcut 1 ve 3 kişilik başlangıç kayıtları

## Yerel çalıştırma

Gereksinim: Node.js 22 ve pnpm 11.

```bash
pnpm install
cp .env.example .env.local
pnpm dev
```

`.env.local` içindeki `SEARCHAPI_API_KEY` değerini doldurun. Bu dosya Git'e eklenmez.

Kontroller:

```bash
pnpm test:core
pnpm test:radar
pnpm lint
pnpm build
```

## Netlify ile yayınlama

1. Netlify'da **Add new project → Import an existing project** seçin.
2. GitHub'dan bu depoyu seçin.
3. Yapılandırmayı değiştirmeyin; `netlify.toml` derleme komutunu ve çıktı klasörünü tanımlar.
4. **Site configuration → Environment variables** altında `SEARCHAPI_API_KEY` ekleyin.
5. Yeniden deploy edin.

Netlify, Next.js App Router ve API route'larını otomatik olarak sunar. Fiyat geçmişi Netlify Blobs'ta tutulur; ilk taramadan önce `data/seed-history.json` kullanılır.

## Güvenlik

- SearchAPI anahtarı kaynak kodda bulunmaz.
- Gerçek `.env` dosyaları Git tarafından yok sayılır.
- Bilet fiyatları satın almadan önce satıcı ekranında tekrar doğrulanmalıdır.
- Vize ve transit bilgileri karar desteğidir; resmî makam kontrolünün yerine geçmez.

## Proje belgeleri

- `PROJECT.md`: ürün kapsamı ve teknik yapı
- `CURRENT_TASK.md`: dağıtım durumu ve sıradaki işlem
- `SEYAHAT_FIRSAT_PROJE_DEVIR_TESLIM.md`: ayrıntılı ürün geçmişi ve kararlar

## 8 Ekim 2026 güncellemesi

Edirne dahil sekiz kara ulaşımı rotası ve Rusya dahil 28 uçuş hedefi eklendi.
Radar, 6–12 ay içindeki yedi günlük gidiş pencerelerini dönüşümlü örnekler; tek
tarama bütün tarihleri kapsamaz. Eski kayıtlar canlı sonuç olarak gösterilmez.
Bilet kontrolü yolcu sayısını ve kalkış havalimanını korur, fiyat değişince kullanıcı
onayı bekler. Otomatik zamanlanmış taramalar ve Android bildirimleri henüz yoktur.

Netlify sürümünde karşılaştırmalar seyahat ayına göre ayrılarak Blobs üzerinde
saklanır; Cloudflare D1 migration dosyaları bu dağıtımda kullanılmaz.
Kontrollü sağlayıcı yanıtlarıyla test edilmiştir; gerçek sağlayıcı fiyatı ve satıcı
checkout akışı bu testlerin kapsamı dışındadır.
