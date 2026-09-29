import { searchOpenJawOptions, type Deal, type OpenJawFlightOption } from "@/lib/flight-monitor";
import { matchesProfileEntry } from "@/lib/route-profile-policy";
import routeProfileData from "@/data/route-templates.json";
import {
  DEFAULT_POLICY,
  compareToBaseline,
  itineraryCost,
  optimizeCityOrder,
  type DataQuality,
  type RiskLevel,
  type TransportLeg,
} from "@/lib/transport-engine";

type RouteEdge = TransportLeg & { from: string; to: string };

type RouteProfile = {
  id: string;
  label: string;
  codes: string[];
  entry: string;
  exit: string;
  startCity: string;
  endCity: string;
  cities: string[];
  visaStatus: "ok" | "review";
  entryTransfer?: RouteEdge;
  exitTransfer?: RouteEdge;
  edges: RouteEdge[];
  closedJawReturn?: RouteEdge;
};

export type PlannedItinerary = {
  id: string;
  title: string;
  days: number;
  openJaw: boolean;
  sequence: string[];
  origin: "ESB" | "IST" | "SAW";
  entry: string;
  exit: string;
  legs: TransportLeg[];
  trueCostTry: number;
  fareTry: number;
  extrasTry: number;
  hotelSavingsTry: number;
  totalDurationMinutes: number;
  nightServices: number;
  dataQuality: DataQuality;
  risk: RiskLevel;
  visaStatus: "ok" | "review";
  transitVisaRisk: boolean;
  selfTransfer: boolean;
  savingsTry: number;
  extraMinutes: number;
  savingsPerExtraHourTry: number | null;
  baselineCostTry: number;
  baselineLabel: string;
  bookingPath: string;
  originComparisons: Array<{
    origin: "ESB" | "IST" | "SAW";
    flightTry: number;
    accessTry: number;
    trueCostTry: number;
    durationMinutes: number;
    risk: RiskLevel;
    selected: boolean;
  }>;
  warnings: string[];
  generatedAt: string;
};

const PROFILES = routeProfileData.templates as unknown as RouteProfile[];

function accessLegs(origin: "ESB" | "IST" | "SAW") {
  const rows = {
    ESB: { fare: 250, duration: 55, mode: "bus", source: "BelkoAir / EGO", url: "https://www.ego.gov.tr/" },
    IST: { fare: 1_350, duration: 420, mode: "high_speed_train", source: "TCDD + Havaist", url: "https://bilet.tcdd.gov.tr/" },
    SAW: { fare: 1_050, duration: 440, mode: "bus", source: "Şehirler arası otobüs + servis", url: "https://www.obilet.com/" },
  } as const;
  const row = rows[origin];
  return [
    { label: `Ankara → ${origin}`, from: "Ankara", to: origin, mode: row.mode, fareTry: row.fare, durationMinutes: row.duration, dataQuality: "C" as const, sourceName: row.source, priceLabel: "Yaklaşık", bookingUrl: row.url },
    { label: `${origin} → Ankara`, from: origin, to: "Ankara", mode: row.mode, fareTry: row.fare, durationMinutes: row.duration, dataQuality: "C" as const, sourceName: row.source, priceLabel: "Yaklaşık", bookingUrl: row.url },
  ];
}

function genericProfile(deal: Deal): RouteProfile {
  return {
    id: `single_${deal.destination.toLowerCase()}`,
    label: `${deal.city} tek şehir rotası`,
    codes: [deal.destination],
    entry: deal.destination === "TYO" ? "NRT" : deal.destination,
    exit: deal.destination === "TYO" ? "NRT" : deal.destination,
    startCity: deal.city,
    endCity: deal.city,
    cities: [],
    visaStatus: deal.visaSafe ? "ok" : "review",
    edges: [],
  };
}

function profileFor(deal: Deal) {
  const profile = PROFILES.find((candidate) => candidate.codes.includes(deal.destination));
  if (!profile) return genericProfile(deal);
  return matchesProfileEntry(deal.destination, profile.entry) ? profile : genericProfile(deal);
}

