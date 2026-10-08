import { ticketCheckPath } from "@/lib/booking-policy";
import { readLatestDeals } from "@/lib/flight-history-store";
import { DESTINATIONS } from "@/lib/flight-monitor";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const destination = (url.searchParams.get("destination") || "ALL").toUpperCase();
  const adults = Number(url.searchParams.get("adults") || "3");
  if (![1, 3].includes(adults)) {
    return Response.json({ error: "Yolcu sayısı 1 veya 3 olmalı." }, { status: 400 });
  }
  if (destination !== "ALL" && !DESTINATIONS[destination]) {
    return Response.json({ error: "Destinasyon bulunamadı." }, { status: 404 });
  }

  try {
    const stored = await readLatestDeals(adults, Object.keys(DESTINATIONS), destination);
    const deals = stored.flatMap((deal) => {
      const catalog = DESTINATIONS[deal.destination];
      if (!catalog) return [];
      const historyDeal = {
        ...deal,
        source: "history" as const,
        visaSafe: catalog.visaSafe,
        tripPlan: deal.tripPlan ?? catalog.tripPlan,
        entryNote: catalog.entryNote,
        entrySourceUrl: catalog.entrySourceUrl,
        riskNote: catalog.riskNote,
      };
      return [{ ...historyDeal, bookingPath: ticketCheckPath(historyDeal) }];
    });
    return Response.json({
      deals,
      observations: deals,
      source: "history",
      lastUpdatedAt: deals[0]?.observedAt ?? null,
      note: `${deals.length} rotanın son kaydedilmiş fiyatı gösteriliyor; satın almadan önce canlı doğrulama gerekli.`,
    }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({
      deals: [],
      observations: [],
      source: "history",
      error: "Fiyat geçmişi okunamadı.",
    }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
