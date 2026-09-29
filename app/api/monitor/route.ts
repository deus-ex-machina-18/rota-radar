import { readLatestMonitor, saveLatestMonitor } from "@/lib/flight-history-store";
import { discoverWorldDeals, runScan, todayDestinationCodes, type Deal } from "@/lib/flight-monitor";

export const dynamic = "force-dynamic";

export async function GET() {
  const latest = await readLatestMonitor();
  return Response.json({ latest }, { headers: { "Cache-Control": "no-store" } });
}

async function executeMonitor() {
  const startedAt = new Date().toISOString();
  await saveLatestMonitor({
    startedAt,
    status: "running",
    dealsFound: 0,
    strongDeals: 0,
    errorCount: 0,
  });

  const allDeals: Deal[] = [];
  const allErrors: string[] = [];
  let discoveredDestinations = 0;
  const scheduledCodes = todayDestinationCodes();
  const scans = await Promise.allSettled(
    [1, 3].flatMap((adults) => [
      runScan(scheduledCodes, adults, 1),
      discoverWorldDeals(adults, 1),
    ]),
  );
  for (const scan of scans) {
    if (scan.status === "fulfilled") {
      allDeals.push(...scan.value.deals);
      allErrors.push(...scan.value.errors);
      if ("destinationsFound" in scan.value && typeof scan.value.destinationsFound === "number") {
        discoveredDestinations = Math.max(discoveredDestinations, scan.value.destinationsFound);
      }
    } else {
      allErrors.push(scan.reason instanceof Error ? scan.reason.message : "Toplu tarama hatası");
    }
  }
  const strongDeals = allDeals
    .filter((deal) => (deal.opportunityPct ?? 0) >= 20 && deal.verificationStatus === "verified")
    .sort((a, b) => (b.opportunityPct ?? 0) - (a.opportunityPct ?? 0));
  const deals = [...new Map(allDeals.map((deal) => [
    `${deal.destination}-${deal.adults}-${deal.departure}-${deal.returnDate}-${deal.perPersonTry}`,
    deal,
  ])).values()].sort((a, b) => {
    const opportunityDifference = (b.opportunityPct ?? -1) - (a.opportunityPct ?? -1);
    return opportunityDifference || a.perPersonTry - b.perPersonTry;
  });
  const completedAt = new Date().toISOString();
  const status = allErrors.length ? "partial" as const : "completed" as const;
  await saveLatestMonitor({
    startedAt,
    completedAt,
    status,
    dealsFound: allDeals.length,
    strongDeals: strongDeals.length,
    errorCount: allErrors.length,
  });
  return Response.json({
    status,
    startedAt,
    completedAt,
    dealsFound: allDeals.length,
    watchedDestinations: scheduledCodes.length,
    discoveredDestinations,
    destinationsChecked: scheduledCodes.length + discoveredDestinations,
    deals,
    strongDeals,
    strongDealsFound: strongDeals.length,
    errorCount: allErrors.length,
  }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST() {
  try {
    return await executeMonitor();
  } catch {
    const completedAt = new Date().toISOString();
    await saveLatestMonitor({
      startedAt: completedAt,
      completedAt,
      status: "failed",
      dealsFound: 0,
      strongDeals: 0,
      errorCount: 1,
    });
    return Response.json({
      status: "failed",
      error: "Tarama başlatılamadı. Canlı fiyat bağlantısı kontrol edilmeli.",
    }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
