import { chooseFlightOption, hasSeparateTicketRisk } from "@/lib/flight-option-selector";
import { hasSignificantPriceChange, ticketCheckPath, trustedGoogleUrl } from "@/lib/booking-policy";
import { flightSearchPolicy } from "@/lib/flight-search-policy";
import {
  readHistoricalBaselines,
  saveBaselines,
  saveDeals,
  saveVerifiedDeal,
} from "@/lib/flight-history-store";
import {
  choosePriceBaseline,
  summarizeCalendarPrices,
  type CalendarPricePoint,
} from "@/lib/price-baseline";
import { searchApiKey } from "@/lib/runtime-env";

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
  verificationStatus?: "verified" | "price_changed" | "detail_unavailable";
  verifiedAt?: string;
};

export type Destination = {
  city: string;
  country: string;
  code: string;
  arrivalId?: string;
  group: "Türkiye" | "Balkanlar" | "Kafkasya" | "Fas ve Kuzey Afrika" | "Türk dünyası" | "Müslüman Asya" | "Güney ve Güneydoğu Asya" | "Uzak rotalar";
  minNights: number;
  maxNights: number;
  weekendOnly: boolean;
  visaSafe: boolean;
  weatherNote: string;
  tripPlan: string;
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

export const DESTINATIONS: Record<string, Destination> = {
  TBS: { code: "TBS", city: "Tiflis", country: "Gürcistan", group: "Kafkasya", minNights: 2, maxNights: 3, weekendOnly: true, visaSafe: true, weatherNote: "Serin dönem · 0°C altı günler elenir", tripPlan: "2–3 gece şehir" },
  GYD: { code: "GYD", city: "Bakü", country: "Azerbaycan", group: "Türk dünyası", minNights: 2, maxNights: 3, weekendOnly: true, visaSafe: true, weatherNote: "Kuvvetli rüzgâr günleri elenir", tripPlan: "2–3 gece şehir" },
  VAS: { code: "VAS", city: "Sivas", country: "Türkiye", group: "Türkiye", minNights: 2, maxNights: 3, weekendOnly: true, visaSafe: true, weatherNote: "0°C altı günler elenir", tripPlan: "2–3 gece şehir" },
  CMN: { code: "CMN", city: "Kazablanka", country: "Fas", group: "Fas ve Kuzey Afrika", minNights: 6, maxNights: 9, weekendOnly: false, visaSafe: true, weatherNote: "Ilıman dönem", tripPlan: "6–9 gün Fas rotası" },
  RAK: { code: "RAK", city: "Marakeş", country: "Fas", group: "Fas ve Kuzey Afrika", minNights: 6, maxNights: 9, weekendOnly: false, visaSafe: true, weatherNote: "35°C üzeri günler elenir", tripPlan: "6–9 gün Fas rotası" },
  FEZ: { code: "FEZ", city: "Fes", country: "Fas", group: "Fas ve Kuzey Afrika", minNights: 5, maxNights: 8, weekendOnly: false, visaSafe: true, weatherNote: "Aşırı sıcak günler elenir", tripPlan: "5–8 gün kültür rotası" },
  RBA: { code: "RBA", city: "Rabat", country: "Fas", group: "Fas ve Kuzey Afrika", minNights: 5, maxNights: 8, weekendOnly: false, visaSafe: true, weatherNote: "Ilıman dönem", tripPlan: "5–8 gün şehir ve okyanus" },
  AGA: { code: "AGA", city: "Agadir", country: "Fas", group: "Fas ve Kuzey Afrika", minNights: 6, maxNights: 9, weekendOnly: false, visaSafe: true, weatherNote: "Deniz sıcaklığı ayrıca doğrulanır", tripPlan: "6–9 gün sahil" },
  TAS: { code: "TAS", city: "Taşkent", country: "Özbekistan", group: "Türk dünyası", minNights: 5, maxNights: 8, weekendOnly: false, visaSafe: true, weatherNote: "Aşırı sıcak günler elenir", tripPlan: "5–8 gün Özbekistan" },
  SKD: { code: "SKD", city: "Semerkant", country: "Özbekistan", group: "Türk dünyası", minNights: 5, maxNights: 8, weekendOnly: false, visaSafe: true, weatherNote: "Aşırı sıcak günler elenir", tripPlan: "5–8 gün Semerkant–Buhara" },
  ALA: { code: "ALA", city: "Almatı", country: "Kazakistan", group: "Türk dünyası", minNights: 5, maxNights: 8, weekendOnly: false, visaSafe: true, weatherNote: "0°C altı günler elenir", tripPlan: "5–8 gün şehir ve doğa" },
  NQZ: { code: "NQZ", city: "Astana", country: "Kazakistan", group: "Türk dünyası", minNights: 4, maxNights: 7, weekendOnly: false, visaSafe: true, weatherNote: "Sert soğuk ve rüzgâr elenir", tripPlan: "4–7 gün şehir" },
  FRU: { code: "FRU", city: "Bişkek", country: "Kırgızistan", group: "Türk dünyası", minNights: 5, maxNights: 8, weekendOnly: false, visaSafe: true, weatherNote: "0°C altı günler elenir", tripPlan: "5–8 gün Bişkek–Issık Göl" },
  RMO: { code: "RMO", city: "Kişinev", country: "Moldova", group: "Türk dünyası", minNights: 3, maxNights: 5, weekendOnly: false, visaSafe: true, weatherNote: "0°C altı günler elenir", tripPlan: "3–5 gün Kişinev–Gagavuzya" },
  ECN: { code: "ECN", city: "Lefkoşa", country: "KKTC", group: "Türk dünyası", minNights: 3, maxNights: 5, weekendOnly: false, visaSafe: true, weatherNote: "Deniz sıcaklığı ayrıca doğrulanır", tripPlan: "3–5 gün şehir ve sahil" },
  SJJ: { code: "SJJ", city: "Saraybosna", country: "Bosna-Hersek", group: "Balkanlar", minNights: 2, maxNights: 3, weekendOnly: true, visaSafe: true, weatherNote: "0°C altı günler elenir", tripPlan: "2–3 gece şehir · Mostar ile 4–5 gün" },
  SKP: { code: "SKP", city: "Üsküp", country: "Kuzey Makedonya", group: "Balkanlar", minNights: 2, maxNights: 3, weekendOnly: true, visaSafe: true, weatherNote: "0°C altı günler elenir", tripPlan: "2–3 gece şehir · Ohri ile 4–5 gün" },
  OHD: { code: "OHD", city: "Ohri", country: "Kuzey Makedonya", group: "Balkanlar", minNights: 3, maxNights: 5, weekendOnly: false, visaSafe: true, weatherNote: "0°C altı günler elenir", tripPlan: "3–5 gün göl rotası" },
  TIA: { code: "TIA", city: "Tiran", country: "Arnavutluk", group: "Balkanlar", minNights: 2, maxNights: 3, weekendOnly: true, visaSafe: true, weatherNote: "35°C üzeri günler elenir", tripPlan: "2–3 gece şehir · Berat/sahil ile 4–8 gün" },
  PRN: { code: "PRN", city: "Priştine", country: "Kosova", group: "Balkanlar", minNights: 2, maxNights: 3, weekendOnly: true, visaSafe: true, weatherNote: "0°C altı günler elenir", tripPlan: "2–3 gece şehir · Prizren ile 3–4 gün" },
  TGD: { code: "TGD", city: "Podgoritsa", country: "Karadağ", group: "Balkanlar", minNights: 3, maxNights: 5, weekendOnly: false, visaSafe: true, weatherNote: "Sahil sezonu ayrıca değerlendirilir", tripPlan: "3–5 gün Kotor–Budva" },
  BEG: { code: "BEG", city: "Belgrad", country: "Sırbistan", group: "Balkanlar", minNights: 2, maxNights: 3, weekendOnly: true, visaSafe: true, weatherNote: "0°C altı günler elenir", tripPlan: "2–3 gece gece hayatı" },
  TUN: { code: "TUN", city: "Tunis", country: "Tunus", group: "Fas ve Kuzey Afrika", minNights: 5, maxNights: 8, weekendOnly: false, visaSafe: true, weatherNote: "35°C üzeri günler elenir", tripPlan: "5–8 gün Tunis–Sidi Bou Said–Sousse" },
  AMM: { code: "AMM", city: "Amman", country: "Ürdün", group: "Müslüman Asya", minNights: 6, maxNights: 8, weekendOnly: false, visaSafe: true, weatherNote: "Güvenlik ve aşırı sıcak ayrıca kontrol edilir", tripPlan: "6–8 gün Petra–Wadi Rum–Akabe" },
  DOH: { code: "DOH", city: "Doha", country: "Katar", group: "Müslüman Asya", minNights: 2, maxNights: 4, weekendOnly: false, visaSafe: true, weatherNote: "35°C üzeri günler elenir", tripPlan: "2–4 günlük kısa rota" },
  MCT: { code: "MCT", city: "Maskat", country: "Umman", group: "Müslüman Asya", minNights: 5, maxNights: 7, weekendOnly: false, visaSafe: false, weatherNote: "35°C üzeri günler elenir", tripPlan: "5–7 gün Maskat–Nizwa" },
  KUL: { code: "KUL", city: "Kuala Lumpur", country: "Malezya", group: "Müslüman Asya", minNights: 8, maxNights: 12, weekendOnly: false, visaSafe: true, weatherNote: "Çok yüksek nem ve muson elenir", tripPlan: "8–12 gün KL–Penang–Langkawi" },
  LGK: { code: "LGK", city: "Langkawi", country: "Malezya", group: "Müslüman Asya", minNights: 8, maxNights: 12, weekendOnly: false, visaSafe: true, weatherNote: "Deniz, nem ve muson birlikte kontrol edilir", tripPlan: "8–12 gün ada ve şehir" },
  CGK: { code: "CGK", city: "Cakarta", country: "Endonezya", group: "Müslüman Asya", minNights: 9, maxNights: 14, weekendOnly: false, visaSafe: false, weatherNote: "Çok yüksek nem ve muson elenir", tripPlan: "9–14 gün Endonezya" },
  YIA: { code: "YIA", city: "Yogyakarta", country: "Endonezya", group: "Müslüman Asya", minNights: 9, maxNights: 14, weekendOnly: false, visaSafe: false, weatherNote: "Çok yüksek nem ve muson elenir", tripPlan: "9–14 gün kültür rotası" },
  LOP: { code: "LOP", city: "Lombok", country: "Endonezya", group: "Müslüman Asya", minNights: 9, maxNights: 14, weekendOnly: false, visaSafe: false, weatherNote: "Deniz, nem ve muson birlikte kontrol edilir", tripPlan: "9–14 gün deniz ve doğa" },
  DPS: { code: "DPS", city: "Bali", country: "Endonezya", group: "Güney ve Güneydoğu Asya", minNights: 9, maxNights: 14, weekendOnly: false, visaSafe: false, weatherNote: "Deniz, nem ve muson birlikte kontrol edilir", tripPlan: "9–14 gün Bali–Lombok" },
  BKK: { code: "BKK", city: "Bangkok", country: "Tayland", group: "Güney ve Güneydoğu Asya", minNights: 8, maxNights: 12, weekendOnly: false, visaSafe: true, weatherNote: "Çok yüksek nem ve muson elenir", tripPlan: "8–12 gün Bangkok–sahil" },
  HKT: { code: "HKT", city: "Phuket", country: "Tayland", group: "Güney ve Güneydoğu Asya", minNights: 8, maxNights: 12, weekendOnly: false, visaSafe: true, weatherNote: "Deniz, nem ve muson birlikte kontrol edilir", tripPlan: "8–12 gün deniz ve gece hayatı" },
  CMB: { code: "CMB", city: "Kolombo", country: "Sri Lanka", group: "Güney ve Güneydoğu Asya", minNights: 8, maxNights: 12, weekendOnly: false, visaSafe: false, weatherNote: "İki muson dönemi ayrı kontrol edilir", tripPlan: "8–12 gün Kolombo–Kandy–Galle" },
  SIN: { code: "SIN", city: "Singapur", country: "Singapur", group: "Güney ve Güneydoğu Asya", minNights: 3, maxNights: 5, weekendOnly: false, visaSafe: true, weatherNote: "Yüksek nem uyarıyla gösterilir", tripPlan: "3–5 gün şehir veya aktarma" },
  ZNZ: { code: "ZNZ", city: "Zanzibar", country: "Tanzanya", group: "Müslüman Asya", minNights: 7, maxNights: 10, weekendOnly: false, visaSafe: false, weatherNote: "Deniz, nem ve yağmur sezonu kontrol edilir", tripPlan: "7–10 gün ada" },
  MRU: { code: "MRU", city: "Mauritius", country: "Mauritius", group: "Güney ve Güneydoğu Asya", minNights: 7, maxNights: 10, weekendOnly: false, visaSafe: true, weatherNote: "Deniz ve siklon dönemi kontrol edilir", tripPlan: "7–10 gün ada" },
  TYO: { code: "TYO", arrivalId: "HND,NRT", city: "Tokyo", country: "Japonya", group: "Uzak rotalar", minNights: 8, maxNights: 14, weekendOnly: false, visaSafe: true, weatherNote: "Aşırı sıcak, tayfun ve sert soğuk elenir", tripPlan: "8–14 gün Tokyo–Kyoto–Osaka" },
  KIX: { code: "KIX", city: "Osaka", country: "Japonya", group: "Uzak rotalar", minNights: 8, maxNights: 14, weekendOnly: false, visaSafe: true, weatherNote: "Aşırı sıcak, tayfun ve sert soğuk elenir", tripPlan: "8–14 gün Osaka–Kyoto–Tokyo" },
  ICN: { code: "ICN", city: "Seul", country: "Güney Kore", group: "Uzak rotalar", minNights: 7, maxNights: 10, weekendOnly: false, visaSafe: false, weatherNote: "Sert soğuk ve yüksek nem elenir", tripPlan: "7–10 gün Seul–Busan" },
  KSY: { code: "KSY", city: "Kars", country: "Türkiye", group: "Türkiye", minNights: 2, maxNights: 4, weekendOnly: false, visaSafe: true, weatherNote: "0°C altı günler elenir", tripPlan: "2–4 gün Kars–Ani" },
  VAN: { code: "VAN", city: "Van", country: "Türkiye", group: "Türkiye", minNights: 3, maxNights: 5, weekendOnly: false, visaSafe: true, weatherNote: "0°C altı günler elenir", tripPlan: "3–5 gün Van–Tatvan" },
  ERZ: { code: "ERZ", city: "Erzurum", country: "Türkiye", group: "Türkiye", minNights: 2, maxNights: 4, weekendOnly: false, visaSafe: true, weatherNote: "0°C altı günler elenir", tripPlan: "2–4 gün şehir ve doğa" },
  IGD: { code: "IGD", city: "Iğdır", country: "Türkiye", group: "Türkiye", minNights: 3, maxNights: 5, weekendOnly: false, visaSafe: true, weatherNote: "0°C altı günler elenir", tripPlan: "3–5 gün Doğubayazıt rotası" },
  ERC: { code: "ERC", city: "Erzincan", country: "Türkiye", group: "Türkiye", minNights: 2, maxNights: 4, weekendOnly: false, visaSafe: true, weatherNote: "0°C altı günler elenir", tripPlan: "2–4 gün şehir ve doğa" },
  EZS: { code: "EZS", city: "Elazığ", country: "Türkiye", group: "Türkiye", minNights: 3, maxNights: 5, weekendOnly: false, visaSafe: true, weatherNote: "0°C altı günler elenir", tripPlan: "3–5 gün Elazığ–Tunceli" },
};

export const CORE_DESTINATION_CODES = ["TBS", "GYD", "VAS", "CMN", "TAS", "TYO", "KIX"];
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

export function todayDestinationCodes(date = new Date()) {
  const rotating = Object.keys(DESTINATIONS).filter((code) => !CORE_DESTINATION_CODES.includes(code));
  const day = Math.floor(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()) / 86_400_000);
  const start = (day * 5) % rotating.length;
  const extras = Array.from({ length: Math.min(5, rotating.length) }, (_, index) => rotating[(start + index) % rotating.length]);
  return [...CORE_DESTINATION_CODES, ...extras];
}

