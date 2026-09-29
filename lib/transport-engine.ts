export type DataQuality = "A" | "B" | "C" | "D";
export type RiskLevel = "low" | "medium" | "high";

export type TransportLeg = {
  id?: string;
  label?: string;
  from?: string;
  to?: string;
  mode: string;
  fareTry?: number;
  baggageTry?: number;
  bookingFeeTry?: number;
  originAccessTry?: number;
  destinationAccessTry?: number;
  requiredAccommodationTry?: number;
  hotelNightSavedTry?: number;
  nightService?: boolean;
  durationMinutes?: number;
  stops?: number;
  transfers?: number;
  selfTransfer?: boolean;
  terminalChange?: boolean;
  connectionMinutes?: number;
  minimumConnectionMinutes?: number;
  requiresSchengenEntry?: boolean;
  transitVisaRisk?: boolean;
  visaStatus?: "ok" | "review" | "unknown" | "blocked";
  availability?: "available" | "unknown" | "sold_out";
  dataQuality?: DataQuality;
  sourceName?: string;
  priceLabel?: string;
  bookingUrl?: string;
};

export type TransportPolicy = {
  currency: "TRY";
  allowSelfTransfer: boolean;
  schengenAvailable: boolean;
  maxFlightStops: number;
  savingsPerExtraHourFloorTry: number;
  riskPenaltyTry: Record<RiskLevel, number>;
};

export const DEFAULT_POLICY: TransportPolicy = Object.freeze({
  currency: "TRY",
  allowSelfTransfer: false,
  schengenAvailable: false,
  maxFlightStops: 1,
  savingsPerExtraHourFloorTry: 125,
  riskPenaltyTry: { low: 0, medium: 750, high: 2500 },
});

const numberValue = (value: unknown) => Number.isFinite(Number(value)) ? Number(value) : 0;

export function trueLegCost(leg: TransportLeg) {
  const hotelSaving = leg.nightService ? Math.max(0, numberValue(leg.hotelNightSavedTry)) : 0;
  return numberValue(leg.fareTry) +
    numberValue(leg.baggageTry) +
    numberValue(leg.bookingFeeTry) +
    numberValue(leg.originAccessTry) +
    numberValue(leg.destinationAccessTry) +
    numberValue(leg.requiredAccommodationTry) -
    hotelSaving;
}

export function legRejectReasons(leg: TransportLeg, policy = DEFAULT_POLICY) {
  const reasons: string[] = [];
  if (leg.requiresSchengenEntry && !policy.schengenAvailable) reasons.push("schengen_required");
  if (leg.selfTransfer && !policy.allowSelfTransfer) reasons.push("self_transfer_not_allowed");
  if (leg.mode === "flight" && numberValue(leg.stops) > policy.maxFlightStops) reasons.push("too_many_stops");
  if (leg.visaStatus === "blocked") reasons.push("visa_blocked");
  if (leg.availability === "sold_out") reasons.push("sold_out");
  if (!leg.bookingUrl && leg.dataQuality === "A") reasons.push("missing_booking_url");
  return reasons;
}

export function riskLevel(leg: TransportLeg): RiskLevel {
  if (leg.selfTransfer) return "high";
  if (leg.transitVisaRisk) return "high";
  if (leg.terminalChange && leg.connectionMinutes != null && leg.connectionMinutes < 180) return "high";
  if (leg.connectionMinutes != null && leg.minimumConnectionMinutes != null && leg.connectionMinutes < leg.minimumConnectionMinutes) return "high";
  if (leg.visaStatus === "unknown") return "high";
  if (leg.terminalChange || leg.visaStatus === "review" || numberValue(leg.transfers) >= 2) return "medium";
  return "low";
}

export function scoreLeg(leg: TransportLeg, policy = DEFAULT_POLICY) {
  const rejectReasons = legRejectReasons(leg, policy);
  if (rejectReasons.length) return { eligible: false as const, rejectReasons, score: Infinity, trueCostTry: Infinity, risk: "high" as RiskLevel };
  const risk = riskLevel(leg);
  const trueCostTry = Math.round(trueLegCost(leg));
  const durationHours = numberValue(leg.durationMinutes) / 60;
  const timePenalty = Math.max(0, durationHours - 2) * 55;
  return {
    eligible: true as const,
    rejectReasons: [],
    risk,
    trueCostTry,
    score: Math.round(trueCostTry + timePenalty + numberValue(policy.riskPenaltyTry[risk])),
  };
}

