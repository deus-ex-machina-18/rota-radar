import { CORE_DESTINATION_CODES, DESTINATIONS, todayDestinationCodes } from "@/lib/flight-monitor";

export const dynamic = "force-dynamic";

const GROUP_ORDER = [
  "Türkiye",
  "Balkanlar",
  "Kafkasya",
  "Fas ve Kuzey Afrika",
  "Türk dünyası",
  "Müslüman Asya",
  "Güney ve Güneydoğu Asya",
  "Uzak rotalar",
];

export async function GET() {
  const groups = GROUP_ORDER.map((name) => ({
    name,
    destinations: Object.values(DESTINATIONS)
      .filter((destination) => destination.group === name)
      .map((destination) => ({
        code: destination.code,
        city: destination.city,
        country: destination.country,
        tripPlan: destination.tripPlan,
      })),
  })).filter((group) => group.destinations.length);

  return Response.json({
    groups,
    catalogCount: Object.keys(DESTINATIONS).length,
    todayWatchCount: todayDestinationCodes().length,
    coreCount: CORE_DESTINATION_CODES.length,
    exclusions: ["Mısır", "Mardin", "Diyarbakır"],
  }, { headers: { "Cache-Control": "public, max-age=3600" } });
}