const addDays = (date: Date, days: number) => {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
};
const iso = (date: Date) => date.toISOString().slice(0, 10);
function nextFriday(date: Date) {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + ((5 - result.getUTCDay() + 7) % 7));
  return result;
}

function isValidTrip(item: Record<string, unknown>, destination: Destination) {
  if (typeof item.departure !== "string" || typeof item.return !== "string") return false;
  const departure = new Date(`${item.departure}T12:00:00Z`);
  const returnDate = new Date(`${item.return}T12:00:00Z`);
  const nights = Math.round((returnDate.getTime() - departure.getTime()) / 86_400_000);
  if (nights < destination.minNights || nights > destination.maxNights) return false;
  return !destination.weekendOnly ||
    ([5, 6].includes(departure.getUTCDay()) && [0, 1].includes(returnDate.getUTCDay()));
}

async function apiGet(params: URLSearchParams) {
  const apiKey = searchApiKey();
  if (!apiKey) throw new Error("Canlı fiyat bağlantısı etkin değil");
  const response = await fetch(`https://www.searchapi.io/api/v1/search?${params.toString()}`, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Accept: "application/json",
    },
  });
  if (!response.ok) throw new Error(`Fiyat kaynağı HTTP ${response.status} döndürdü`);
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
  );
  const scored = deals.map((deal) => {
    const baseline = choosePriceBaseline(deal.nights, dailyBaselines, historyRows);
    return addScore(deal, baseline.baseline, baseline.label, baseline.historyCount, observedAt);
  });
  await Promise.all([
    saveDeals(scored),
    saveBaselines(first.destination, first.adults, dailyBaselines, observedAt),
  ]);
  return scored;
}

