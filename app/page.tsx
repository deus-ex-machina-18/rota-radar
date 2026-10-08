"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight, BadgeCheck, Bell, Bus, CalendarDays, CheckCircle2, CircleAlert, Clock3, CloudSun,
  ChevronRight, Download, ExternalLink, Gauge, Heart, LoaderCircle, Luggage, MapPin, Navigation,
  Plane, Radar, Route, Search, ShieldCheck, Ship, Sparkles, Tag, Train, UserRound, Users, WalletCards,
  Smartphone,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ticketCheckPath } from "@/lib/booking-policy";
import { scoreLeg, type DataQuality } from "@/lib/transport-engine";
import routeTemplateData from "@/data/route-templates.json";
import transportSourceData from "@/data/transport-sources.json";
import type { Destination } from "@/lib/destination-catalog";

type Deal = {
  destination: string; city: string; country: string; adults: number;
  departure: string; returnDate: string; nights: number;
  totalPriceTry: number; perPersonTry: number; origin: string;
  visaSafe: boolean; stopPolicy: string; weatherNote: string;
  reason: string; source: "live" | "pilot" | "history";
  baselinePerPersonTry?: number; baselineLabel?: string;
  opportunityPct?: number; historyCount?: number; observedAt?: string;
  airline?: string; outboundDurationMinutes?: number; returnDurationMinutes?: number;
  seller?: string; baggage?: string;
  bookingPath?: string; googleFlightsUrl?: string;
  discoverySource?: "watchlist" | "world"; tripPlan?: string;
  verificationStatus?: "verified" | "price_changed" | "detail_unavailable";
  verifiedAt?: string;
  entryNote?: string; entrySourceUrl?: string; riskNote?: string;
};

type DestinationGroup = {
  name: string;
  destinations: Destination[];
};

type DestinationCatalog = {
  groups: DestinationGroup[];
  catalogCount: number;
  flightCount: number;
  groundCount: number;
  todayWatchCount: number;
  coreCount: number;
  exclusions: string[];
};

type InstallPrompt = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };
type DealFilter = "all" | "strong";
type SortMode = "advantage" | "price" | "time";
type NavTab = "discover" | "deals" | "watch" | "profile";
type RouteTemplate = { id: string; label: string; codes: string[]; days: number[]; entry_candidates: string[]; exit_candidates: string[]; stops: string[]; optional?: string[]; preferred_modes: string[]; open_jaw: boolean };
type PlannedLeg = {
  label?: string; from?: string; to?: string; mode: string; fareTry?: number; baggageTry?: number;
  bookingFeeTry?: number; originAccessTry?: number; destinationAccessTry?: number;
  requiredAccommodationTry?: number; hotelNightSavedTry?: number; nightService?: boolean;
  durationMinutes?: number; selfTransfer?: boolean; terminalChange?: boolean; transitVisaRisk?: boolean;
  dataQuality?: DataQuality; sourceName?: string; priceLabel?: string; bookingUrl?: string;
};
type PlannedItinerary = {
  id: string; title: string; days: number; openJaw: boolean; sequence: string[];
  origin: "ESB" | "IST" | "SAW"; entry: string; exit: string; legs: PlannedLeg[];
  trueCostTry: number; fareTry: number; extrasTry: number; hotelSavingsTry: number;
  totalDurationMinutes: number; nightServices: number; dataQuality: DataQuality;
  risk: "low" | "medium" | "high"; visaStatus: "ok" | "review";
  transitVisaRisk: boolean; selfTransfer: boolean; savingsTry: number; extraMinutes: number;
  savingsPerExtraHourTry: number | null; baselineCostTry: number; baselineLabel: string;
  bookingPath: string; generatedAt: string; warnings: string[];
  originComparisons: Array<{ origin: "ESB" | "IST" | "SAW"; flightTry: number; accessTry: number; trueCostTry: number; durationMinutes: number; risk: "low" | "medium" | "high"; selected: boolean }>;
};

const initialDeals: Deal[] = [
  { destination: "TYO", city: "Tokyo", country: "Japonya", adults: 3, departure: "2027-05-08", returnDate: "2027-05-14", nights: 6, totalPriceTry: 89550, perPersonTry: 29850, origin: "ESB", visaSafe: true, stopPolicy: "1 aktarma", weatherNote: "22°C · örnek mevsim", reason: "Uzun rota için güçlü örnek fiyat", source: "pilot", opportunityPct: 32, tripPlan: "Tokyo–Kyoto–Osaka–Kyushu" },
  { destination: "SJJ", city: "Saraybosna", country: "Bosna-Hersek", adults: 3, departure: "2027-05-16", returnDate: "2027-05-19", nights: 3, totalPriceTry: 22470, perPersonTry: 7490, origin: "ESB", visaSafe: true, stopPolicy: "Direkt", weatherNote: "18°C · örnek mevsim", reason: "Hafta sonu kaçamağı", source: "pilot", opportunityPct: 18, tripPlan: "Saraybosna · Mostar ile 4–5 gün" },
  { destination: "CMN", city: "Kazablanka", country: "Fas", adults: 3, departure: "2027-03-30", returnDate: "2027-04-08", nights: 9, totalPriceTry: 38554, perPersonTry: 12851, origin: "SAW", visaSafe: true, stopPolicy: "Yalnız direkt aranır", weatherNote: "20°C · ılıman dönem", reason: "Fas uzun rota havuzunda", source: "pilot", opportunityPct: 16, tripPlan: "Kazablanka–Marakeş–Essaouira–Agadir" },
];

