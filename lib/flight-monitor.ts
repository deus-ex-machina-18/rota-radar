import { DESTINATIONS, isFlightDestination, todayDestinationCodes, type Destination } from "@/lib/destination-catalog";
export { DESTINATIONS, CORE_DESTINATION_CODES, todayDestinationCodes } from "@/lib/destination-catalog";
import { radarWindow, settledWithLimit } from "@/lib/search-window";
import { searchApiKey } from "@/lib/runtime-env";
import { readHistoricalBaselines, saveBaselines, saveDeals, saveVerifiedDeal } from "@/lib/flight-history-store";
import { chooseFlightOption, hasSeparateTicketRisk } from "@/lib/flight-option-selector";
import { hasSignificantPriceChange, ticketCheckPath, trustedGoogleUrl } from "@/lib/booking-policy";
import { flightSearchPolicy } from "@/lib/flight-search-policy";
import {
  choosePriceBaseline,
  summarizeCalendarPrices,
  type CalendarPricePoint,
} from "@/lib/price-baseline";

export type Deal = {
  destination: string;
  city: string;
  country: string;
  adults: number;
  departure: string;
  returnDate: string;
  nights: number;
  totalPriceTry: number;
  perPersonTry: number;
  origin: string;
  visaSafe: boolean;
  stopPolicy: string;
  weatherNote: string;
  reason: string;
  source: "live" | "history" | "pilot";
  baselinePerPersonTry?: number;
  baselineLabel?: string;
  opportunityPct?: number;
  historyCount?: number;
  observedAt?: string;
  airline?: string;
  outboundDurationMinutes?: number;
  returnDurationMinutes?: number;
  seller?: string;
  baggage?: string;
  bookingPath?: string;
  googleFlightsUrl?: string;
  discoverySource?: "watchlist" | "world";
  tripPlan?: string;
  entryNote?: string;
  entrySourceUrl?: string;
  riskNote?: string;
  verificationStatus?: "verified" | "price_changed" | "detail_unavailable";
  verifiedAt?: string;
};

export type OpenJawFlightOption = {
  origin: "ESB" | "IST" | "SAW";
  entry: string;
  exit: string;
  totalPriceTry: number;
  perPersonTry: number;
  durationMinutes: number;
  airline?: string;
  stops: number;
  selfTransfer: boolean;
  terminalChange: boolean;
  connectionMinutes?: number;
  transitVisaRisk: boolean;
  bookingPath: string;
  dataQuality: "A";
};

type ApiPayload = Record<string, unknown>;
// SearchAPI'de 1 değeri ayrı bilet ve self-transfer sonuçlarını gizler.
const HIDE_SEPARATE_TICKETS = "1";

const EXCLUDED_NAMES = ["egypt", "mısır", "cairo", "kahire", "sharm", "hurghada", "mardin", "diyarbakır", "diyarbakir"];
const HIGH_RISK_NAMES = ["afganistan", "afghanistan", "suriye", "syria", "yemen", "lübnan", "lebanon", "ukrayna", "ukraine", "israil", "israel", "filistin", "palestine", "sudan", "somali", "libya", "irak", "iraq", "iran", "rusya", "russia"];
const EASY_ENTRY_COUNTRIES = [
  "türkiye", "turkey", "gürcistan", "georgia", "azerbaycan", "azerbaijan", "fas", "morocco",
  "özbekistan", "uzbekistan", "kazakistan", "kazakhstan", "kırgızistan", "kyrgyzstan", "moldova",
  "bosna", "bosnia", "kuzey makedonya", "north macedonia", "arnavutluk", "albania", "kosova", "kosovo",
  "karadağ", "montenegro", "sırbistan", "serbia", "tunus", "tunisia", "ürdün", "jordan", "katar", "qatar",
  "umman", "oman", "malezya", "malaysia", "endonezya", "indonesia", "tayland", "thailand", "sri lanka",
  "singapur", "singapore", "tanzanya", "tanzania", "mauritius", "japonya", "japan", "güney kore", "south korea",
  "maldivler", "maldives", "brunei", "tacikistan", "tajikistan", "suudi arabistan", "saudi arabia",
  "bahreyn", "bahrain", "birleşik arap emirlikleri", "united arab emirates", "filipinler", "philippines",
  "vietnam", "pakistan", "bangladeş", "bangladesh", "kktc", "northern cyprus",
];
const SHORT_TRIP_COUNTRIES = [
  "türkiye", "turkey", "gürcistan", "georgia", "azerbaycan", "azerbaijan", "moldova", "bosna", "bosnia",
  "kuzey makedonya", "north macedonia", "arnavutluk", "albania", "kosova", "kosovo", "karadağ", "montenegro",
  "sırbistan", "serbia", "kktc", "northern cyprus", "katar", "qatar",
];

