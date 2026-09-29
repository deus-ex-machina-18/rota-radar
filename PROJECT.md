# Rota Radar — Güncel Proje Özeti

## Amaç

Kullanıcının Ankara veya İstanbul çıkışlı tatilleri için yalnız en ucuz uçuşu değil, toplam maliyet ve yolculuk zorluğu açısından en avantajlı ulaşım planını bulmak.

## Sabit tercihler

- Kalkış: ESB, IST, SAW
- Yolcu: 3 kişi öncelikli, tek kişi de desteklenir
- Süre: hafta sonu 2–3 gün; izinle 4–7 gün; uzak rotalarda 8–14 gün
- Bütçe: Türkiye 10–20 bin TL, yurt dışı kişi başı en fazla 50 bin TL
- Bagaj: ek maliyet olarak gösterilir
- Aktarma: en fazla bir; altı saate kadar veya gece aktarması kabul edilebilir
- Vize: bordo pasaport için Schengen gerektiren rotalar varsayılan dışarıda
- Yemek: helal yemek zorunlu
- Güvenlik: orta risk uyarıyla gösterilir
- Hariç: Mardin, Diyarbakır ve Mısır

## Ürün çekirdeği

1. Uçak dışı ulaşım seçenekleri
2. Bilet, bagaj, kalkış erişimi, terminal transferi ve geceleme dahil gerçek maliyet
3. Karma ve open-jaw rota desteği
4. Alternatif kalkış karşılaştırması
5. Rota sırası optimizasyonu
6. Gece yolculuğuyla otel tasarrufu
7. Vize ve transit riski
8. Self-transfer, terminal değişikliği ve aktarma riski
9. Canlı / kayıtlı / tahmini veri ayrımı
10. Satın alma yönlendirmesi
11. Tasarruf-zaman karşılaştırması

## Teknik yapı

- Next.js 16 App Router, React 19 ve TypeScript
- Netlify otomatik Next.js adaptörü
- SearchAPI üzerinden Google Flights aramaları
- Netlify Blobs üzerinde fiyat geçmişi ve son tarama kaydı
- PWA manifesti, service worker ve Android kurulum desteği
- `data/seed-history.json` ile ilk açılışta 8 adet 3 kişilik kayıt

## Destinasyon yaklaşımı

Katalog; Türkiye/Doğu Anadolu, Balkanlar, Kafkasya, Fas, Türk dünyası, Müslüman Asya, Güney-Güneydoğu Asya ve Japonya odaklıdır. Mevsim filtreleri 0°C altı sert soğuğu, 35°C üzeri sıcağı, aşırı nemi, kuvvetli rüzgârı ve muson/sürekli yağmuru eler veya uyarır. Deniz tatilinde rahat yüzülebilir su sıcaklığı aranır.

## Bilinçli olarak ertelenenler

Restoran rehberi, ayrıntılı gece hayatı verisi, geniş etkinlik kataloğu, sosyal oylama, ayrıntılı otel karşılaştırması ve oyunlaştırma; ulaşım çekirdeği gerçek kullanımla doğrulanana kadar ertelenmiştir.