const money = new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY", maximumFractionDigits: 0 });
const shortDateLabel = (value: string) => new Intl.DateTimeFormat("tr-TR", { day: "numeric", month: "long" }).format(new Date(`${value}T12:00:00Z`));
const checkedDateLabel = (value?: string) => value
  ? new Intl.DateTimeFormat("tr-TR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(value))
  : "";
const balkanCodes = new Set(["SJJ", "SKP", "OHD", "TIA", "PRN", "TGD", "BEG"]);
const routeTemplates = routeTemplateData.templates as RouteTemplate[];
const transportSourceCount = transportSourceData.sources.length;

function dealArtwork(deal: Deal) {
  if (["TYO", "KIX"].includes(deal.destination)) return "/assets/tokyo-night.webp";
  if (balkanCodes.has(deal.destination)) return "/assets/sarajevo-night.webp";
  if (["CMN", "RAK", "FEZ", "RBA", "AGA", "TUN"].includes(deal.destination)) return "/assets/destinations/morocco-night.webp";
  if (["VAS", "KSY", "VAN", "ERZ", "IGD", "ERC", "EZS"].includes(deal.destination)) return "/assets/destinations/anatolia-night.webp";
  if (["KUL", "LGK", "CGK", "YIA", "LOP", "DPS", "BKK", "HKT", "CMB", "SIN"].includes(deal.destination)) return "/assets/destinations/tropical-night.webp";
  if (["AMM", "DOH", "MCT", "ZNZ", "MRU"].includes(deal.destination)) return "/assets/destinations/gulf-island-night.webp";
  if (["TBS", "GYD", "TAS", "SKD", "ALA", "NQZ", "FRU", "RMO", "ECN"].includes(deal.destination)) return "/assets/destinations/silk-road-night.webp";

  const country = deal.country.toLocaleLowerCase("tr");
  if (["japonya", "güney kore"].some((name) => country.includes(name))) return "/assets/tokyo-night.webp";
  if (["bosna", "makedonya", "arnavutluk", "kosova", "karadağ", "sırbistan"].some((name) => country.includes(name))) return "/assets/sarajevo-night.webp";
  if (["fas", "tunus"].some((name) => country.includes(name))) return "/assets/destinations/morocco-night.webp";
  if (["türkiye"].some((name) => country.includes(name))) return "/assets/destinations/anatolia-night.webp";
  if (["malezya", "endonezya", "tayland", "sri lanka", "singapur", "filipin", "vietnam", "maldiv"].some((name) => country.includes(name))) return "/assets/destinations/tropical-night.webp";
  if (["ürdün", "katar", "umman", "tanzanya", "mauritius", "bahreyn", "suudi", "emirlik"].some((name) => country.includes(name))) return "/assets/destinations/gulf-island-night.webp";
  return "/assets/destinations/silk-road-night.webp";
}

function qualityForDeal(deal: Deal): DataQuality {
  const hasBooking = Boolean(deal.bookingPath || deal.googleFlightsUrl);
  if (deal.source !== "live") return "D";
  if (deal.verificationStatus === "price_changed") return "C";
  if (deal.verificationStatus === "verified" && hasBooking) return "A";
  if (deal.source === "live" && hasBooking) return "B";
  if (deal.source === "live") return "C";
  return "D";
}

function matchingTemplate(deal: Deal) {
  return routeTemplates.find((template) => template.codes.includes(deal.destination));
}

function modeLabel(mode: string) {
  return ({
    flight: "Uçak", train: "Tren", high_speed_train: "Hızlı tren", bus: "Otobüs",
    night_bus: "Gece otobüsü", night_train: "Gece treni", night_ferry: "Gece feribotu",
    ferry: "Feribot", domestic_flight: "İç hat uçuşu", bus_ferry_combo: "Otobüs + feribot",
  } as Record<string, string>)[mode] ?? mode.replaceAll("_", " ");
}

function durationLabel(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const rest = Math.round(minutes % 60);
  return `${hours} sa ${rest} dk`;
}

function ticketUrlFor(deal: Deal) {
  return deal.bookingPath ?? deal.googleFlightsUrl ?? ticketCheckPath(deal);
}

function opensExternally(url: string) {
  return /^https:\/\//i.test(url);
}

function modeIcon(mode: string) {
  if (mode.includes("flight")) return <Plane />;
  if (mode.includes("train")) return <Train />;
  if (mode.includes("ferry")) return <Ship />;
  return <Bus />;
}

export default function Home() {
  const requestVersion = useRef(0);
  const [destination, setDestination] = useState("WORLD");
  const [adults, setAdults] = useState("3");
  const [deals, setDeals] = useState<Deal[]>(initialDeals);
  const [dealFilter, setDealFilter] = useState<DealFilter>("all");
  const [sortMode, setSortMode] = useState<SortMode>("advantage");
  const [visibleCount, setVisibleCount] = useState(8);
  const [routesOpen, setRoutesOpen] = useState(false);
  const [selectedDeal, setSelectedDeal] = useState<Deal | null>(null);
  const [itinerary, setItinerary] = useState<PlannedItinerary | null>(null);
  const [itineraryOpen, setItineraryOpen] = useState(false);
  const [plannerDealKey, setPlannerDealKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [, setMonitorLoading] = useState(false);
  const [message, setMessage] = useState("Örnek sonuçlar gösteriliyor · canlı taramayla yenile");
  const [installPrompt, setInstallPrompt] = useState<InstallPrompt | null>(null);
  const [installHelpOpen, setInstallHelpOpen] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [catalog, setCatalog] = useState<DestinationCatalog | null>(null);
  const [coverage, setCoverage] = useState({ checked: 0, discovered: 0 });
  const [activeNav, setActiveNav] = useState<NavTab>("discover");
  const [watchOpen, setWatchOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [trackedCodes, setTrackedCodes] = useState<string[]>([]);

  useEffect(() => {
    if ("serviceWorker" in navigator) void navigator.serviceWorker.register("/sw.js");
    const handler = (event: Event) => { event.preventDefault(); setInstallPrompt(event as InstallPrompt); };
    const installedHandler = () => { setIsStandalone(true); setInstallPrompt(null); };
    const standaloneNavigator = navigator as Navigator & { standalone?: boolean };
    queueMicrotask(() => setIsStandalone(window.matchMedia("(display-mode: standalone)").matches || standaloneNavigator.standalone === true));
    window.addEventListener("beforeinstallprompt", handler);
    window.addEventListener("appinstalled", installedHandler);
    void fetch("/api/destinations", { cache: "force-cache" })
      .then(async (response): Promise<DestinationCatalog | null> => response.ok ? await response.json() as DestinationCatalog : null)
      .then((payload) => { if (payload?.groups) setCatalog(payload); })
      .catch(() => undefined);
    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
      window.removeEventListener("appinstalled", installedHandler);
    };
  }, []);

  useEffect(() => {
    let savedCodes: string[] = [];
    try {
      const saved = JSON.parse(localStorage.getItem("rota-radar-tracked") ?? "[]") as unknown;
      if (Array.isArray(saved)) savedCodes = saved.filter((code): code is string => typeof code === "string");
    } catch { savedCodes = []; }
    queueMicrotask(() => setTrackedCodes(savedCodes));
  }, []);

  const toggleTracked = (code: string) => {
    setTrackedCodes((current) => {
      const next = current.includes(code) ? current.filter((item) => item !== code) : [...current, code];
      localStorage.setItem("rota-radar-tracked", JSON.stringify(next));
      return next;
    });
  };

  const goTo = (tab: Extract<NavTab, "discover" | "deals">) => {
    setActiveNav(tab);
    if (tab === "deals") setDealFilter("all");
    document.querySelector(tab === "discover" ? "#scan" : "#deals")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const destinationValues = useMemo(() => [
    "WORLD", "ALL",
    ...(catalog?.groups.flatMap((group) => group.destinations.map((item) => item.code)) ?? []),
  ], [catalog]);

  const loadCachedDeals = useCallback(async (selectedDestination = "ALL", selectedAdults = Number(adults), failureMessage?: string, version = requestVersion.current) => {
    try {
      const historyDestination = ["ALL", "WORLD"].includes(selectedDestination) ? "ALL" : selectedDestination;
      const response = await fetch(`/api/history?destination=${encodeURIComponent(historyDestination)}&adults=${selectedAdults}`, { cache: "no-store" });
      const payload = await response.json() as { deals?: Deal[]; note?: string; error?: string };
      if (!response.ok || !payload.deals?.length || version !== requestVersion.current) return null;
      setDeals(payload.deals);
      setDealFilter("all");
      setVisibleCount(12);
      setCoverage({ checked: 0, discovered: 0 });
      setMessage(failureMessage
        ? `${failureMessage} · ${payload.deals.length} eski kayıt gösteriliyor; bunlar canlı sonuç değil`
        : (payload.note ?? `${payload.deals.length} rotanın son kaydı gösteriliyor`));
      return payload.deals;
    } catch {
      return null;
    }
  }, [adults]);

  useEffect(() => {
    const version = ++requestVersion.current;
    queueMicrotask(() => {
      if (version !== requestVersion.current) return;
      setDeals([]);
      setLoading(false);
      setCoverage({ checked: 0, discovered: 0 });
      setMessage("Kaydedilmiş fiyatlar yükleniyor…");
      void loadCachedDeals("ALL", Number(adults), undefined, version).then(rows => {
        if (!rows && version === requestVersion.current) setMessage("Bu yolcu sayısı için kayıt bulunamadı · canlı taramayla başla");
      });
    });
  }, [adults, loadCachedDeals]);

  const search = useCallback(async (forcedDestination?: string, forcedAdults?: number) => {
    const version = ++requestVersion.current;
    const selectedDestination = forcedDestination ?? destination;
    const selectedAdults = forcedAdults ?? Number(adults);
    const route = catalog?.groups.flatMap((group) => group.destinations).find((item) => item.code === selectedDestination);
    if (route?.transportMode === "ground") {
      setLoading(false);
      setDestination(route.code);
      setCoverage({ checked: 0, discovered: 0 });
      setMessage(`${route.city}: otobüs/tren bağlantıları hazır. Fiyat ve ${selectedAdults} kişilik müsaitlik satıcıda kontrol edilir.`);
      document.querySelector("#deals")?.scrollIntoView({ behavior: "smooth", block: "start" });
      return { count: 0, deals: [] as Deal[] };
    }
    setLoading(true);
    setMessage("Canlı fiyatlar taranıyor…");
    try {
      const response = await fetch(`/api/flights?destination=${encodeURIComponent(selectedDestination)}&adults=${selectedAdults}`, { cache: "no-store" });
      const payload = (await response.json()) as { deals?: Deal[]; error?: string; note?: string; details?: string[]; destinationsChecked?: number };
      if (version !== requestVersion.current) return { count: 0, deals: [] as Deal[] };
      if (!response.ok || !Array.isArray(payload.deals)) throw new Error(payload.error ?? payload.details?.[0] ?? "Canlı yanıt okunamadı.");
      setDeals(payload.deals);
      setDealFilter("all");
      setVisibleCount(8);
      setMessage(payload.note ?? `${payload.deals.length} canlı uçuş bulundu`);
      setCoverage({ checked: payload.destinationsChecked ?? (selectedDestination === "WORLD" ? payload.deals.length : 1), discovered: selectedDestination === "WORLD" ? (payload.destinationsChecked ?? payload.deals.length) : 0 });
      document.querySelector("#deals")?.scrollIntoView({ behavior: "smooth", block: "start" });
      return { count: payload.deals.length, deals: payload.deals };
    } catch (error) {
      if (version !== requestVersion.current) throw error;
      const failure = error instanceof Error ? error.message : "Canlı tarama tamamlanamadı.";
      const cachedDeals = await loadCachedDeals(selectedDestination, selectedAdults, failure, version);
      if (!cachedDeals?.length && version === requestVersion.current) {
        setDeals([]);
        setCoverage({ checked: 0, discovered: 0 });
        setMessage(failure);
      }
      throw error;
    } finally {
      if (version === requestVersion.current) setLoading(false);
    }
  }, [adults, catalog, destination, loadCachedDeals]);

  const runFullMonitor = useCallback(async () => {
    const version = ++requestVersion.current;
    setMonitorLoading(true);
    setMessage("1 ve 3 kişilik rota havuzu taranıyor…");
    try {
      const response = await fetch("/api/monitor", { method: "POST", cache: "no-store" });
      const payload = (await response.json()) as {
        deals?: Deal[]; strongDeals?: Deal[]; dealsFound?: number; strongDealsFound?: number;
        errorCount?: number; status?: string; error?: string; destinationsChecked?: number;
        discoveredDestinations?: number; watchedDestinations?: number;
      };
      if (!response.ok) throw new Error(payload.error ?? "Toplu tarama tamamlanamadı.");
      if (version !== requestVersion.current) return payload;
      setDeals(payload.deals ?? []);
      setDealFilter("all");
      setVisibleCount(8);
      setCoverage({ checked: payload.destinationsChecked ?? 0, discovered: payload.discoveredDestinations ?? 0 });
      setMessage(`${payload.dealsFound ?? payload.deals?.length ?? 0} uçuş gösteriliyor · ${payload.strongDealsFound ?? payload.strongDeals?.length ?? 0} tanesi %20+ doğrulanmış fırsat${payload.errorCount ? ` · ${payload.errorCount} kontrol tamamlanamadı` : ""}`);
      document.querySelector("#deals")?.scrollIntoView({ behavior: "smooth", block: "start" });
      return payload;
    } catch (error) {
      if (version === requestVersion.current) setMessage(error instanceof Error ? error.message : "Toplu tarama tamamlanamadı.");
      throw error;
    } finally {
      setMonitorLoading(false);
    }
  }, []);

  const buildItinerary = useCallback(async (deal: Deal) => {
    const key = `${deal.destination}-${deal.departure}-${deal.returnDate}-${deal.adults}`;
    setPlannerDealKey(key);
    setMessage(`${deal.city} için ESB / IST / SAW ve karma ulaşım hesaplanıyor…`);
    try {
      const response = await fetch("/api/itineraries", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ deal }),
      });
      const payload = await response.json() as { itinerary?: PlannedItinerary; error?: string };
      if (!response.ok || !payload.itinerary) throw new Error(payload.error ?? "Ulaşım zinciri oluşturulamadı.");
      setItinerary(payload.itinerary);
      setItineraryOpen(true);
      setMessage(`${payload.itinerary.title}: en avantajlı kalkış ${payload.itinerary.origin}`);
      document.querySelector("#route-engine")?.scrollIntoView({ behavior: "smooth", block: "start" });
      return payload.itinerary;
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Ulaşım zinciri oluşturulamadı.");
      throw error;
    } finally {
      setPlannerDealKey(null);
    }
  }, []);

  useEffect(() => {
    type WebMcpDocument = Document & { modelContext?: { registerTool?: (tool: unknown, options: { signal: AbortSignal }) => void | Promise<void> } };
    const context = (document as WebMcpDocument).modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    void Promise.resolve(context.registerTool({
      name: "search_flight_deals", title: "Uçuş fırsatı tara",
      description: "Seçilen rota ve yolcu sayısı için canlı, TL bazlı uçuş fırsatlarını tarar.",
      inputSchema: { type: "object", properties: { destination: { type: "string", enum: destinationValues }, adults: { type: "integer", enum: [1, 3] } }, required: ["destination", "adults"], additionalProperties: false },
      annotations: { readOnlyHint: true, untrustedContentHint: true },
      execute: async (input: { destination: string; adults: number }) => search(input.destination, input.adults),
    }, { signal: lifecycle.signal })).catch(() => undefined);
    void Promise.resolve(context.registerTool({
      name: "run_full_flight_monitor", title: "Tüm fırsatları kontrol et",
      description: "Dünya fırsat akışını ve günün öncelikli rota grubunu tarar; tüm sonuçları ve güçlü fırsatları ayrı döndürür.",
      inputSchema: { type: "object", properties: {}, additionalProperties: false },
      annotations: { readOnlyHint: false, untrustedContentHint: true },
      execute: async () => runFullMonitor(),
    }, { signal: lifecycle.signal })).catch(() => undefined);
    void Promise.resolve(context.registerTool({
      name: "optimize_transport_itinerary", title: "Karma ulaşım rotasını optimize et",
      description: "Seçili canlı uçuş için ESB/IST/SAW, open-jaw, kara ulaşımı, gerçek maliyet ve risk karşılaştırması üretir.",
      inputSchema: { type: "object", properties: { deal: { type: "object" } }, required: ["deal"], additionalProperties: false },
      annotations: { readOnlyHint: true, untrustedContentHint: true },
      execute: async (input: { deal: Deal }) => buildItinerary(input.deal),
    }, { signal: lifecycle.signal })).catch(() => undefined);
    return () => lifecycle.abort();
  }, [buildItinerary, destinationValues, runFullMonitor, search]);

  const routeDeals = useMemo(() => deals.filter((deal) => deal.adults === Number(adults) && (["ALL", "WORLD"].includes(destination) || deal.destination === destination)), [deals, destination, adults]);
  const strongCount = useMemo(() => routeDeals.filter((deal) => (deal.opportunityPct ?? 0) >= 20 && deal.verificationStatus !== "price_changed").length, [routeDeals]);
  const filteredDeals = useMemo(() => {
    const rows = dealFilter === "strong" ? routeDeals.filter((deal) => (deal.opportunityPct ?? 0) >= 20 && deal.verificationStatus !== "price_changed") : [...routeDeals];
    return rows.sort((a, b) => {
      if (sortMode === "price") return a.perPersonTry - b.perPersonTry;
      if (sortMode === "time") return (a.outboundDurationMinutes ?? Number.MAX_SAFE_INTEGER) - (b.outboundDurationMinutes ?? Number.MAX_SAFE_INTEGER);
      return ((b.opportunityPct ?? -1) - (a.opportunityPct ?? -1)) || a.perPersonTry - b.perPersonTry;
    });
  }, [dealFilter, routeDeals, sortMode]);
  const shownDeals = filteredDeals.slice(0, visibleCount);
  const selectedRoute = catalog?.groups.flatMap((group) => group.destinations).find((item) => item.code === destination);
  const groundRoute = selectedRoute?.transportMode === "ground" ? selectedRoute : null;
  const trackedItems = trackedCodes.map((code) => {
    const deal = deals.find((item) => item.destination === code);
    const catalogItem = catalog?.groups.flatMap((group) => group.destinations).find((item) => item.code === code);
    return { code, city: deal?.city ?? catalogItem?.city ?? code, country: deal?.country ?? catalogItem?.country ?? "", transportMode: catalogItem?.transportMode, deal };
  });
  const routeCount = catalog?.catalogCount ?? "…";
  const promptInstall = async () => {
    if (!installPrompt) return;
    setInstallHelpOpen(false);
    await installPrompt.prompt();
    const choice = await installPrompt.userChoice;
    if (choice.outcome === "accepted") setIsStandalone(true);
    else setInstallHelpOpen(true);
    setInstallPrompt(null);
  };
  const install = async () => {
    if (isStandalone) return;
    if (/Android/i.test(navigator.userAgent) || !installPrompt) { setInstallHelpOpen(true); return; }
    await promptInstall();
  };
  const openInChrome = () => {
    const currentUrl = new URL(window.location.href);
    const browserFallback = encodeURIComponent(currentUrl.href);
    window.location.href = `intent://${currentUrl.host}${currentUrl.pathname}${currentUrl.search}#Intent;scheme=https;package=com.android.chrome;S.browser_fallback_url=${browserFallback};end`;
  };
  const selectedQuality = selectedDeal ? qualityForDeal(selectedDeal) : null;
  const selectedTicketUrl = selectedDeal ? ticketUrlFor(selectedDeal) : undefined;
  const selectedEvaluation = selectedDeal ? scoreLeg({
    mode: "flight",
    fareTry: selectedDeal.perPersonTry,
    durationMinutes: selectedDeal.outboundDurationMinutes,
    stops: selectedDeal.stopPolicy.toLocaleLowerCase("tr").includes("direkt") ? 0 : 1,
    dataQuality: selectedQuality ?? "D",
    visaStatus: selectedDeal.visaSafe ? "ok" : "review",
    bookingUrl: selectedTicketUrl,
  }) : null;
  const selectedTemplate = selectedDeal ? matchingTemplate(selectedDeal) : undefined;

  return (
    <main id="top" className="app-shell min-h-screen pb-28">
      <header className="night-header">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-5 sm:px-8">
          <a href="#top" className="brand-lockup" aria-label="Rota Radar ana sayfa">
            <span className="brand-mark"><Navigation className="size-5 -rotate-12" /></span>
            <span><strong>Rota <em>Radar</em></strong></span>
          </a>
          <div className="flex items-center gap-2">
            <button className="icon-button" type="button" aria-label={isStandalone ? "Rota Radar telefona yüklü" : "Rota Radar'ı telefona yükle"} disabled={isStandalone} onClick={() => void install()}><Download className="size-5" /></button>
            <button className="icon-button" type="button" aria-label="Takip edilen rotalar" onClick={() => { setActiveNav("watch"); setWatchOpen(true); }}><Bell className="size-5" /><span /></button>
            <button className="avatar" type="button" aria-label="Kullanıcı profili" onClick={() => { setActiveNav("profile"); setProfileOpen(true); }}>YT</button>
          </div>
        </div>
      </header>

      <section id="scan" className="hero-radar">
        <div className="hero-radar-overlay" />
        <div className="relative mx-auto max-w-5xl px-5 pb-7 pt-8 sm:px-8 sm:pb-10 sm:pt-12">
          <div className="max-w-3xl">
            <h1>Bir sonraki rotan<br />düşündüğünden<br /><em>daha yakın.</em></h1>
          </div>

          <div className="search-console">
            <label className="search-field">
              <Search className="size-5" />
              <span className="sr-only">Destinasyon</span>
              <Select value={destination} onValueChange={(value) => setDestination(value ?? "WORLD")}>
                <SelectTrigger className="h-12 min-w-0 flex-1 border-0 bg-transparent px-0 text-white shadow-none focus-visible:ring-0"><SelectValue /></SelectTrigger>
                <SelectContent className="max-h-[70vh]">
                  <SelectGroup><SelectLabel>Akıllı taramalar</SelectLabel><SelectItem value="WORLD">Dünyadaki ucuz rotaları keşfet</SelectItem><SelectItem value="ALL">Bugünün öncelikli rota grubu</SelectItem></SelectGroup>
                  {catalog?.groups.map((group) => <SelectGroup key={group.name}><SelectLabel>{group.name}</SelectLabel>{group.destinations.map((item) => <SelectItem key={item.code} value={item.code}>{item.city} · {item.country}</SelectItem>)}</SelectGroup>)}
                </SelectContent>
              </Select>
            </label>
            <label className="traveler-field"><Users className="size-5" /><span className="sr-only">Yolcu sayısı</span><Select value={adults} onValueChange={(value) => setAdults(value ?? "3")}><SelectTrigger className="h-12 border-0 bg-transparent px-0 text-white shadow-none focus-visible:ring-0"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="1">1 kişi</SelectItem><SelectItem value="3">3 kişi</SelectItem></SelectContent></Select></label>
            <Button className="scan-button" onClick={() => void search().catch(() => undefined)} disabled={loading}>{loading ? <LoaderCircle className="animate-spin" /> : groundRoute ? <Bus /> : <Radar />}<span>{groundRoute ? "Ulaşımı aç" : "Canlı tara"}</span></Button>
          </div>

          <div className="hero-stats">
            <button type="button" onClick={() => setRoutesOpen((value) => !value)}><MapPin /><span><strong>{routeCount}</strong><small>rota</small></span></button>
            <span><Sparkles /><span><strong>{routeDeals.length}</strong><small>sonuç</small></span></span>
            <button type="button" onClick={() => { setDealFilter("strong"); document.querySelector("#deals")?.scrollIntoView({ behavior: "smooth" }); }}><Tag /><span><strong>%20+</strong><small>indirim</small></span></button>
          </div>
        </div>
      </section>

      {routesOpen && catalog ? <section className="route-catalog mx-auto max-w-7xl px-4 sm:px-6" aria-label="Tüm rotalar">
        <div className="route-catalog-panel">
          <div className="flex items-start justify-between gap-4"><div><h2>Tüm {catalog.catalogCount} rota</h2><p>{catalog.flightCount} uçuş destinasyonu · {catalog.groundCount} kara rotası. Uçuş için canlı tara; kara rotasında ulaşım bağlantılarını aç.</p></div><button type="button" onClick={() => setRoutesOpen(false)}>Kapat</button></div>
          <div className="route-groups">{catalog.groups.map((group) => <div key={group.name}><h3>{group.name}</h3><div>{group.destinations.map((item) => <button key={item.code} type="button" onClick={() => { setDestination(item.code); setRoutesOpen(false); void search(item.code, Number(adults)).catch(() => undefined); }}><strong>{item.city}</strong><span>{item.transportMode === "ground" ? "Otobüs / tren" : item.manualOnly ? "Seçerek tara · e-vize" : item.country}</span></button>)}</div></div>)}</div>
        </div>
      </section> : null}

      <section id="deals" className="mx-auto max-w-5xl scroll-mt-24 px-5 py-7 sm:px-8 sm:py-10">
        <div className="showcase-section-head">
          <div><h2>{groundRoute ? `${groundRoute.city} ulaşımı` : "Bugünün fırsatları"}</h2><p aria-live="polite">{message}{coverage.checked ? ` · ${coverage.checked} rota kontrol edildi` : ""}</p></div>
          <button type="button" onClick={() => { setDealFilter("all"); setVisibleCount(Math.max(12, routeDeals.length)); }}>Tümünü gör <ChevronRight /></button>
        </div>

        {selectedRoute?.entryNote && !groundRoute ? <aside className="destination-notice"><ShieldCheck /><div><strong>{selectedRoute.city} · giriş koşulları</strong><p>{selectedRoute.entryNote}</p>{selectedRoute.riskNote ? <p>{selectedRoute.riskNote}</p> : null}{selectedRoute.entrySourceUrl ? <a href={selectedRoute.entrySourceUrl} target="_blank" rel="noopener noreferrer">Resmî giriş koşullarını kontrol et <ExternalLink /></a> : null}</div></aside> : null}
        {groundRoute ? <article className="ground-route-card"><div className="dialog-kicker"><Bus /> Kara rotası · satış sayfasında doğrula</div><h3>{groundRoute.city}</h3><p>{groundRoute.tripPlan}</p><p>{groundRoute.entryNote}</p><div className="ground-route-links">{groundRoute.transportLinks?.map((link) => <a key={link.url} href={link.url} target="_blank" rel="noopener noreferrer">{link.label} <ExternalLink /></a>)}</div><small>Canlı fiyat ve {adults} kişilik koltuk müsaitliği burada doğrulanmadı. Tarihi, gidiş–dönüşü ve yolcu sayısını satış sayfasında seç.</small><button type="button" className="ground-track" onClick={() => toggleTracked(groundRoute.code)}><Heart />{trackedCodes.includes(groundRoute.code) ? "Takipten çıkar" : "Rotayı takip et"}</button></article> : null}
        {!groundRoute ? <div className="compact-toolbar">
          <div className="filter-switch" aria-label="Sonuç filtresi">
            <button className={dealFilter === "all" ? "active" : ""} type="button" onClick={() => { setDealFilter("all"); setVisibleCount(8); }}>Tümü <span>{routeDeals.length}</span></button>
            <button className={dealFilter === "strong" ? "active" : ""} type="button" onClick={() => { setDealFilter("strong"); setVisibleCount(8); }}>%20+ <span>{strongCount}</span></button>
          </div>
          <div className="sort-switch" aria-label="Sonuç sıralaması">
            <button className={sortMode === "advantage" ? "active" : ""} type="button" onClick={() => setSortMode("advantage")}>Avantaj</button>
            <button className={sortMode === "price" ? "active" : ""} type="button" onClick={() => setSortMode("price")}>Fiyat</button>
            <button className={sortMode === "time" ? "active" : ""} type="button" onClick={() => setSortMode("time")}>Süre</button>
          </div>
        </div> : null}

        {groundRoute ? null : shownDeals.length ? <div className="deal-grid">{shownDeals.map((deal, index) => {
          const isStrong = (deal.opportunityPct ?? 0) >= 20 && deal.verificationStatus !== "price_changed";
          const ticketUrl = ticketUrlFor(deal);
          const quality = qualityForDeal(deal);
          const plannerKey = `${deal.destination}-${deal.departure}-${deal.returnDate}-${deal.adults}`;
          return <article key={`${deal.destination}-${deal.adults}-${deal.departure}-${deal.returnDate}-${deal.perPersonTry}`} className={`showcase-deal-card ${index === 0 ? "featured" : ""}`} style={{ backgroundImage: `url(${dealArtwork(deal)})` }}>
            <div className="showcase-card-shade" />
            <div className="showcase-card-top"><div className="deal-badges"><span className={isStrong ? "opportunity strong" : "opportunity"}>{isStrong && deal.verificationStatus !== "price_changed" ? `${deal.source === "history" ? "KAYITTA " : ""}%${deal.opportunityPct} FIRSAT` : deal.verificationStatus === "price_changed" ? "FİYAT DEĞİŞTİ" : deal.source === "live" ? "CANLI FİYAT" : deal.source === "history" ? "SON KAYIT" : "ÖRNEK FİYAT"}</span><span className={`quality-badge q${quality}`} title="Veri kalitesi">{quality}</span></div><div className="card-top-actions"><span className="weather"><CloudSun />{deal.weatherNote.split("·")[0]}</span><button className={trackedCodes.includes(deal.destination) ? "card-watch active" : "card-watch"} type="button" onClick={() => toggleTracked(deal.destination)} aria-label={trackedCodes.includes(deal.destination) ? `${deal.city} takibini kaldır` : `${deal.city} rotasını takip et`}><Heart /></button></div></div>
            <div className="showcase-card-content">
              <span className="destination-code">{deal.destination}</span>
              <h3>{deal.city}</h3>
              <p className="card-route">{deal.origin === "ESB" ? "Ankara" : deal.origin} <ArrowRight /> {deal.city}</p>
              <div className="card-date"><CalendarDays /><div><strong>{shortDateLabel(deal.departure)} – {shortDateLabel(deal.returnDate)}</strong><span>{deal.nights} gece · {deal.adults} kişi</span></div></div>
              <div className="card-chips"><span><Plane />{deal.stopPolicy}</span><span><Luggage />{deal.baggage || "Bagaj satıcıda"}</span>{deal.source === "history" && deal.observedAt ? <span className="cached"><Clock3 />{checkedDateLabel(deal.observedAt)}</span> : deal.verificationStatus === "verified" ? <span className="verified"><BadgeCheck />Doğrulandı</span> : null}</div>
              {deal.verificationStatus === "price_changed" ? <p className="deal-entry-note">Karttaki tutar eski fiyat; bilet kontrolünde güncel fiyat gösterilir.</p> : null}
              {deal.riskNote || deal.entryNote ? <p className="deal-entry-note">{deal.riskNote ?? deal.entryNote}</p> : null}
              <div className="showcase-card-footer">
                <div className="showcase-price"><strong>{money.format(deal.perPersonTry)}</strong><em>/ kişi</em><small>{money.format(deal.totalPriceTry)} toplam ({deal.adults} kişi)</small></div>
                <div className="showcase-actions">
                  <button className="engine-quick" type="button" disabled={plannerDealKey === plannerKey} onClick={() => void buildItinerary(deal).catch(() => undefined)}>{plannerDealKey === plannerKey ? <LoaderCircle className="animate-spin" /> : <Route />}<span>Rota motoru</span></button>
                  <button className="cost-quick" type="button" onClick={() => setSelectedDeal(deal)} aria-label="Maliyet detayını aç"><WalletCards /></button>
                  <a className="primary-ticket" href={ticketUrl} target={opensExternally(ticketUrl) ? "_blank" : undefined} rel={opensExternally(ticketUrl) ? "noopener noreferrer" : undefined}>Bileti kontrol et <ChevronRight /></a>
                </div>
              </div>
            </div>
          </article>;
        })}</div> : <div className="empty-state"><Tag /><h3>{routeDeals.length ? "Bu filtrede güçlü fırsat yok." : "Gösterilecek uçuş bulunamadı."}</h3><p>{routeDeals.length ? "Diğer fiyatlar için tüm sonuçları aç." : "Tarama durumu yukarıda. Başka bir rota seçerek yeniden tarayabilirsin."}</p>{routeDeals.length ? <Button onClick={() => setDealFilter("all")}>Tüm sonuçları göster</Button> : null}</div>}

        {shownDeals.length < filteredDeals.length ? <div className="show-more"><Button variant="outline" onClick={() => setVisibleCount((value) => value + 12)}>Daha fazla uçuş göster <span>{filteredDeals.length - shownDeals.length} sonuç kaldı</span></Button></div> : null}

        <div className="status-row">
          <span><BadgeCheck />Bordo pasaport</span><span><ShieldCheck />Schengen yok · self-transfer kapalı</span><span><MapPin />ESB · IST · SAW</span>
        </div>

        <section id="route-engine" className="journey-planner scroll-mt-24" aria-labelledby="planner-title">
          <div className="planner-heading"><div><span className="eyebrow dark"><Route className="size-4" /> Uzun tatil optimizasyonu</span><h2 id="planner-title">Bir şehre in, başka şehirden dön.</h2><p>Fas, Japonya, Türk dünyası ve Güneydoğu Asya için uçuş sonrası şehir sırası, gece ulaşımı ve open-jaw dönüş planları hazır.</p></div><span>{routeTemplates.length} rota şablonu · {transportSourceCount} kaynak adayı</span></div>
          {itinerary ? <article className="engine-result" onClick={() => setItineraryOpen(true)}>
            <div className="engine-result-head"><div><span>{itinerary.openJaw ? "OPEN-JAW · " : "GİDİŞ-DÖNÜŞ · "}{itinerary.days} GÜN</span><h3>{itinerary.title}</h3><p>{itinerary.sequence.join(" → ")}</p></div><strong>{money.format(itinerary.trueCostTry)}<small>/ kişi gerçek ulaşım</small></strong></div>
            <div className="engine-result-metrics"><span><Tag /><strong>{itinerary.savingsTry >= 0 ? money.format(itinerary.savingsTry) : money.format(Math.abs(itinerary.savingsTry))}</strong><small>{itinerary.savingsTry >= 0 ? "klasiğe göre avantaj" : "klasikten pahalı"}</small></span><span><Clock3 /><strong>{durationLabel(itinerary.totalDurationMinutes)}</strong><small>kapıdan kapıya ulaşım</small></span><span><Train /><strong>{itinerary.nightServices} gece</strong><small>{money.format(itinerary.hotelSavingsTry)} otel tasarrufu</small></span><span><Gauge /><strong>{itinerary.origin}</strong><small>en avantajlı kalkış</small></span></div>
            <div className="engine-result-checks"><span className={itinerary.visaStatus === "ok" ? "ok" : "warn"}><ShieldCheck />{itinerary.visaStatus === "ok" ? "Bordo pasaporta uygun" : "Vize kontrolü gerekli"}</span><span className={!itinerary.selfTransfer ? "ok" : "warn"}><BadgeCheck />{itinerary.selfTransfer ? "Self-transfer riski" : "Self-transfer yok"}</span><span className={itinerary.dataQuality === "A" ? "ok" : "warn"}><Radar />Uçuş canlı · rota verisi {itinerary.dataQuality}</span><button type="button">Rotayı aç <ArrowRight /></button></div>
          </article> : <div className="engine-empty"><Route /><div><strong>Önce bir uçuş seç.</strong><span>Uçuş kartındaki “Tüm ulaşımı hesapla” düğmesi ESB/IST/SAW, open-jaw ve kara etaplarını tek sonuçta karşılaştırır.</span></div></div>}
          <div className="template-strip">{routeTemplates.map((template) => <article key={template.id} className="template-card"><div><span>{template.days[0]}–{template.days[1]} gün</span>{template.open_jaw ? <em>Open-jaw</em> : <em>Gidiş-dönüş</em>}</div><h3>{template.label}</h3><p>{template.stops.join(" → ")}</p><footer>{template.preferred_modes.slice(0, 3).map((mode) => <span key={mode}>{modeLabel(mode)}</span>)}</footer></article>)}</div>
          <div className="quality-legend"><div><strong className="quality-badge qA">A</strong><span>Canlı fiyat + müsaitlik + satın alma</span></div><div><strong className="quality-badge qB">B</strong><span>Canlı sefer + fiyat</span></div><div><strong className="quality-badge qC">C</strong><span>Resmî tarife / yaklaşık fiyat</span></div><div><strong className="quality-badge qD">D</strong><span>Araştırma sinyali</span></div></div>
        </section>

        <aside className="purchase-note"><Bell /><p><strong>Satın alma yönlendirmesi hazır.</strong> Fiyat, tıklama anında tekrar kontrol edilir; ödeme havayolu veya güvenilir satıcı sayfasında tamamlanır.</p></aside>
      </section>

      <Dialog open={Boolean(selectedDeal)} onOpenChange={(open) => { if (!open) setSelectedDeal(null); }}>
        <DialogContent className="cost-dialog max-h-[88vh] overflow-y-auto sm:max-w-2xl">
          {selectedDeal ? <>
            <DialogHeader><div className="dialog-kicker"><WalletCards /> Gerçek seyahat maliyeti</div><DialogTitle>{selectedDeal.city} · {money.format(selectedDeal.perPersonTry)} / kişi</DialogTitle><DialogDescription>Bilet fiyatını gizli ek maliyetlerle karıştırmadan gösteriyoruz; bilinmeyen kalemleri uydurmuyoruz.</DialogDescription></DialogHeader>
            <div className="cost-breakdown"><span>Canlı/örnek uçuş fiyatı</span><strong>{money.format(selectedDeal.perPersonTry)}</strong><span>Bagaj maliyeti</span><strong>{selectedDeal.baggage ? selectedDeal.baggage : "Satıcıda kontrol edilecek"}</strong><span>Havalimanı ve terminal erişimi</span><strong>Henüz fiyatlanmadı</strong><span>Rezervasyon ücreti</span><strong>Henüz fiyatlanmadı</strong><span className="total">Şu an doğrulanabilen alt toplam</span><strong className="total">{money.format(selectedEvaluation?.trueCostTry ?? selectedDeal.perPersonTry)}</strong></div>
            <div className="policy-checks"><span><ShieldCheck />Schengen girişli rota gösterilmez</span><span><CheckCircle2 />Ayrı biletli self-transfer kapalı</span><span><Plane />Uçuşta en fazla 1 aktarma</span><span><BadgeCheck />Veri kalitesi: {selectedQuality}</span></div>
            {selectedTemplate ? <div className="matched-template"><span>Bu uçuşla uyumlu rota</span><h3>{selectedTemplate.label}</h3><p>{selectedTemplate.stops.join(" → ")}</p><div>{selectedTemplate.preferred_modes.map((mode) => <span key={mode}>{modeLabel(mode)}</span>)}</div></div> : null}
            <p className="dialog-note">Gece treni/otobüsü veya feribot eklendiğinde kurtarılan otel gecesi maliyetten düşülecek. Partner kaynak bağlı değilse rakam yerine “henüz fiyatlanmadı” gösterilir.</p>
            {selectedTicketUrl ? <a className="dialog-book" href={selectedTicketUrl} target={opensExternally(selectedTicketUrl) ? "_blank" : undefined} rel={opensExternally(selectedTicketUrl) ? "noopener noreferrer" : undefined}>Fiyatı satıcıda doğrula <ExternalLink /></a> : null}
          </> : null}
        </DialogContent>
      </Dialog>

      <Dialog open={itineraryOpen} onOpenChange={setItineraryOpen}>
        <DialogContent className="itinerary-dialog max-h-[92vh] overflow-y-auto sm:max-w-3xl">
          {itinerary ? <>
            <DialogHeader><div className="dialog-kicker"><Route /> Ulaşım motoru sonucu</div><DialogTitle>{itinerary.title} · {itinerary.days} gün</DialogTitle><DialogDescription>{itinerary.origin} kalkışlı {itinerary.openJaw ? `${itinerary.entry} giriş / ${itinerary.exit} dönüş` : "gidiş-dönüş"}. Uçuş canlı; kara etaplarının veri kalitesi her satırda ayrı.</DialogDescription></DialogHeader>

            <div className="itinerary-hero">
              <div><span>GERÇEK ULAŞIM MALİYETİ</span><strong>{money.format(itinerary.trueCostTry)} <small>/ kişi</small></strong><p>{itinerary.savingsTry >= 0 ? `${money.format(itinerary.savingsTry)} avantaj` : `${money.format(Math.abs(itinerary.savingsTry))} daha pahalı`} · {durationLabel(itinerary.totalDurationMinutes)}</p></div>
              <div className={`risk-chip ${itinerary.risk}`}>{itinerary.risk === "low" ? "Düşük risk" : itinerary.risk === "medium" ? "Orta risk" : "Yüksek risk"}</div>
            </div>

            <div className="itinerary-sequence">{itinerary.legs.map((leg, index) => <div key={`${leg.label}-${index}`} className="itinerary-leg">
              <span className="leg-icon">{modeIcon(leg.mode)}</span>
              <div><strong>{leg.label ?? `${leg.from} → ${leg.to}`}</strong><small>{modeLabel(leg.mode)} · {durationLabel(Number(leg.durationMinutes ?? 0))} · {leg.sourceName ?? "Kaynak belirtilmedi"}</small>{leg.nightService ? <em>Gece yolculuğu · {money.format(Number(leg.hotelNightSavedTry ?? 0))} otel tasarrufu</em> : null}</div>
              <div className="leg-price"><strong>{money.format(Number(leg.fareTry ?? 0) + Number(leg.baggageTry ?? 0) + Number(leg.originAccessTry ?? 0) + Number(leg.destinationAccessTry ?? 0))}</strong><small className={`qtext q${leg.dataQuality ?? "D"}`}>{leg.priceLabel ?? "Tahmini"} · {leg.dataQuality ?? "D"}</small>{leg.bookingUrl ? <a href={leg.bookingUrl} target="_blank" rel="noopener noreferrer" aria-label={`${leg.label} biletini aç`}><ExternalLink /></a> : null}</div>
            </div>)}</div>

            <div className="itinerary-breakdown"><span>Ulaşım + bilet</span><strong>{money.format(itinerary.fareTry)}</strong><span>Erişim, bagaj ve zorunlu ekler</span><strong>{money.format(itinerary.extrasTry)}</strong><span>Gece yolculuğuyla kurtarılan otel</span><strong>− {money.format(itinerary.hotelSavingsTry)}</strong><span className="total">Net gerçek maliyet</span><strong className="total">{money.format(itinerary.trueCostTry)}</strong></div>

            <section className="origin-comparison"><h3>ESB / IST / SAW karşılaştırması</h3><div>{itinerary.originComparisons.map((row) => <article className={row.selected ? "selected" : ""} key={row.origin}><span>{row.origin}{row.selected ? " · seçildi" : ""}</span><strong>{money.format(row.trueCostTry)}</strong><small>Uçuş {money.format(row.flightTry)} + Ankara erişimi {money.format(row.accessTry)}</small><em>{durationLabel(row.durationMinutes)} · {row.risk === "low" ? "düşük" : row.risk === "medium" ? "orta" : "yüksek"} risk</em></article>)}</div></section>

            <div className="tradeoff-box"><Tag /><div><strong>{itinerary.savingsTry >= 0 ? `${money.format(itinerary.savingsTry)} tasarruf` : `${money.format(Math.abs(itinerary.savingsTry))} ek maliyet`}</strong><p>{itinerary.extraMinutes > 0 ? `Klasik seçeneğe göre +${durationLabel(itinerary.extraMinutes)} yolculuk.` : `Klasik seçeneğe göre ${durationLabel(Math.abs(itinerary.extraMinutes))} daha kısa.`}{itinerary.savingsPerExtraHourTry ? ` Ek saatin karşılığı ${money.format(itinerary.savingsPerExtraHourTry)}.` : ""}</p><small>{itinerary.baselineLabel}: {money.format(itinerary.baselineCostTry)}</small></div></div>

            <div className="policy-checks"><span><ShieldCheck />{itinerary.visaStatus === "ok" ? "Bordo pasaport profiline uygun" : "Giriş şartı ayrıca doğrulanmalı"}</span><span>{itinerary.selfTransfer ? <CircleAlert /> : <CheckCircle2 />}{itinerary.selfTransfer ? "Self-transfer riski var" : "Ayrı bilet/self-transfer yok"}</span><span>{itinerary.transitVisaRisk ? <CircleAlert /> : <CheckCircle2 />}{itinerary.transitVisaRisk ? "Transit vize riski kontrol edilmeli" : "Bilinen transit vize riski yok"}</span><span><BadgeCheck />Canlı uçuş + {itinerary.dataQuality} kalite rota verisi</span></div>
            {itinerary.warnings.length ? <div className="itinerary-warnings">{itinerary.warnings.map((warning) => <p key={warning}><CircleAlert />{warning}</p>)}</div> : null}
            <a className="dialog-book" href={itinerary.bookingPath} target={opensExternally(itinerary.bookingPath) ? "_blank" : undefined} rel={opensExternally(itinerary.bookingPath) ? "noopener noreferrer" : undefined}>Bu fiyata git · uçuşu yeniden doğrula <ExternalLink /></a>
          </> : null}
        </DialogContent>
      </Dialog>

      <Dialog open={watchOpen} onOpenChange={(open) => { setWatchOpen(open); if (!open) setActiveNav("discover"); }}>
        <DialogContent className="nav-dialog sm:max-w-lg">
          <DialogHeader><div className="dialog-kicker"><Heart /> Takip</div><DialogTitle>Takip edilen rotalar</DialogTitle><DialogDescription>Kalp simgesine bastığın şehirleri burada saklıyoruz. Her rotayı ayrı canlı tarayarak kredi tüketimini kontrol altında tutabilirsin.</DialogDescription></DialogHeader>
          {trackedItems.length ? <div className="tracked-list">{trackedItems.map((item) => <article key={item.code}><div><strong>{item.city}</strong><span>{item.country || item.code}</span></div><button type="button" onClick={() => { setWatchOpen(false); setDestination(item.code); void search(item.code, Number(adults)).catch(() => undefined); }}>{item.transportMode === "ground" ? "Ulaşımı aç" : "Canlı tara"} <Radar /></button><button className="tracked-remove" type="button" onClick={() => toggleTracked(item.code)} aria-label={`${item.city} takibini kaldır`}><Heart /></button></article>)}</div> : <div className="nav-empty"><Heart /><strong>Henüz takip edilen rota yok.</strong><span>Fırsat kartlarındaki kalbe dokunarak şehir ekleyebilirsin.</span></div>}
        </DialogContent>
      </Dialog>

      <Dialog open={profileOpen} onOpenChange={(open) => { setProfileOpen(open); if (!open) setActiveNav("discover"); }}>
        <DialogContent className="nav-dialog sm:max-w-lg">
          <DialogHeader><div className="dialog-kicker"><UserRound /> Profil</div><DialogTitle>Seyahat tercihlerin</DialogTitle><DialogDescription>Canlı taramalar bu temel kurallarla hazırlanıyor.</DialogDescription></DialogHeader>
          <div className="profile-summary"><span><strong>Kalkış</strong>ESB · IST · SAW</span><span><strong>Yolcu</strong>{adults} kişi</span><span><strong>Vize</strong>Bordo pasaport · Schengen hariç</span><span><strong>Bütçe</strong>Yurt dışı kişi başı 50.000 TL</span><span><strong>Bagaj</strong>Ek maliyet olarak göster</span><span><strong>Aktarma</strong>En fazla 1 · self-transfer kapalı</span></div>
          <div className="profile-actions"><Button variant="outline" onClick={() => { setProfileOpen(false); setRoutesOpen(true); goTo("discover"); }}>Tüm rotaları aç</Button><Button onClick={() => void install()} disabled={isStandalone}>{isStandalone ? "Telefona yüklendi" : "Android'e yükle"}</Button><span>{isStandalone ? "Rota Radar uygulama olarak çalışıyor." : "Kurulum penceresi açılmazsa adımları göstereceğiz."}</span></div>
        </DialogContent>
      </Dialog>

      <Dialog open={installHelpOpen} onOpenChange={setInstallHelpOpen}>
        <DialogContent className="nav-dialog sm:max-w-md">
          <DialogHeader><div className="dialog-kicker"><Smartphone /> Android kurulumu</div><DialogTitle>Önce tam Chrome&apos;da aç</DialogTitle><DialogDescription>Ekranın üstünde X işareti varsa ChatGPT&apos;nin uygulama içi sekmesindesin; Android bu ekrandan uygulama kurmaz.</DialogDescription></DialogHeader>
          <div className="install-choice-actions">
            <Button className="open-chrome-button" type="button" onClick={openInChrome}><ExternalLink /> Chrome&apos;da aç</Button>
            {installPrompt ? <Button variant="outline" type="button" onClick={() => void promptInstall()}><Download /> Zaten Chrome&apos;dayım, yükle</Button> : null}
          </div>
          <ol className="install-steps">
            <li><span>1</span><div><strong>Yukarıdaki düğmeye dokun</strong><small>Sayfa uygulama içi sekmeden çıkar ve doğrudan Chrome&apos;da açılır.</small></div></li>
            <li><span>2</span><div><strong>Chrome&apos;daki ⋮ menüsünü aç</strong><small>“Uygulamayı yükle” veya “Ana ekrana ekle” seçeneğini seç.</small></div></li>
            <li><span>3</span><div><strong>Yükle&apos;ye dokun</strong><small>Rota Radar uygulama simgesiyle ana ekrana eklenir ve tam ekran açılır.</small></div></li>
          </ol>
        </DialogContent>
      </Dialog>

      <nav className="mobile-nav" aria-label="Uygulama menüsü">
        <button className={activeNav === "discover" ? "active" : ""} type="button" onClick={() => goTo("discover")}><Navigation /><span>Keşfet</span></button><button className={activeNav === "deals" ? "active" : ""} type="button" onClick={() => goTo("deals")}><Tag /><span>Fırsatlar</span></button><button className={activeNav === "watch" ? "active" : ""} type="button" onClick={() => { setActiveNav("watch"); setWatchOpen(true); }}><Heart /><span>Takip{trackedCodes.length ? ` (${trackedCodes.length})` : ""}</span></button><button className={activeNav === "profile" ? "active" : ""} type="button" onClick={() => { setActiveNav("profile"); setProfileOpen(true); }}><UserRound /><span>Profil</span></button>
      </nav>
    </main>
  );
}
