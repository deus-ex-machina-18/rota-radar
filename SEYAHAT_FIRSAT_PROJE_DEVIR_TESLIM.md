# Rota Radar / Seyahat Fırsat — Proje Devir Teslim Belgesi

> **29 Eylül 2026 dağıtım notu:** Uygulama standart Next.js + Netlify yapısına taşındı. Bu belgedeki Sites/Vinext/D1 kurulum komutları yalnız eski mimariyi anlatır; güncel kurulum ve yayın adımları için `README.md`, teknik özet için `PROJECT.md` esas alınmalıdır. Fiyat geçmişi artık Netlify Blobs'ta tutulur.

Güncelleme tarihi: 28 Eylül 2026

## 1. Projenin amacı

Rota Radar; Ankara'dan başlayan tatiller için yalnızca ucuz uçak bileti göstermeyen, yolculuğun tamamını karşılaştıran bir seyahat fırsatı uygulamasıdır.

Ana hedef:

- ESB, IST ve SAW kalkışlarını Ankara'dan erişim maliyetiyle birlikte karşılaştırmak.
- Uçak, tren, otobüs, gece ulaşımı, feribot ve iç hat uçuşlarını tek rota altında birleştirmek.
- Bilet fiyatı yerine gerçek ulaşım maliyetini hesaplamak.
- Vizesiz veya bordo pasaportla görece kolay girişli rotalara öncelik vermek.
- Kullanıcıyı gerçek satın alma/doğrulama sayfasına ulaştırmak.

Canlı uygulama:

https://seyahat-firsat.y-talip.chatgpt.site

## 2. Kullanıcı tercihleri ve değişmeyen kurallar

### Kalkış

- Ankara Esenboğa (ESB)
- İstanbul Havalimanı (IST)
- Sabiha Gökçen (SAW)
- IST/SAW seçeneklerinde Ankara–İstanbul erişim maliyeti ve süresi hesaba katılır.

### Yolcu sayısı

- Öncelikli arama: 3 kişi
- Tek kişilik seyahat de desteklenir.

### Tatil süreleri

- Cuma akşamı–Pazar gecesi
- Hafta sonu + 1–2 gün izin
- Resmî tatillerle birleştirilmiş seyahat
- Uzun tatillerde yaklaşık 4–14 gün

### Bütçe

- Türkiye: kişi başı 10.000–20.000 TL
- Yurt dışı: kişi başı en fazla 50.000 TL
- Ana hedef bütçeyi doldurmak değil, aynı tatili daha düşük gerçek maliyetle yapmaktır.

### Kabul edilen zorluklar

- Gece veya çok erken uçuş
- Koltuk altı/kabin bagajıyla seyahat
- İstanbul'a tren veya otobüsle geçiş
- Uçuşta en fazla bir aktarma
- Altı saate kadar bekleme
- Gece aktarması
- Aynı şehirde havalimanı değişimi, risk puanıyla birlikte
- Gece yarısından sonra varış
- İadesiz/değiştirilemez biletlerin bilgi olarak gösterilmesi

### Pasaport ve vize

- Profil: Türkiye Cumhuriyeti bordo pasaport
- Schengen gerektiren destinasyonlar varsayılan kapsam dışında
- Transit vize riski ayrıca gösterilir.
- Ayrı bilet/self-transfer varsayılan olarak kapalıdır.

### Hava koşulları

- 0°C altındaki sert soğuk tercih edilmez.
- 35°C üzerindeki aşırı sıcak tercih edilmez.
- Çok yüksek nem, kuvvetli rüzgâr, muson ve sürekli yağmur olumsuz kabul edilir.
- Deniz tatilinde denizin rahat yüzülebilir olması gerekir.
- Fiyat çok iyiyse yüksek sezon ve kalabalık kabul edilebilir.

### Konaklama ve şehir içi tercihleri

- Temiz ekonomik özel oda
- Üç yıldızlı otel
- Üç kişi için apart/daire
- Tek kişilik gezide hostel
- Merkezde veya toplu taşımayla merkeze en fazla yaklaşık 30 dakika

### İlgi alanları

- Gece hayatı ve etkinlik
- Yerel kültür ve yemek
- Doğa ve manzara
- Deniz ve sahil
- Tarih ve şehir gezisi
- Helal yemek zorunlu

### Hariç tutulan yerler

- Mısır
- Mardin
- Diyarbakır

## 3. Öncelikli destinasyon grupları