const addDays = (date: Date, days: number) => {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
};
const iso = (date: Date) => date.toISOString().slice(0, 10);

function isValidTrip(item: Record<string, unknown>, destination: Destination) {
  if (typeof item.departure !== "string" || typeof item.return !== "string") return false;
  const departure = new Date(`${item.departure}T12:00:00Z`);
  const returnDate = new Date(`${item.return}T12:00:00Z`);
  const nights = Math.round((returnDate.getTime() - departure.getTime()) / 86_400_000);
  if (!Number.isFinite(nights) || nights < destination.minNights || nights > destination.maxNights) return false;
  return !destination.weekendOnly ||
    ([5, 6].includes(departure.getUTCDay()) && [0, 1].includes(returnDate.getUTCDay()));
}

async function apiGet(params: URLSearchParams) {
  const response = await fetch(`https://www.searchapi.io/api/v1/search?${params.toString()}`, {
    signal: AbortSignal.timeout(30_000),
    headers: {
      Authorization: `Bearer ${searchApiKey()}`,
      Accept: "application/json",
    },
  });
  if (!response.ok) {
    const explanation = response.status === 429 ? "sorgu sınırına ulaşıldı" : [401, 403].includes(response.status) ? "erişim reddedildi" : "istek başarısız";
    throw new Error(`Fiyat kaynağı HTTP ${response.status}: ${explanation}`);
  }
  const payload = await response.json() as ApiPayload;
  if (payload.error) throw new Error("Fiyat kaynağı sorguyu reddetti");
  return payload;
}

function addScore(
  deal: Deal,
  baseline: number | null,
  label: string,
  historyCount: number,
  observedAt: string,
): Deal {
  const opportunityPct = baseline && baseline > 0
    ? Math.round(((baseline - deal.perPersonTry) / baseline) * 100)
    : undefined;
  const reason = opportunityPct !== undefined && opportunityPct >= 20
    ? `${label} karşılaştırmasında %${opportunityPct} daha ucuz`
    : opportunityPct !== undefined && opportunityPct >= 10
      ? `${label} karşılaştırmasında iyi fiyat`
      : deal.reason;
  return {
    ...deal,
    reason,
    baselinePerPersonTry: baseline ?? undefined,
    baselineLabel: label,
    opportunityPct,
    historyCount,
    observedAt,
  };
}

async function recordAndScore(deals: Deal[], calendarPoints: CalendarPricePoint[]) {
  const observedAt = new Date().toISOString();
  const observedDay = observedAt.slice(0, 10);
  if (!deals.length) return deals;
  const dailyBaselines = summarizeCalendarPrices(calendarPoints);
  const first = deals[0];
  const minNights = Math.min(...deals.map((deal) => deal.nights)) - 1;
  const maxNights = Math.max(...deals.map((deal) => deal.nights)) + 1;
  const historyRows = await readHistoricalBaselines(
    first.destination,
    first.adults,
    minNights,
    maxNights,
    observedDay,
    first.departure.slice(0, 7),
  );
  const scored = deals.map((deal) => {
    const baseline = choosePriceBaseline(deal.nights, dailyBaselines, historyRows);
    return addScore(deal, baseline.baseline, baseline.label, baseline.historyCount, observedAt);
  });
  await Promise.all([
    saveDeals(scored),
    saveBaselines(first.destination, first.adults, dailyBaselines, observedAt, first.departure.slice(0, 7)),
  ]);
  return scored;
}

