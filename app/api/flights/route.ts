import { DESTINATIONS, discoverWorldDeals, runScan, todayDestinationCodes } from "@/lib/flight-monitor";
import { isFlightDestination } from "@/lib/destination-catalog";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = (url.searchParams.get("destination") || "ALL").toUpperCase();
  const adults = Number(url.searchParams.get("adults") || "3");
  if (![1, 3].includes(adults)) {
    return Response.json({ error: "Yolcu sayısı 1 veya 3 olmalı." }, { status: 400 });
  }
  if (DESTINATIONS[code] && !isFlightDestination(DESTINATIONS[code])) {
    return Response.json({
      error: "Bu destinasyonda otobüs/tren ulaşım bağlantılarını kullan; canlı uçuş taraması yapılmaz.",
      destination: DESTINATIONS[code],
    }, { status: 422, headers: { "Cache-Control": "no-store" } });
  }
  if (code === "WORLD") {
    try {
      const result = await discoverWorldDeals(adults, 1);
      if (!result.successfulOrigins) return Response.json({ error: result.errors[0] ?? "Fiyat kaynağına ulaşılamadı", details: result.errors, errorCode: "provider_unavailable" }, { status: 503 });
      return Response.json({
        deals: result.deals,
        destinationsChecked: result.destinationsFound,
        details: result.errors,
        note: result.deals.length ? `${result.destinationsFound} farklı dünya rotası bulundu · ${result.deals.filter(deal => deal.verificationStatus === "verified").length} adayın satıcı bağlantısı kontrol edildi.${result.errors.length ? ` ${result.errors.length} kontrol tamamlanamadı: ${result.errors[0]}` : ""}` : "Bu taramada tercihlerine uyan dünya fırsatı bulunamadı.",
      }, { headers: { "Cache-Control": "no-store" } });
    } catch (error) {
      return Response.json({ error: error instanceof Error ? error.message : "Dünya fırsat taraması tamamlanamadı." }, { status: 503 });
    }
  }
  const codes = code === "ALL" ? todayDestinationCodes() : [code];
  if (codes.some((item) => !DESTINATIONS[item])) {
    return Response.json({ error: "Destinasyon desteklenmiyor." }, { status: 400 });
  }
  try {
    const result = await runScan(codes, adults, 1);
    if (!result.successfulDestinations) {
      return Response.json({ error: result.errors[0] ?? "Fiyat kaynağına ulaşılamadı", details: result.errors, errorCode: "provider_unavailable" }, { status: 503 });
    }
    return Response.json({
      deals: result.deals,
      destinationsChecked: codes.length,
      window: result.window,
      details: result.errors,
      note: `${result.window.start}–${result.window.end} gidiş tarihleri örneklendi · ${result.deals.length} canlı sonuç. ${result.errors.length ? `${result.errors.length} kontrol tamamlanamadı: ${result.errors[0]}` : "6–12 ay içindeki diğer tarih pencereleri sonraki günlerde dönüşümlü taranır."}`,
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return Response.json({
      error: error instanceof Error ? error.message : "Canlı tarama tamamlanamadı.",
    }, { status: 503 });
  }
}