- Fas: Kazablanka, Marakeş, Rabat, Fes, Essaouira, Agadir ve uzun bölgesel rotalar
- Türk dünyası: Azerbaycan, Özbekistan, Kazakistan, Kırgızistan, KKTC ve ilgili rotalar
- Balkanlar: kısa tatilde tek şehir; Mostar, Ohri, Berat veya Prizren gibi ekler varsa 4–5 gün
- Müslüman Asya ve Güney/Güneydoğu Asya
- Deniz tatili sunan Güney/Güneydoğu Asya rotaları
- Japonya: Tokyo–Kyoto–Osaka–Kyushu/open-jaw seçenekleri
- Türkiye: Sivas ve Doğu Anadolu rotaları

Destinasyon kataloğunda 47 rota bulunmaktadır. Uygulama ayrıca sabit katalog dışında Google Flights dünya fırsatlarını keşfedebilir.

## 4. Tamamlanan geliştirmeler

### Canlı uçuş radarı

- SearchAPI Google Flights entegrasyonu
- 1 ve 3 kişi araması
- 6–12 ay ileri tarih mantığına uygun esnek tarih taraması
- ESB/IST/SAW çıkışları
- En fazla bir aktarma ve en fazla altı saat bekleme politikası
- Dünya fırsat keşfi
- Uçuş fiyat geçmişinin D1 veritabanına kaydı
- Takvim medyanı veya fiyat geçmişine göre avantaj yüzdesi
- Satın alma öncesinde fiyatın yeniden doğrulanması
- Havayolu, süre, satıcı ve bagaj bilgisinin mümkün olduğunda alınması

### Yüzde 20 filtresi düzeltmesi

- Yüzde 20 avantaj eşiği artık sonuçları silmez.
- Tüm uçuşlar varsayılan olarak gösterilir.
- Yüzde 20 ve üzerindeki sonuçlar ayrı güçlü fırsat filtresinde gösterilir.
- Fiyat, avantaj ve süre sıralaması bulunur.

### Satın alma akışı

- Uçuş kartından canlı doğrulama başlatılır.
- Fiyat yeniden kontrol edilir.
- Kullanıcı havayolu/güvenilir satıcı veya Google Flights yönlendirmesine ulaşır.
- Çok şehirli uçuşlarda ayrı `/api/multicity-book` akışı kullanılır.

### Ulaşım çekirdeği

Motor şu maliyetleri birlikte hesaplayabilir:

- Uçuş veya kara ulaşımı bileti
- Bagaj
- Rezervasyon ücreti
- Ankara–ESB/IST/SAW erişimi
- Havalimanı ve terminal transferi
- Zorunlu geceleme
- Gece yolculuğuyla kurtarılan otel gecesi

Motorun desteklediği ulaşım türleri:

- Uçak
- İç hat düşük maliyetli uçuş
- Tren
- Hızlı tren
- Gece treni
- Otobüs
- Gece otobüsü
- Feribot
- Gece feribotu
- Otobüs + feribot bileşimi

### Open-jaw ve çok şehirli uçuş

- Google Flights `multi_city` araması kullanılır.
- Örnek: ESB/IST/SAW → Kazablanka, Agadir → aynı başlangıç havalimanı
- Örnek: ESB/IST/SAW → Tokyo/Narita, Fukuoka → aynı başlangıç havalimanı
- Her başlangıç havalimanı ayrı sorgulanır.
- Uçuş fiyatına Ankara erişim maliyeti ve süresi eklenir.
- En ucuz seçenek tek başına seçilmez; maliyet, süre ve risk birlikte puanlanır.

### Rota sırası optimizasyonu

- Seçili şehirlerin olası sıraları üretilir.
- Her bağlantı için uygun ulaşım alternatifleri değerlendirilir.
- Maliyet, süre ve risk cezası kullanılarak en iyi sıra seçilir.
- En fazla yedi ara şehir desteklenir.

### Gece yolculuğu avantajı

- Gece treni, gece otobüsü veya gece feribotu seçeneği işaretlenir.
- Kurtarılan otel gecesi gerçek maliyetten düşülür.
- Örneğin 500 TL daha pahalı ulaşım 1.500 TL otel tasarrufu sağlıyorsa net avantaj korunur.

### Risk motoru

- Ayrı bilet/self-transfer
- Terminal veya havalimanı değişimi
- Asgari bağlantı süresinin altındaki aktarma
- Transit vize riski
- İki veya daha fazla transfer
- Bilinmeyen veya düşük kaliteli veri
- Schengen giriş gereksinimi
- Satılmış sefer

Riskler düşük, orta ve yüksek olarak sınıflandırılır ve rota puanına ceza olarak eklenir.

### Veri güvenilirliği