async function searchDestination(destination: Destination, adults: number) {
  const { start, end } = radarWindow();
  const searchPolicy = flightSearchPolicy(destination.code);
  const params = new URLSearchParams({
    engine: "google_flights_calendar",
    flight_type: "round_trip",
    departure_id: "ESB,IST,SAW",
    arrival_id: destination.arrivalId ?? destination.code,
    adults: String(adults),
    travel_class: "economy",
    stops: searchPolicy.stops,
    layover_duration_max: "360",
    separate_tickets: HIDE_SEPARATE_TICKETS,
    outbound_date: iso(start),
    outbound_date_start: iso(start),
    outbound_date_end: iso(end),
    return_date: iso(addDays(start, destination.minNights)),
    return_date_start: iso(addDays(start, destination.minNights)),
    return_date_end: iso(addDays(end, destination.maxNights)),
    currency: "TRY",
    gl: "tr",
    hl: "tr",
  });
  const payload = await apiGet(params);
  const calendar = Array.isArray(payload.calendar)
    ? payload.calendar.filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object"))
    : [];
  const validRows = calendar.filter(
    (item) => typeof item.price === "number" && Number.isFinite(item.price) && item.price > 0 && String(item.departure) >= iso(start) && String(item.departure) <= iso(end) && isValidTrip(item, destination),
  );
  const calendarPoints = validRows.map((item) => {
    const departure = new Date(`${String(item.departure)}T12:00:00Z`);
    const returnDate = new Date(`${String(item.return)}T12:00:00Z`);
    return {
      nights: Math.round((returnDate.getTime() - departure.getTime()) / 86_400_000),
      perPersonTry: Math.round(Number(item.price) / adults),
    };
  });
  const deals: Deal[] = validRows
    .sort((a, b) => Number(a.price) - Number(b.price))
    .slice(0, 2)
    .map((item) => {
      const departure = String(item.departure);
      const returnDate = String(item.return);
      const nights = Math.round(
        (new Date(`${returnDate}T12:00:00Z`).getTime() -
          new Date(`${departure}T12:00:00Z`).getTime()) /
          86_400_000,
      );
      const total = Math.round(Number(item.price));
      return {
        destination: destination.code,
        city: destination.city,
        country: destination.country,
        adults,
        departure,
        returnDate,
        nights,
        totalPriceTry: total,
        perPersonTry: Math.round(total / adults),
        origin: calendarOrigin(item) ?? "ESB / IST / SAW",
        visaSafe: destination.visaSafe,
        stopPolicy: searchPolicy.label,
        weatherNote: destination.weatherNote,
        tripPlan: destination.tripPlan,
        entryNote: destination.entryNote,
        entrySourceUrl: destination.entrySourceUrl,
        riskNote: destination.riskNote,
        discoverySource: "watchlist",
        reason: item.is_lowest_price
          ? "Takvimde en düşük fiyat"
          : "Seçili pencerenin en iyilerinden",
        source: "live",
      };
    });
  return recordAndScore(
    deals.map((deal) => ({ ...deal, bookingPath: ticketCheckPath(deal) })),
    calendarPoints,
  );
}

function calendarOrigin(item: Record<string, unknown>) {
  const origin = item.origin;
  const candidates = [
    item.departure_id,
    item.origin_airport,
    origin && typeof origin === "object" ? (origin as Record<string, unknown>).airport_code : undefined,
    origin && typeof origin === "object" ? (origin as Record<string, unknown>).id : undefined,
  ];
  return candidates.map((value) => String(value ?? "").toUpperCase())
    .find((value) => value === "ESB" || value === "IST" || value === "SAW");
}

function segmentAirlines(option: Record<string, unknown>) {
  const flights = Array.isArray(option.flights)
    ? option.flights.filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object"))
    : [];
  return [...new Set(flights.map((item) => String(item.airline ?? "")).filter(Boolean))].join(", ");
}

function originFromOption(option: Record<string, unknown>) {
  const flights = Array.isArray(option.flights)
    ? option.flights.filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object"))
    : [];
  const airport = flights[0]?.departure_airport;
  return airport && typeof airport === "object"
    ? String((airport as Record<string, unknown>).id ?? "")
    : "";
}

