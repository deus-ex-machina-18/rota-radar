import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { chooseFlightOption } from "../lib/flight-option-selector.ts";
import { hasSignificantPriceChange, ticketCheckPath, trustedGoogleUrl } from "../lib/booking-policy.ts";
import { choosePriceBaseline, summarizeCalendarPrices } from "../lib/price-baseline.ts";
import { flightSearchPolicy } from "../lib/flight-search-policy.ts";
import { matchesProfileEntry } from "../lib/route-profile-policy.ts";
import { riskLevel, trueLegCost } from "../lib/transport-engine.ts";

const token = "token";
const payload = {
  best_flights: [
    {
      price: 1000,
      flights: [{}],
      departure_token: token,
      is_self_transfer: true,
    },
    {
      price: 1250,
      flights: [{}],
      departure_token: token,
    },
  ],
};

assert.equal(
  chooseFlightOption(payload, "departure_token").price,
  1250,
  "En ucuz self-transfer yerine uygun normal uçuş seçilmeli",
);
assert.equal(trustedGoogleUrl("https://www.google.com/travel/flights"), "https://www.google.com/travel/flights");
assert.equal(trustedGoogleUrl("https://evil.example/steal"), undefined, "Satıcı POST'u izin verilmeyen alan adına gönderilmemeli");
assert.equal(trustedGoogleUrl("https://notgoogle.com/steal"), undefined, "Benzer alan adı Google sayılmamalı");
assert.equal(hasSignificantPriceChange(10_000, 11_000), false, "%10 değişim uyarı eşiğini aşmamalı");
assert.equal(hasSignificantPriceChange(10_000, 11_001), true, "%10 üzeri değişim kullanıcıya gösterilmeli");
assert.equal(
  ticketCheckPath({ destination: "TYO", adults: 3, departure: "2027-05-08", returnDate: "2027-05-14", totalPriceTry: 89_550 }),
  "/api/book?destination=TYO&adults=3&departure=2027-05-08&return=2027-05-14&price=89550",
  "Bağlantısız örnek kart da dahili bilet kontrol sayfası üretmeli",
);
assert.deepEqual(flightSearchPolicy("CMN"), { stops: "nonstop", label: "Yalnız direkt" });
assert.deepEqual(flightSearchPolicy("TYO"), { stops: "one_stop_or_fewer", label: "En fazla 1 aktarma" });
assert.equal(
  riskLevel({ mode: "train", dataQuality: "C", visaStatus: "ok" }),
  "low",
  "Veri kalitesi C operasyonel riski yükseltmemeli",
);
assert.equal(
  riskLevel({ mode: "flight", terminalChange: true, connectionMinutes: 0 }),
  "high",
  "Sıfır dakikalık terminal değişimi yüksek risk olmalı",
);
assert.equal(
  trueLegCost({
    mode: "domestic_flight",
    fareTry: 2300,
    baggageTry: 700,
    destinationAccessTry: 450,
    nightService: true,
    hotelNightSavedTry: 1200,
  }),
  2250,
  "Baz rota bagaj ve erişimi ekleyip otel tasarrufunu düşmeli",
);
assert.equal(matchesProfileEntry("CMN", "CMN"), true);
assert.equal(matchesProfileEntry("TYO", "NRT"), true);
assert.equal(matchesProfileEntry("RAK", "CMN"), false, "RAK fiyatı CMN profiline zorlanmamalı");
assert.equal(matchesProfileEntry("KIX", "NRT"), false, "KIX fiyatı NRT profiline zorlanmamalı");

const currentBaselines = summarizeCalendarPrices([
  { nights: 7, perPersonTry: 9800 },
  { nights: 8, perPersonTry: 9000 },
  { nights: 8, perPersonTry: 10_000 },
  { nights: 8, perPersonTry: 11_000 },
  { nights: 9, perPersonTry: 10_200 },
]);
const stableBaseline = choosePriceBaseline(8, currentBaselines, [
  { nights: 8, medianPerPersonTry: 9900, sampleCount: 12, observedDay: "2026-09-25" },
  { nights: 8, medianPerPersonTry: 10_100, sampleCount: 14, observedDay: "2026-09-26" },
  { nights: 8, medianPerPersonTry: 10_000, sampleCount: 11, observedDay: "2026-09-27" },
]);
assert.equal(stableBaseline.label, "30 günlük takvim medyanı");
assert.equal(stableBaseline.historyCount, 3);
assert.ok((stableBaseline.baseline ?? 0) >= 9900, "Baz, geçmiş en ucuz fiyatlara çökmemeli");

const routeProfiles = JSON.parse(readFileSync(new URL("../data/route-templates.json", import.meta.url), "utf8"));
const morocco = routeProfiles.templates.find((item) => item.id === "morocco_atlantic");
const japan = routeProfiles.templates.find((item) => item.id === "japan_golden");
assert.deepEqual(morocco.stops, ["Kazablanka", "Marakeş", "Essaouira", "Agadir"]);
assert.deepEqual(japan.stops, ["Tokyo", "Kyoto", "Osaka", "Beppu", "Fukuoka"]);
assert.equal(morocco.startCity, morocco.stops[0], "Arayüz ve motor aynı Fas başlangıcını kullanmalı");
assert.equal(japan.endCity, japan.stops.at(-1), "Arayüz ve motor aynı Japonya bitişini kullanmalı");

console.log("Çekirdek regresyon kontrolleri geçti.");
