import { buildOptimizedItinerary } from "@/lib/itinerary-planner";
import type { Deal } from "@/lib/flight-monitor";

export const dynamic = "force-dynamic";

const isoDate = /^\d{4}-\d{2}-\d{2}$/;

function validDeal(value: unknown): value is Deal {
  if (!value || typeof value !== "object") return false;
  const deal = value as Record<string, unknown>;
  return typeof deal.destination === "string" && /^[A-Z]{3}$/.test(deal.destination) &&
    typeof deal.city === "string" && typeof deal.country === "string" &&
    [1, 3].includes(Number(deal.adults)) &&
    typeof deal.departure === "string" && isoDate.test(deal.departure) &&
    typeof deal.returnDate === "string" && isoDate.test(deal.returnDate) &&
    Number.isFinite(Number(deal.totalPriceTry)) && Number(deal.totalPriceTry) > 0 &&
    Number.isFinite(Number(deal.perPersonTry)) && Number(deal.perPersonTry) > 0;
}

export async function POST(request: Request) {
  try {
    const payload = await request.json() as { deal?: unknown };
    if (!validDeal(payload.deal)) {
      return Response.json({ error: "Rota için geçerli bir uçuş seçmelisin." }, { status: 400 });
    }
    const itinerary = await buildOptimizedItinerary(payload.deal);
    return Response.json({ itinerary }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return Response.json({
      error: error instanceof Error ? error.message : "Ulaşım zinciri oluşturulamadı.",
    }, { status: 503 });
  }
}