const SCHENGEN_TRANSIT_AIRPORTS = new Set([
  "AMS", "ATH", "BCN", "BER", "BRU", "CDG", "CPH", "FCO", "FRA", "HEL", "LIS", "MAD", "MUC", "MXP", "ORY", "OSL", "VIE", "WAW", "ZRH",
]);

function optionStops(option: Record<string, unknown>) {
  const flights = Array.isArray(option.flights) ? option.flights : [];
  return Math.max(0, flights.length - 1);
}

function optionTransitRisk(option: Record<string, unknown>) {
  const layovers = Array.isArray(option.layovers)
    ? option.layovers.filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object"))
    : [];
  return layovers.some((layover) => SCHENGEN_TRANSIT_AIRPORTS.has(String(layover.id ?? layover.airport_code ?? "").toUpperCase()));
}

function optionMinimumLayover(option: Record<string, unknown>) {
  const values = Array.isArray(option.layovers)
    ? option.layovers.flatMap((item) => item && typeof item === "object" && typeof (item as Record<string, unknown>).duration === "number"
      ? [Number((item as Record<string, unknown>).duration)]
      : [])
    : [];
  return values.length ? Math.min(...values) : undefined;
}

function optionTerminalChange(option: Record<string, unknown>) {
  if (option.is_airport_change) return true;
  const flights = Array.isArray(option.flights)
    ? option.flights.filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object"))
    : [];
  for (let index = 0; index < flights.length - 1; index += 1) {
    const arrival = flights[index].arrival_airport;
    const departure = flights[index + 1].departure_airport;
    const arrivalId = arrival && typeof arrival === "object" ? String((arrival as Record<string, unknown>).id ?? "") : "";
    const departureId = departure && typeof departure === "object" ? String((departure as Record<string, unknown>).id ?? "") : "";
    if (arrivalId && departureId && arrivalId !== departureId) return true;
  }
  return false;
}

function multiCityBase(origin: string, entry: string, exit: string, departure: string, returnDate: string, adults: number) {
  const searchPolicy = flightSearchPolicy(entry);
  return new URLSearchParams({
    engine: "google_flights",
    flight_type: "multi_city",
    multi_city_json: JSON.stringify([
      { departure_id: origin, arrival_id: entry, outbound_date: departure },
      { departure_id: exit, arrival_id: origin, outbound_date: returnDate },
    ]),
    adults: String(adults),
    travel_class: "economy",
    stops: searchPolicy.stops,
    layover_duration_max: "360",
    separate_tickets: HIDE_SEPARATE_TICKETS,
    carry_on_bags: "0",
    checked_bags: "0",
    sort_by: "price",
    show_cheapest_flights: "true",
    expanded_search: "true",
    currency: "TRY",
    gl: "tr",
    hl: "tr",
  });
}