function chooseRoute(profile: RouteProfile) {
  if (profile.startCity === profile.endCity && !profile.cities.length) {
    return { sequence: [profile.startCity], legs: [] as RouteEdge[], evaluation: itineraryCost([]) };
  }
  return optimizeCityOrder(profile.startCity, profile.endCity, profile.cities, profile.edges) ?? {
    sequence: [profile.startCity, ...profile.cities, profile.endCity],
    legs: profile.edges,
    evaluation: itineraryCost(profile.edges),
  };
}

function optionItinerary(profile: RouteProfile, flight: OpenJawFlightOption) {
  const access = accessLegs(flight.origin);
  const route = chooseRoute(profile);
  if (!route.evaluation.eligible) return null;
  const flightLeg: TransportLeg = {
    label: `${flight.origin} → ${profile.entry} / ${profile.exit} → ${flight.origin}`,
    from: flight.origin,
    to: `${profile.entry} · ${profile.exit}`,
    mode: "flight",
    fareTry: flight.perPersonTry,
    durationMinutes: flight.durationMinutes,
    stops: flight.stops,
    selfTransfer: flight.selfTransfer,
    terminalChange: flight.terminalChange,
    connectionMinutes: flight.connectionMinutes,
    minimumConnectionMinutes: 90,
    transitVisaRisk: flight.transitVisaRisk,
    visaStatus: profile.visaStatus,
    dataQuality: "A",
    sourceName: flight.airline || "Google Flights",
    priceLabel: "Canlı fiyat",
    bookingUrl: flight.bookingPath,
  };
  const legs: TransportLeg[] = [access[0], flightLeg];
  if (profile.entryTransfer) legs.push(profile.entryTransfer);
  legs.push(...route.legs);
  if (profile.exitTransfer) legs.push(profile.exitTransfer);
  legs.push(access[1]);
  const evaluation = itineraryCost(legs, DEFAULT_POLICY);
  return evaluation.eligible ? { flight, route, legs, evaluation } : null;
}

function knownOrigin(value: string): "ESB" | "IST" | "SAW" | null {
  return (["ESB", "IST", "SAW"] as const).includes(value as "ESB" | "IST" | "SAW")
    ? value as "ESB" | "IST" | "SAW"
    : null;
}

function reverseLeg(leg: RouteEdge): RouteEdge {
  return {
    ...leg,
    from: leg.to,
    to: leg.from,
    label: `${leg.to} → ${leg.from}`,
  };
}

function baselineFor(
  deal: Deal,
  profile: RouteProfile,
  selected: NonNullable<ReturnType<typeof optionItinerary>>,
) {
  const suppliedOrigin = knownOrigin(deal.origin);
  const baselineOrigin = suppliedOrigin ?? (["ESB", "IST", "SAW"] as const)
    .map((origin) => ({
      origin,
      cost: itineraryCost(accessLegs(origin)).trueCostTry,
    }))
    .sort((a, b) => a.cost - b.cost)[0].origin;
  const access = accessLegs(baselineOrigin);
  const route = chooseRoute(profile);
  if (!route.evaluation.eligible) throw new Error("Klasik rota karşılaştırması oluşturulamadı");
  const flightDuration = deal.outboundDurationMinutes != null && deal.returnDurationMinutes != null
    ? deal.outboundDurationMinutes + deal.returnDurationMinutes
    : selected.flight.durationMinutes;
  const flightLeg: TransportLeg = {
    label: `${baselineOrigin} → ${profile.entry} → ${baselineOrigin}`,
    from: baselineOrigin,
    to: profile.entry,
    mode: "flight",
    fareTry: deal.perPersonTry,
    durationMinutes: flightDuration,
    stops: deal.stopPolicy.toLocaleLowerCase("tr-TR").includes("direkt") ? 0 : 1,
    selfTransfer: false,
    visaStatus: profile.visaStatus,
    dataQuality: "A",
    sourceName: "Google Flights takvim fiyatı",
    priceLabel: "Canlı takvim fiyatı",
    bookingUrl: deal.bookingPath ?? "https://www.google.com/travel/flights",
  };
  const legs: TransportLeg[] = [access[0], flightLeg];
  if (profile.entryTransfer) legs.push(profile.entryTransfer);
  legs.push(...route.legs);
  if (profile.closedJawReturn) legs.push(profile.closedJawReturn);
  if (profile.entryTransfer && profile.closedJawReturn) legs.push(reverseLeg(profile.entryTransfer));
  legs.push(access[1]);
  const evaluation = itineraryCost(legs, DEFAULT_POLICY);
  if (!evaluation.eligible) throw new Error("Klasik rota karşılaştırması politika filtresini geçemedi");
  const originLabel = suppliedOrigin
    ? `${baselineOrigin} kalkışlı`
    : `ESB/IST/SAW takvim fiyatı + en düşük erişim (${baselineOrigin})`;
  return {
    evaluation,
    label: `${originLabel}, ${profile.startCity} başlangıç/bitişli klasik gidiş-dönüş`,
  };
}