export function itineraryCost(legs: TransportLeg[], policy = DEFAULT_POLICY) {
  const evaluated = legs.map((leg) => ({ leg, evaluation: scoreLeg(leg, policy) }));
  const rejected = evaluated.filter((item) => !item.evaluation.eligible);
  if (rejected.length) return { eligible: false as const, rejected, trueCostTry: Infinity, score: Infinity, totalDurationMinutes: 0, nightServices: 0 };
  const fareTry = legs.reduce((sum, leg) => sum + numberValue(leg.fareTry), 0);
  const extrasTry = legs.reduce((sum, leg) => sum + numberValue(leg.baggageTry) + numberValue(leg.bookingFeeTry) + numberValue(leg.originAccessTry) + numberValue(leg.destinationAccessTry) + numberValue(leg.requiredAccommodationTry), 0);
  const hotelSavingsTry = legs.reduce((sum, leg) => sum + (leg.nightService ? numberValue(leg.hotelNightSavedTry) : 0), 0);
  const qualityOrder: DataQuality[] = ["A", "B", "C", "D"];
  const dataQuality = legs.reduce<DataQuality>((worst, leg) => {
    const quality = leg.dataQuality ?? "D";
    return qualityOrder.indexOf(quality) > qualityOrder.indexOf(worst) ? quality : worst;
  }, "A");
  const risk = legs.reduce<RiskLevel>((worst, leg) => {
    const rank: Record<RiskLevel, number> = { low: 0, medium: 1, high: 2 };
    const current = riskLevel(leg);
    return rank[current] > rank[worst] ? current : worst;
  }, "low");
  return {
    eligible: true as const,
    rejected: [],
    trueCostTry: Math.max(0, evaluated.reduce((sum, item) => sum + item.evaluation.trueCostTry, 0)),
    score: evaluated.reduce((sum, item) => sum + item.evaluation.score, 0),
    fareTry,
    extrasTry,
    hotelSavingsTry,
    totalDurationMinutes: legs.reduce((sum, leg) => sum + numberValue(leg.durationMinutes), 0),
    nightServices: legs.filter((leg) => leg.nightService).length,
    dataQuality,
    risk,
  };
}

export function compareToBaseline(
  itinerary: { trueCostTry: number; totalDurationMinutes: number },
  baseline: { trueCostTry: number; totalDurationMinutes: number },
) {
  const savingsTry = Math.round(baseline.trueCostTry - itinerary.trueCostTry);
  const extraMinutes = Math.round(itinerary.totalDurationMinutes - baseline.totalDurationMinutes);
  const extraHours = Math.max(0, extraMinutes / 60);
  return {
    savingsTry,
    extraMinutes,
    savingsPerExtraHourTry: extraHours > 0 ? Math.round(savingsTry / extraHours) : null,
  };
}

type RouteEdge = TransportLeg & { from: string; to: string };

function permutations<T>(items: T[]): T[][] {
  if (items.length <= 1) return [items];
  return items.flatMap((item, index) =>
    permutations([...items.slice(0, index), ...items.slice(index + 1)]).map((tail) => [item, ...tail]),
  );
}

export function optimizeCityOrder(
  start: string,
  end: string,
  cities: string[],
  edges: RouteEdge[],
  policy = DEFAULT_POLICY,
) {
  if (cities.length > 7) throw new Error("Şehir optimizasyonu en fazla 7 ara durak destekliyor");
  const candidates = permutations([...new Set(cities)].filter((city) => city !== start && city !== end));
  const evaluated = candidates.flatMap((order) => {
    const sequence = [start, ...order, end];
    const legs: RouteEdge[] = [];
    for (let index = 0; index < sequence.length - 1; index += 1) {
      const leg = edges
        .filter((edge) => edge.from === sequence[index] && edge.to === sequence[index + 1])
        .map((edge) => ({ edge, evaluation: scoreLeg(edge, policy) }))
        .filter((item) => item.evaluation.eligible)
        .sort((a, b) => a.evaluation.score - b.evaluation.score)[0]?.edge;
      if (!leg) return [];
      legs.push(leg);
    }
    const result = itineraryCost(legs, policy);
    return result.eligible ? [{ sequence, legs, evaluation: result }] : [];
  });
  return evaluated.sort((a, b) => a.evaluation.score - b.evaluation.score)[0] ?? null;
}