async function resolveOpenJaw(
  origin: "ESB" | "IST" | "SAW",
  entry: string,
  exit: string,
  departure: string,
  returnDate: string,
  adults: number,
  includeBooking = false,
) {
  const base = multiCityBase(origin, entry, exit, departure, returnDate, adults);
  const firstPayload = await apiGet(base);
  const first = chooseFlightOption(firstPayload, "departure_token");
  const secondParams = new URLSearchParams(base);
  secondParams.set("departure_token", String(first.departure_token));
  const secondPayload = await apiGet(secondParams);
  const second = chooseFlightOption(secondPayload, "booking_token");
  const totalPriceTry = Math.round(Number(second.price ?? first.price));
  if (!Number.isFinite(totalPriceTry) || totalPriceTry <= 0) throw new Error(`${origin} open-jaw fiyatı alınamadı`);
  const bookingPath = `/api/multicity-book?${new URLSearchParams({
    origin,
    entry,
    exit,
    departure,
    return: returnDate,
    adults: String(adults),
    price: String(totalPriceTry),
  }).toString()}`;
  const combinedStops = Math.max(optionStops(first), optionStops(second));
  const option: OpenJawFlightOption = {
    origin,
    entry,
    exit,
    totalPriceTry,
    perPersonTry: Math.round(totalPriceTry / adults),
    durationMinutes: Number(first.total_duration ?? 0) + Number(second.total_duration ?? 0),
    airline: [segmentAirlines(first), segmentAirlines(second)].filter(Boolean).join(" / ") || undefined,
    stops: combinedStops,
    selfTransfer: hasSeparateTicketRisk(first) || hasSeparateTicketRisk(second),
    terminalChange: optionTerminalChange(first) || optionTerminalChange(second),
    connectionMinutes: [optionMinimumLayover(first), optionMinimumLayover(second)].filter((value): value is number => typeof value === "number").sort((a, b) => a - b)[0],
    transitVisaRisk: optionTransitRisk(first) || optionTransitRisk(second),
    bookingPath,
    dataQuality: "A",
  };
  if (!includeBooking) return { option };
  const bookingParams = new URLSearchParams(base);
  bookingParams.set("booking_token", String(second.booking_token));
  const bookingPayload = await apiGet(bookingParams);
  const bookingOptions = Array.isArray(bookingPayload.booking_options)
    ? (bookingPayload.booking_options as Array<Record<string, unknown>>)
      .filter((item) => {
          const request = item.booking_request as Record<string, unknown> | undefined;
          return !item.is_split_booking && request && typeof request.url === "string" && trustedGoogleUrl(request.url) && typeof request.post_data === "string" && request.post_data.length > 0;
        })
      .sort((a, b) => Number(a.price ?? Number.MAX_SAFE_INTEGER) - Number(b.price ?? Number.MAX_SAFE_INTEGER))
    : [];
  const seller = bookingOptions[0];
  const request = seller?.booking_request && typeof seller.booking_request === "object"
    ? seller.booking_request as Record<string, unknown>
    : undefined;
  return {
    option,
    booking: {
      url: typeof request?.url === "string" ? request.url : undefined,
      postData: typeof request?.post_data === "string" ? request.post_data : undefined,
      seller: seller?.book_with ? String(seller.book_with) : "Google Flights",
    },
  };
}

export async function searchOpenJawOptions(args: {
  entry: string;
  exit: string;
  departure: string;
  returnDate: string;
  adults: number;
}) {
  if (!searchApiKey()) throw new Error("Canlı fiyat bağlantısı etkin değil");
  const origins = ["ESB", "IST", "SAW"] as const;
  const settled = await Promise.allSettled(origins.map((origin) =>
    resolveOpenJaw(origin, args.entry, args.exit, args.departure, args.returnDate, args.adults),
  ));
  const options = settled.flatMap((result) => result.status === "fulfilled" ? [result.value.option] : []);
  const errors = settled.flatMap((result) => result.status === "rejected"
    ? [result.reason instanceof Error ? result.reason.message : "Open-jaw sorgusu başarısız"]
    : []);
  return { options, errors };
}

export async function createOpenJawBookingHandoff(args: {
  origin: "ESB" | "IST" | "SAW";
  entry: string;
  exit: string;
  departure: string;
  returnDate: string;
  adults: number;
}) {
  if (!searchApiKey()) throw new Error("Canlı fiyat bağlantısı etkin değil");
  return resolveOpenJaw(args.origin, args.entry, args.exit, args.departure, args.returnDate, args.adults, true);
}

type BookingHandoff = {
  url?: string;
  postData?: string;
  fallbackUrl?: string;
  seller?: string;
  currentTotalPriceTry: number;
  verified: Deal;
};

function googleRequestUrl(payload: ApiPayload) {
  const metadata = payload.search_metadata;
  if (!metadata || typeof metadata !== "object") return undefined;
  const value = (metadata as Record<string, unknown>).request_url;
  if (typeof value !== "string") return undefined;
  return trustedGoogleUrl(value);
}

