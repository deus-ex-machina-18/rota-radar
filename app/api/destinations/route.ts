import { CORE_DESTINATION_CODES, DESTINATIONS, GROUP_ORDER, isFlightDestination, todayDestinationCodes } from "@/lib/destination-catalog";

export const dynamic = "force-dynamic";

export async function GET() {
  const groups = GROUP_ORDER.map((name) => ({
    name,
    destinations: Object.values(DESTINATIONS)
      .filter((destination) => destination.group === name)
      .map((destination) => ({ ...destination })),
  })).filter((group) => group.destinations.length);

  return Response.json({
    groups,
    catalogCount: Object.keys(DESTINATIONS).length,
    flightCount: Object.values(DESTINATIONS).filter(isFlightDestination).length,
    groundCount: Object.values(DESTINATIONS).filter((item) => item.transportMode === "ground").length,
    todayWatchCount: todayDestinationCodes().length,
    coreCount: CORE_DESTINATION_CODES.length,
    exclusions: ["Mısır", "Mardin", "Diyarbakır"],
  }, { headers: { "Cache-Control": "public, max-age=3600" } });
}