- A: canlı fiyat + müsaitlik/satın alma yönlendirmesi
- B: canlı sefer ve fiyat; müsaitlik sınırlı
- C: resmî tarife veya yaklaşık/sabit fiyat
- D: araştırma sinyali/örnek veri

Canlı olmayan kara ulaşımı fiyatlarına A etiketi verilmez.

### Hazır karma rota profilleri

- Fas Atlantik: Kazablanka → Marakeş → Essaouira → Agadir
- Japonya + Kyushu: Tokyo → Kyoto → Osaka → Beppu → Fukuoka
- Özbekistan İpek Yolu: Taşkent → Semerkant → Buhara → Hive
- Tayland şehir + sahil: Bangkok → Surat Thani → Phuket
- Desteklenmeyen uzun rotalarda tek şehir/gidiş-dönüş güvenli geri dönüş profili

### Resmî/öncelikli kara ulaşımı kaynakları

- Fas: ONCF, CTM, Supratours
- Japonya: SmartEX/JR, WILLER, MOL Sunflower, Nishitetsu
- Özbekistan: Uzbekistan Railways
- Tayland: SRT D-Ticket, Lomprayah
- Balkanlar ve diğer bölgeler için kaynak kayıtları `data/transport-sources.json` dosyasındadır.

### Arayüz

- Android uyumlu PWA
- Koyu gece/radar tasarımı
- Mobil alt menü
- Telefona kurma desteği
- 47 rotalık katalog
- Tüm sonuçlar / yüzde 20+ filtreleri
- Fiyat, avantaj ve süre sıralaması
- Veri kalitesi rozetleri
- Gerçek uçuş maliyeti penceresi
- “Tüm ulaşımı hesapla” düğmesi
- Karma rota sonuç kartı
- ESB/IST/SAW karşılaştırma tablosu
- Her ulaşım etabı için resmî operatör bağlantısı
- “Bu fiyata git” satın alma/doğrulama düğmesi

## 5. Uygulamanın kullanım akışı

1. Destinasyon veya dünya fırsatı seçilir.
2. Yolcu sayısı 1 veya 3 olarak belirlenir.
3. `Canlı tara` düğmesine basılır.
4. Sonuçlar fiyat, avantaj veya süreye göre sıralanır.
5. Uçuş kartındaki `Tüm ulaşımı hesapla` düğmesine basılır.
6. Sistem ESB, IST ve SAW kalkışlarını canlı çok şehirli uçuş fiyatlarıyla karşılaştırır.
7. Ankara erişimi ve destinasyon içi ulaşım zinciri eklenir.
8. Rota sırası optimize edilir.
9. Gerçek maliyet, toplam süre, tasarruf, risk, vize durumu ve veri kalitesi gösterilir.
10. `Bu fiyata git` düğmesi uçuşu yeniden doğrulayıp kullanıcıyı satıcıya taşır.

## 6. Teknik mimari

### Teknoloji

- Next.js 16 / React 19
- Vinext / Vite
- TypeScript
- Cloudflare Workers uyumlu çalışma zamanı
- Cloudflare D1
- Drizzle ORM
- SearchAPI / Google Flights
- PWA service worker ve manifest
- Sites üzerinde özel yayın

### Temel dosyalar

- `app/page.tsx`: ana kullanıcı arayüzü
- `app/globals.css`: uygulama tasarımı
- `lib/flight-monitor.ts`: uçuş arama, doğrulama ve satın alma aktarımı
- `lib/transport-engine.ts`: maliyet, risk ve şehir sırası motoru
- `lib/itinerary-planner.ts`: uçuş + kara ulaşımı planlayıcısı
- `app/api/flights/route.ts`: canlı uçuş araması
- `app/api/monitor/route.ts`: geniş fırsat taraması
- `app/api/itineraries/route.ts`: karma rota oluşturma
- `app/api/book/route.ts`: klasik uçuş satın alma doğrulaması
- `app/api/multicity-book/route.ts`: open-jaw satın alma doğrulaması
- `data/route-templates.json`: rota şablonları
- `data/transport-sources.json`: ulaşım kaynak kayıtları
- `db/schema.ts`: D1 veri modeli

### Ortam değişkenleri

- `SEARCHAPI_API_KEY`: SearchAPI anahtarı
- `DB`: Sites/D1 mantıksal veritabanı bağlantısı

Anahtar ZIP içinde bulunmaz. Yerel çalıştırmada `.dev.vars` veya platformun güvenli ortam değişkeni sistemi kullanılmalıdır.

## 7. Yerel kurulum

Gereksinim: Node.js 22.13 veya üzeri.

```bash
pnpm install
pnpm dev
```

