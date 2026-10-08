import { istanbulDay } from "@/lib/search-window";
import { getStore } from "@netlify/blobs";
import seedHistory from "@/data/seed-history.json";
import type { Deal } from "@/lib/flight-monitor";
import type { DailyCalendarBaseline, HistoricalCalendarBaseline } from "@/lib/price-baseline";

type StoredBaseline = HistoricalCalendarBaseline & {
  observedAt: string;
  travelMonth?: string;
};

export type MonitorRun = {
  startedAt: string;
  completedAt?: string;
  status: "running" | "completed" | "partial" | "failed";
  dealsFound: number;
  strongDeals: number;
  errorCount: number;
};

const seeds = seedHistory as Deal[];
const STORE_NAME = "rota-radar-history";

function dealKey(adults: number, destination: string) {
  return `deals/${adults}/${destination.toUpperCase()}`;
}

function baselineKey(adults: number, destination: string) {
  return `baselines/${adults}/${destination.toUpperCase()}`;
}

function dealIdentity(deal: Deal) {
  return [deal.destination, deal.adults, deal.departure, deal.returnDate, deal.totalPriceTry].join(":");
}

async function readJSON<T>(key: string): Promise<T | null> {
  try {
    return await getStore(STORE_NAME).get(key, { type: "json", consistency: "strong" }) as T | null;
  } catch {
    return null;
  }
}

async function writeJSON(key: string, value: unknown) {
  try {
    await getStore(STORE_NAME).setJSON(key, value);
  } catch {
    // Local Next.js çalışırken Netlify bağlamı bulunmaz; başlangıç verisi yine kullanılabilir.
  }
}

export async function saveDeals(deals: Deal[]) {
  const groups = new Map<string, Deal[]>();
  for (const deal of deals) {
    const key = dealKey(deal.adults, deal.destination);
    groups.set(key, [...(groups.get(key) ?? []), deal]);
  }
  await Promise.all([...groups.entries()].map(async ([key, additions]) => {
    const existing = await readJSON<Deal[]>(key) ?? [];
    const merged = new Map<string, Deal>();
    for (const deal of [...existing, ...additions]) merged.set(dealIdentity(deal), deal);
    const bounded = [...merged.values()]
      .sort((a, b) => (b.observedAt ?? "").localeCompare(a.observedAt ?? "") || a.perPersonTry - b.perPersonTry)
      .slice(0, 25);
    await writeJSON(key, bounded);
  }));
}

export async function readLatestDeals(adults: number, destinationCodes: string[], requestedDestination = "ALL") {
  const codes = requestedDestination === "ALL"
    ? destinationCodes
    : destinationCodes.filter((code) => code === requestedDestination.toUpperCase());
  const stored = await Promise.all(codes.map((code) => readJSON<Deal[]>(dealKey(adults, code))));
  const candidates = [
    ...seeds.filter((deal) => deal.adults === adults && codes.includes(deal.destination)),
    ...stored.flatMap((deals) => deals ?? []),
  ];
  const latest = new Map<string, Deal>();
  for (const deal of candidates.filter(deal => deal.departure > istanbulDay()).sort((a, b) =>
    (b.observedAt ?? "").localeCompare(a.observedAt ?? "") ||
    a.perPersonTry - b.perPersonTry
  )) {
    if (!latest.has(deal.destination)) latest.set(deal.destination, deal);
  }
  return [...latest.values()].sort((a, b) =>
    (b.observedAt ?? "").localeCompare(a.observedAt ?? "") || a.perPersonTry - b.perPersonTry
  );
}

export async function readHistoricalBaselines(
  destination: string,
  adults: number,
  minNights: number,
  maxNights: number,
  beforeDay: string,
  travelMonth: string,
) {
  const rows = await readJSON<StoredBaseline[]>(baselineKey(adults, destination)) ?? [];
  const cutoff = new Date(Date.now() - 30 * 86_400_000).toISOString();
  return rows.filter((row) =>
    row.travelMonth === travelMonth && row.observedAt >= cutoff && row.observedDay < beforeDay &&
    row.nights >= minNights && row.nights <= maxNights
  ).slice(0, 240);
}

export async function saveBaselines(
  destination: string,
  adults: number,
  rows: DailyCalendarBaseline[],
  observedAt: string,
  travelMonth: string,
) {
  const key = baselineKey(adults, destination);
  const existing = await readJSON<StoredBaseline[]>(key) ?? [];
  const observedDay = observedAt.slice(0, 10);
  const merged = new Map(existing.map((row) => [`${row.travelMonth ?? ""}:${row.nights}:${row.observedDay}`, row]));
  for (const row of rows) merged.set(`${travelMonth}:${row.nights}:${observedDay}`, { ...row, observedDay, observedAt, travelMonth });
  await writeJSON(key, [...merged.values()]
    .sort((a, b) => b.observedAt.localeCompare(a.observedAt))
    .slice(0, 365));
}

export async function saveVerifiedDeal(deal: Deal) {
  await saveDeals([deal]);
}

export async function readLatestMonitor() {
  return readJSON<MonitorRun>("monitor/latest");
}

export async function saveLatestMonitor(run: MonitorRun) {
  await writeJSON("monitor/latest", run);
}
