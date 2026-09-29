import { DESTINATIONS, discoverWorldDeals, runScan, todayDestinationCodes } from "@/lib/flight-monitor";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = (url.searchParams.get("destination") || "ALL").toUpperCase();
  const adults = Number(url.searchParams.get("adults") || "3");
  if (![1, 3].includes(adults)) {
    return Response.json({ error: "Yolcu sayısı 1 veya 3 olmalı." }, { status: 400 });
  }
  if (code === "WORLD") {
    try {
      const result = await discoverWorldDeals(adults, 1);
      if (!result.deals.length) return Response.json({ error: "Bu taramada tercihlerine uyan dünya fırsatı bulunamadı.", details: result.errors }, { status: 404 });
      return Response.json({
        deals: result.deals,
        destinationsChecked: result.destinationsFound,
        note: `${result.destinationsFound} farklı dünya fırsatı bulundu; en güçlü aday ayrıntılı doğrulandı.`,
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
    if (!result.deals.length) {
      return Response.json({
        error: "Bu tarih penceresinde uygun uçuş bulunamadı.",
        details: result.errors,
      }, { status: 404 });
    }
    return Response.json({
      deals: result.deals,
      destinationsChecked: codes.length,
      note: result.errors.length
        ? `${result.deals.length} fırsat bulundu; ${result.errors.length} kontrol tamamlanamadı.`
        : `${result.deals.length} canlı fırsat bulundu ve fiyat geçmişine kaydedildi.`,
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return Response.json({
      error: error instanceof Error ? error.message : "Canlı tarama tamamlanamadı.",
    }, { status: 503 });
  }
}