Canlı uçuş araması için proje kökünde `.dev.vars` oluşturulabilir:

```text
SEARCHAPI_API_KEY=BURAYA_KENDI_ANAHTARIN
```

Bu dosya paylaşılmamalı ve Git'e eklenmemelidir.

D1 kullanan yerel önizlemede önce üretim çıktısı ve yerel migration hazırlanmalıdır:

```bash
pnpm build
pnpm db:generate
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_example.sql
```

`0000_example.sql` yerine oluşan bekleyen migration dosyası yazılmalıdır. Aynı migration ikinci kez uygulanmamalıdır.

Kontroller:

```bash
pnpm lint
pnpm build
```

## 8. Doğrulanan durum

- ESLint: başarılı
- Üretim derlemesi: başarılı
- Ulaşım maliyeti/gece oteli tasarrufu saf motor testi: başarılı
- Hata 1–3 çekirdek regresyon kontrolleri: başarılı
- Masaüstü tarayıcı ana ekran kontrolü: başarılı
- Uçuş maliyeti penceresi kontrolü: başarılı
- Yeni API uçları üretim paketine dahil
- Sites üretim yayını: başarılı

## 9. Bilinen sınırlar

1. Uçuşlar canlıdır; kara ulaşımının çoğu henüz resmî tarife/yaklaşık C kalite düzeyindedir.
2. ONCF, CTM, JR, WILLER vb. için ticari/partner API bağlantıları henüz yoktur. Kullanıcı resmî satış sayfasına yönlendirilir.
3. Kayıtlı bagaj varsayılan aramada seçili değildir. Satıcı ekranındaki bagaj ücreti ödeme öncesinde ayrıca kontrol edilmelidir.
4. Vize ve transit kuralları değişebilir. Uygulama risk sinyali verir; resmî makam doğrulamasının yerine geçmez.
5. Hava durumu, konaklama ve etkinlikler bilinçli olarak ikinci katmana bırakılmıştır.
6. Bildirim ekranı bulunmasına rağmen tam zamanlanmış Android fiyat alarmı bu sürümün çekirdeğine dahil değildir.

## 10. Bilinçli olarak ertelenen özellikler

- Restoran önerileri
- Ayrıntılı gece hayatı rehberi
- Yüzlerce etkinliğin taranması
- Sosyal özellikler ve arkadaş oylaması
- Ayrıntılı otel karşılaştırması
- Puan, rozet ve oyunlaştırma

Ulaşım çekirdeği gerçek kullanımla doğrulanmadan bu modüller eklenmemelidir.

## 11. Sonraki tek önerilen görev

Canlı uygulamada üç gerçek senaryo uçtan uca test edilmelidir:

1. Fas open-jaw — ESB/IST/SAW → CMN, AGA → başlangıç havalimanı
2. Japonya open-jaw — ESB/IST/SAW → NRT, FUK → başlangıç havalimanı
3. Kısa Balkan gidiş-dönüşü

Her testte şu veriler kaydedilmelidir:

- Sağlayıcıda görülen uçuş toplamı
- Uygulamanın gösterdiği uçuş toplamı
- Satıcıya geçişin çalışıp çalışmadığı
- ESB/IST/SAW seçim sonucu
- Kara ulaşımı tahmini ile gerçek operatör fiyatı arasındaki fark

Bu üç senaryo tamamlanmadan yeni özellik eklenmemelidir.

## 12. 28 Eylül 2026 arayüz ve hata raporu turu

Tamamlananlar:

- Ana ekran referans tasarımdaki koyu radar/gold görsel dile geçirildi.
- Tokyo ve Saraybosna kartlarına ek olarak Fas, Orta Asya, Güneydoğu Asya, Doğu Anadolu ve Körfez/ada rotaları için kalıcı yerel görsel havuzu eklendi.
- Bilinen ve dünya keşfinden gelebilecek rotalarda radar haritasına düşen görselsiz kart bırakılmadı; ülke bazlı yedek eşleme eklendi.
- Alt panel gerçek sekme davranışına bağlandı: Keşfet, Fırsatlar, Takip ve Profil.
- Fırsat kartlarına kalp düğmesi eklendi. Takip listesi cihazda saklanıyor ve her rota ayrı canlı taranabiliyor.
- Profil panelinde kalkış, yolcu, vize, bütçe, bagaj ve aktarma tercihleri görünür hale getirildi.
- Site sahibi erişimi özel/owner-only olduğu için rapordaki API kotası riski dış erişime açık yayın için geçerli değil; paylaşım modu değişirse kimlik kontrolü eklenmelidir.