async function searchDestination(destination: Destination, adults: number) {
  const start = nextFriday(addDays(new Date(), 180));
  const end = addDays(start, 9);
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
    (item) => typeof item.price === "number" && isValidTrip(item, destination),
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
      .filter((item) => !item.is_split_booking)
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
    departure_id: "ESB,IST,SAW",
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
  const bookingParams = new URLSearchParams({
    engine: "google_flights",
    flight_type: "round_trip",
    departure_id: selectedOrigin,
    arrival_id: arrivalId,
    outbound_date: deal.departure,
    return_date: deal.returnDate,
    booking_token: String(inbound.booking_token),
    currency: "TRY",
    gl: "tr",
    hl: "tr",
  });
  const bookingPayload = await apiGet(bookingParams);
  const bookingOptions = Array.isArray(bookingPayload.booking_options)
    ? (bookingPayload.booking_options as Array<Record<string, unknown>>)
        .filter((item) => !item.is_split_booking)
        .sort((a, b) => Number(a.price ?? Number.MAX_SAFE_INTEGER) - Number(b.price ?? Number.MAX_SAFE_INTEGER))
    : [];
  const seller = bookingOptions[0];
  const bookingRequest = seller?.booking_request && typeof seller.booking_request === "object"
    ? seller.booking_request as Record<string, unknown>
    : undefined;
  const detailedTotal = typeof inbound.price === "number"
    ? inbound.price
    : typeof outbound.price === "number"
      ? outbound.price
      : deal.totalPriceTry;
  const verificationStatus = hasSignificantPriceChange(deal.totalPriceTry, Number(detailedTotal))
    ? "price_changed"
    : "verified";
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
    bookingPath: ticketCheckPath(deal),
    verificationStatus,
    verifiedAt: new Date().toISOString(),
    reason: verificationStatus === "verified"
      ? `Ayrıntılı doğrulandı · %${deal.opportunityPct ?? 0} fırsat`
      : "Ayrıntılı kontrolde fiyat değişti",
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
  if (!deals.length) return;
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
  return { deals: unique.slice(0, 18), errors, destinationsFound: new Set(unique.map((deal) => deal.destination)).size };
}

export async function runScan(
  destinationCodes: string[],
  adults: number,
  detailLimit = 1,
) {
  if (!searchApiKey()) throw new Error("Canlı fiyat bağlantısı etkin değil");
  const selected = destinationCodes
    .map((code) => DESTINATIONS[code])
    .filter(Boolean);
  const settled = await Promise.allSettled(
    selected.map((destination) => searchDestination(destination, adults)),
  );
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
  };
}