async function resolveDealDetails(deal: Deal): Promise<BookingHandoff> {
  const destination = DESTINATIONS[deal.destination];
  const arrivalId = destination?.arrivalId ?? deal.destination;
  const searchPolicy = flightSearchPolicy(deal.destination);
  const base = new URLSearchParams({
    engine: "google_flights",
    flight_type: "round_trip",
    departure_id: ["ESB", "IST", "SAW"].includes(deal.origin) ? deal.origin : "ESB,IST,SAW",
    arrival_id: arrivalId,
    outbound_date: deal.departure,
    return_date: deal.returnDate,
    adults: String(deal.adults),
    travel_class: "economy",
    stops: searchPolicy.stops,
    layover_duration_max: "360",
    separate_tickets: HIDE_SEPARATE_TICKETS,
    carry_on_bags: "0",
    checked_bags: "0",
    sort_by: "price",
    show_cheapest_flights: "true",
    expanded_search: "true",
    currency: "TRY",
    gl: "tr",
    hl: "tr",
  });
  const outboundPayload = await apiGet(base);
  const outbound = chooseFlightOption(outboundPayload, "departure_token");
  const returnParams = new URLSearchParams(base);
  returnParams.set("departure_token", String(outbound.departure_token));
  const returnPayload = await apiGet(returnParams);
  const inbound = chooseFlightOption(returnPayload, "booking_token");

  const selectedOrigin = originFromOption(outbound) || "ESB,IST,SAW";
  const bookingParams = new URLSearchParams(base);
  bookingParams.set("departure_id", selectedOrigin);
  bookingParams.set("booking_token", String(inbound.booking_token));
  const bookingPayload = await apiGet(bookingParams);
  const bookingOptions = Array.isArray(bookingPayload.booking_options)
    ? (bookingPayload.booking_options as Array<Record<string, unknown>>)
        .filter((item) => {
          const request = item.booking_request as Record<string, unknown> | undefined;
          return !item.is_split_booking && request && typeof request.url === "string" && trustedGoogleUrl(request.url) && typeof request.post_data === "string" && request.post_data.length > 0;
        })
        .sort((a, b) => Number(a.price ?? Number.MAX_SAFE_INTEGER) - Number(b.price ?? Number.MAX_SAFE_INTEGER))
    : [];
  const seller = bookingOptions[0];
  const bookingRequest = seller?.booking_request && typeof seller.booking_request === "object"
    ? seller.booking_request as Record<string, unknown>
    : undefined;
  const detailedTotal = typeof seller?.price === "number"
    ? seller.price
    : typeof inbound.price === "number"
    ? inbound.price
    : typeof outbound.price === "number"
      ? outbound.price
      : NaN;
  if (!Number.isFinite(detailedTotal) || detailedTotal <= 0) throw new Error("Ayrıntılı uçuş fiyatı alınamadı");
  const verificationStatus = hasSignificantPriceChange(deal.totalPriceTry, Number(detailedTotal))
    ? "price_changed"
    : seller ? "verified" : "detail_unavailable";
  const baggage = Array.isArray(seller?.baggage_prices)
    ? seller.baggage_prices.map(String).join(" · ")
    : undefined;
  const verified: Deal = {
    ...deal,
    origin: selectedOrigin,
    airline: [segmentAirlines(outbound), segmentAirlines(inbound)].filter(Boolean).join(" / "),
    outboundDurationMinutes: typeof outbound.total_duration === "number" ? outbound.total_duration : undefined,
    returnDurationMinutes: typeof inbound.total_duration === "number" ? inbound.total_duration : undefined,
    seller: seller?.book_with ? String(seller.book_with) : undefined,
    baggage,
    googleFlightsUrl: googleRequestUrl(outboundPayload) ?? deal.googleFlightsUrl,
    bookingPath: ticketCheckPath({ ...deal, origin: selectedOrigin }),
    verificationStatus,
    verifiedAt: new Date().toISOString(),
    reason: verificationStatus === "verified"
      ? "Uçuş ve satıcı bağlantısı kontrol edildi"
      : verificationStatus === "price_changed" ? "Ayrıntılı kontrolde fiyat değişti; karttaki fiyat eski kayıt" : "Uçuş bulundu; satıcı bağlantısı doğrulanamadı",
  };
  await saveVerifiedDeal(verified);
  return {
    url: typeof bookingRequest?.url === "string" ? bookingRequest.url : undefined,
    postData: typeof bookingRequest?.post_data === "string" ? bookingRequest.post_data : undefined,
    fallbackUrl: verified.googleFlightsUrl,
    seller: verified.seller,
    currentTotalPriceTry: Math.round(Number(detailedTotal)),
    verified,
  };
}