`Rota_Radar_Hata_Raporu.md` içindeki Hata 1–3 bu turda kapatıldı:

- Karşılaştırma bazı artık seçilen rotayla aynı maliyet motorundan geçiyor; giriş/çıkış transferleri, kapalı dönüş, bagaj ve erişim kalemleri eksiksiz hesaba katılıyor.
- Takvim sonucu gerçek kalkış havalimanını vermiyorsa ESB/IST/SAW içindeki en düşük erişim maliyeti kullanılıyor ve bu durum baz etiketinde açıkça yazıyor.
- RAK, FEZ, RBA, AGA, KIX, SKD ve HKT gibi profil girişinden farklı fırsatlar yanlış çok-şehirli profile zorlanmak yerine tek şehir rotasına düşüyor.
- Uçuş seçici en ucuz self-transfer/ayrı bilet seçeneğini atlayıp sıradaki uygun normal bileti seçiyor. SearchAPI'nin `separate_tickets=1` değerinin ayrı biletleri gizlediği resmî dokümandan doğrulandı; sonuç filtresi savunma katmanı olarak ayrıca korunuyor.
- Veri kalitesi riskten ayrıldı. C kalite resmî/yaklaşık tarife artık tek başına orta risk üretmiyor; sıfır dakikalık bağlantı kontrolleri de falsy değer nedeniyle atlanmıyor.

Hata 4–5 de aynı gün yapılan ikinci çekirdek turunda kapatıldı:

- Fırsat bazı artık `flight_observations` içindeki en ucuz iki biletten üretilmiyor.
- Her taramadaki geçerli takvim fiyatları gece sayısına göre gruplanıyor; günlük medyan, örnek sayısıyla birlikte ayrı `flight_baselines` tablosuna kaydediliyor.
- Geçmiş baz yalnızca son 30 gündeki benzer süreli seyahatlerden (±1 gece) kuruluyor. Aynı gün tekrarlanan tarama yeni geçmiş gözlemi gibi sayılmıyor.
- En az üç farklı gün oluşana kadar güncel takvim medyanı kullanılıyor; sonrasında etiket açıkça “30 günlük takvim medyanı” oluyor.
- Arayüz ve rota motorundaki ayrı rota listeleri kaldırıldı. Fas, Japonya, Özbekistan ve Tayland için şehirler, giriş/çıkış havalimanları, süreler, ulaşım kenarları ve satın alma kaynakları artık tek `data/route-templates.json` dosyasından okunuyor.
- Fas arayüzü ile motoru aynı Kazablanka → Marakeş → Essaouira → Agadir rotasını; Japonya arayüzü ile motoru aynı Tokyo → Kyoto → Osaka → Beppu → Fukuoka rotasını gösteriyor.

Bu turun doğrulamaları: çekirdek regresyon betiği, TypeScript, ESLint, üretim derlemesi ve temiz yerel D1 migration uygulaması.

## 13. 28 Eylül 2026 güvenlik ve dayanıklılık turu

`Rota_Radar_Hata_Raporu.md` içindeki düşük öncelikli Hata 6–12 maddeleri kapatıldı veya mevcut yayın durumuyla doğrulandı:

- Tek şehir ve open-jaw satın alma akışları aynı Google alan adı beyaz listesini kullanıyor. HTTPS olsa bile izin verilmeyen veya Google'a benzeyen başka alan adlarına POST yapılmıyor.
- Open-jaw bağlantısı ilk görülen toplam fiyatı taşıyor. Yeniden doğrulamada toplam fiyat %10'dan fazla değişmişse eski ve yeni fiyat birlikte gösteriliyor; otomatik yönlendirme yerine kullanıcı onayı isteniyor.
- `/api/history` ile `/api/monitor` veritabanı tablosu veya şeması eksik olduğunda boş gövdeli 500 yerine açıklamalı JSON ve 503 dönüyor.
- Yerel D1 migration adımları bu belgede ve README'de bulunuyor.
- Canlı yayın owner-only/özel erişimde kalıyor. Paylaşım modu değiştirilirse tarama uçlarına kullanıcı doğrulaması eklenmesi gerekiyor.
- Sıfır dakikalık bağlantı riski `!= null` kontrolüyle yüksek risk olarak yakalanıyor.
- Fas/Kazablanka için “yalnız direkt”, diğer rotalar için “en fazla bir aktarma” kuralı tek modülde tanımlandı; takvim, ayrıntılı doğrulama ve open-jaw araması aynı politikayı kullanıyor.

Bu turun doğrulamaları: çekirdek regresyon kontrolleri, TypeScript, ESLint ve üretim derlemesi.