export async function buildOptimizedItinerary(deal: Deal): Promise<PlannedItinerary> {
  const profile = profileFor(deal);
  const live = await searchOpenJawOptions({
    entry: profile.entry,
    exit: profile.exit,
    departure: deal.departure,
    returnDate: deal.returnDate,
    adults: deal.adults,
  });
  const candidates = live.options.flatMap((flight) => {
    const candidate = optionItinerary(profile, flight);
    return candidate ? [candidate] : [];
  }).sort((a, b) => a.evaluation.score - b.evaluation.score);
  const selected = candidates[0];
  if (!selected) throw new Error(live.errors[0] ?? "Uygun ESB/IST/SAW ulaşım zinciri bulunamadı");

  const baseline = baselineFor(deal, profile, selected);
  const baselineCostTry = baseline.evaluation.trueCostTry;
  const comparison = compareToBaseline(selected.evaluation, baseline.evaluation);
  const warnings = [
    ...live.errors.slice(0, 2),
    ...(selected.flight.transitVisaRisk ? ["Aktarma havalimanı için transit vize kuralı ayrıca doğrulanmalı."] : []),
    ...(selected.evaluation.dataQuality === "C" ? ["Kara ulaşımı fiyatları resmî tarife/ortalama düzeyinde; ödeme anında doğrulanmalı."] : []),
  ];

  return {
    id: `${profile.id}_${deal.departure}_${deal.adults}`,
    title: profile.label,
    days: deal.nights + 1,
    openJaw: profile.entry !== profile.exit,
    sequence: selected.route.sequence,
    origin: selected.flight.origin,
    entry: profile.entry,
    exit: profile.exit,
    legs: selected.legs,
    trueCostTry: selected.evaluation.trueCostTry,
    fareTry: selected.evaluation.fareTry,
    extrasTry: selected.evaluation.extrasTry,
    hotelSavingsTry: selected.evaluation.hotelSavingsTry,
    totalDurationMinutes: selected.evaluation.totalDurationMinutes,
    nightServices: selected.evaluation.nightServices,
    dataQuality: selected.evaluation.dataQuality,
    risk: selected.evaluation.risk,
    visaStatus: profile.visaStatus,
    transitVisaRisk: selected.flight.transitVisaRisk,
    selfTransfer: selected.flight.selfTransfer,
    savingsTry: comparison.savingsTry,
    extraMinutes: comparison.extraMinutes,
    savingsPerExtraHourTry: comparison.savingsPerExtraHourTry,
    baselineCostTry,
    baselineLabel: baseline.label,
    bookingPath: selected.flight.bookingPath,
    originComparisons: candidates.map((candidate) => ({
      origin: candidate.flight.origin,
      flightTry: candidate.flight.perPersonTry,
      accessTry: accessLegs(candidate.flight.origin).reduce((sum, leg) => sum + Number(leg.fareTry ?? 0), 0),
      trueCostTry: candidate.evaluation.trueCostTry,
      durationMinutes: candidate.evaluation.totalDurationMinutes,
      risk: candidate.evaluation.risk,
      selected: candidate.flight.origin === selected.flight.origin,
    })),
    warnings,
    generatedAt: new Date().toISOString(),
  };
}