async function verifyDeal(deal: Deal): Promise<Deal> {
  return (await resolveDealDetails(deal)).verified;
}

export async function createBookingHandoff(deal: Deal) {
  if (!searchApiKey()) throw new Error("Canlı fiyat bağlantısı etkin değil");
  return resolveDealDetails(deal);
}

function excludedDiscovery(name: string, country: string) {
  const haystack = `${name} ${country}`.toLocaleLowerCase("tr-TR");
  return [...EXCLUDED_NAMES, ...HIGH_RISK_NAMES].some((value) => haystack.includes(value));
}

function countryMatches(country: string, list: string[]) {
  const normalized = country.toLocaleLowerCase("tr-TR").trim();
  return list.some((value) => normalized === value || normalized.startsWith(`${value} `) || normalized.startsWith(`${value}-`));
}

function trustedGoogleFlightsLink(value: unknown) {
  if (typeof value !== "string") return undefined;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && (url.hostname === "google.com" || url.hostname.endsWith(".google.com"))
      ? url.toString()
      : undefined;
  } catch {
    return undefined;
  }
}

async function recordDiscoveryDeals(deals: Deal[]) {
  await saveDeals(deals);
}

export async function discoverWorldDeals(adults: number, detailLimit = 1) {
  if (!searchApiKey()) throw new Error("Canlı fiyat bağlantısı etkin değil");
  const origins = ["ESB", "IST", "SAW"];
  const settled = await Promise.allSettled(origins.map(async (origin) => {
    const payload = await apiGet(new URLSearchParams({
      engine: "google_flights_deals",
      departure_id: origin,
      adults: String(adults),
      travel_class: "economy",
      stops: "one_stop_or_fewer",
      max_price: String(50_000 * adults),
      currency: "TRY",
      gl: "tr",
      hl: "tr",
    }));
    const rows = Array.isArray(payload.deals)
      ? payload.deals.filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object"))
      : [];
    return rows.slice(0, 12).flatMap((item): Deal[] => {
      const destination = item.destination;
      const originData = item.origin;
      if (!destination || typeof destination !== "object") return [];
      const info = destination as Record<string, unknown>;
      const code = typeof info.airport_code === "string" ? info.airport_code.toUpperCase() : "";
      const city = typeof info.name === "string" ? info.name : code;
      const country = typeof info.country === "string" ? info.country : "";
      const departure = typeof item.outbound_date === "string" ? item.outbound_date : "";
      const returnDate = typeof item.return_date === "string" ? item.return_date : "";
      const total = typeof item.price === "number" ? Math.round(item.price) : 0;
      const typical = typeof item.typical_price === "number" ? Math.round(item.typical_price) : 0;
      if (!code || !departure || !returnDate || !total || excludedDiscovery(city, country) || !countryMatches(country, EASY_ENTRY_COUNTRIES)) return [];
      const nights = Math.round((new Date(`${returnDate}T12:00:00Z`).getTime() - new Date(`${departure}T12:00:00Z`).getTime()) / 86_400_000);
      if (nights < 2 || nights > 14) return [];
      if (countryMatches(country, SHORT_TRIP_COUNTRIES) && nights > 5) return [];
      const savings = typeof item.savings_percentage === "number"
        ? Math.round(item.savings_percentage)
        : typical > 0 ? Math.round(((typical - total) / typical) * 100) : 0;
      // Yüzde 20 eşiği yalnızca fırsat rozetini belirler; sonucu görünmez yapmaz.
      // Böylece dünya keşfindeki uygun fiyatlı ama henüz güçlü fırsat sayılmayan
      // uçuşlar da kullanıcı tarafından karşılaştırılabilir.
      if (Math.round(total / adults) > 50_000) return [];
      const foundOrigin = originData && typeof originData === "object" && typeof (originData as Record<string, unknown>).airport_code === "string"
        ? String((originData as Record<string, unknown>).airport_code)
        : origin;
      return [{
        destination: code,
        city,
        country,
        adults,
        departure,
        returnDate,
        nights,
        totalPriceTry: total,
        perPersonTry: Math.round(total / adults),
        origin: foundOrigin,
        visaSafe: true,
        stopPolicy: Number(item.stops ?? 0) === 0 ? "Direkt" : "En fazla 1 aktarma",
        weatherNote: "Mevsim, güvenlik ve helal yemek sonraki kontrolde doğrulanır",
        tripPlan: `${nights} gecelik dünya fırsatı`,
        reason: `Dünya taramasında olağan fiyattan %${savings} ucuz`,
        source: "live",
        baselinePerPersonTry: typical ? Math.round(typical / adults) : undefined,
        baselineLabel: "Google Flights olağan fiyatı",
        opportunityPct: savings,
        historyCount: 0,
        observedAt: new Date().toISOString(),
        airline: typeof item.airline === "string" ? item.airline : undefined,
        outboundDurationMinutes: typeof item.duration === "number" ? item.duration : undefined,
        googleFlightsUrl: trustedGoogleFlightsLink(item.booking_link),
        discoverySource: "world",
      }];
    });
  }));

  const errors = settled
    .filter((result): result is PromiseRejectedResult => result.status === "rejected")
    .map((result) => result.reason instanceof Error ? result.reason.message : "Dünya taraması hatası");
  const discovered = settled.flatMap((result) => result.status === "fulfilled" ? result.value : []);
  const unique = [...new Map(discovered
    .sort((a, b) => (b.opportunityPct ?? 0) - (a.opportunityPct ?? 0))
    .map((deal) => [`${deal.destination}-${deal.adults}-${deal.departure}-${deal.returnDate}`, deal])).values()];
  await recordDiscoveryDeals(unique);

  for (const candidate of unique.slice(0, detailLimit)) {
    try {
      const verified = await verifyDeal(candidate);
      const index = unique.indexOf(candidate);
      if (index >= 0) unique[index] = verified;
    } catch (error) {
      candidate.verificationStatus = "detail_unavailable";
      errors.push(error instanceof Error ? error.message : "Dünya fırsatı doğrulanamadı");
    }
  }
  return { deals: unique.slice(0, 18), errors, successfulOrigins: settled.filter(result => result.status === "fulfilled").length, destinationsFound: new Set(unique.map((deal) => deal.destination)).size };
}

export async function runScan(
  destinationCodes: string[],
  adults: number,
  detailLimit = 1,
) {
  if (!searchApiKey()) throw new Error("Canlı fiyat bağlantısı etkin değil");
  const selected = destinationCodes
    .map((code) => DESTINATIONS[code])
    .filter(isFlightDestination);
  const settled = await settledWithLimit(selected, 3, (destination) => searchDestination(destination, adults));
  const successfulDestinations = settled.filter(result => result.status === "fulfilled").length;
  const deals = settled.flatMap((result) => result.status === "fulfilled" ? result.value : []);
  const errors = settled
    .filter((result): result is PromiseRejectedResult => result.status === "rejected")
    .map((result) => result.reason instanceof Error ? result.reason.message : "Bilinmeyen tarama hatası");

  const candidates = deals
    .filter((deal) => (deal.opportunityPct ?? 0) >= 20)
    .sort((a, b) => (b.opportunityPct ?? 0) - (a.opportunityPct ?? 0))
    .slice(0, detailLimit);
  for (const candidate of candidates) {
    try {
      const verified = await verifyDeal(candidate);
      const index = deals.findIndex((deal) =>
        deal.destination === candidate.destination &&
        deal.adults === candidate.adults &&
        deal.departure === candidate.departure &&
        deal.returnDate === candidate.returnDate
      );
      if (index >= 0) deals[index] = verified;
    } catch (error) {
      candidate.verificationStatus = "detail_unavailable";
      errors.push(error instanceof Error ? error.message : "Ayrıntılı doğrulama hatası");
    }
  }
  return {
    deals: deals.sort((a, b) => a.perPersonTry - b.perPersonTry),
    errors,
    successfulDestinations,
    window: { start: iso(radarWindow().start), end: iso(radarWindow().end), scope: "sample" },
  };
}
