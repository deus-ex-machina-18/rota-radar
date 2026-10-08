import { createBookingHandoff, DESTINATIONS, type Deal } from "@/lib/flight-monitor";
import { validTravelDates } from "@/lib/search-window";
import { trustedGoogleUrl, routeSearchUrl } from "@/lib/booking-policy";
import { flightSearchPolicy } from "@/lib/flight-search-policy";

export const dynamic = "force-dynamic";

const escapeHtml = (value: string) => value
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&#039;");

function page(title: string, body: string, autoSubmit = false) {
  return `<!doctype html><html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)}</title><style>body{margin:0;background:#07182d;color:#fff;font-family:system-ui,-apple-system,sans-serif}.shell{min-height:100vh;display:grid;place-items:center;padding:24px}.card{width:min(520px,100%);background:#fff;color:#0f172a;border-radius:20px;padding:28px;box-shadow:0 24px 80px #0006}.mark{display:grid;place-items:center;width:48px;height:48px;border-radius:14px;background:#ffb547;color:#07182d;font-size:24px}h1{font-size:24px;margin:18px 0 8px}p{line-height:1.6;color:#475569}.price{font-size:28px;font-weight:900;color:#0f172a}.actions{display:flex;gap:10px;flex-wrap:wrap;margin-top:22px}button,a{border:0;border-radius:12px;padding:13px 17px;font-weight:800;text-decoration:none;cursor:pointer}.primary{background:#ffb547;color:#07182d}.secondary{background:#e2e8f0;color:#0f172a}.small{font-size:12px;color:#64748b;margin-top:16px}</style></head><body><main class="shell"><section class="card"><div class="mark">✈</div>${body}</section></main>${autoSubmit ? '<script>setTimeout(()=>document.getElementById("booking-form")?.submit(),1200)</script>' : ""}</body></html>`;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = (url.searchParams.get("destination") || "").toUpperCase();
  const adults = Number(url.searchParams.get("adults"));
  const departure = url.searchParams.get("departure") || "";
  const returnDate = url.searchParams.get("return") || "";
  const origin = url.searchParams.get("origin") || "ESB / IST / SAW";
  const oldPrice = Number(url.searchParams.get("price"));
  if (!/^[A-Z]{3}$/.test(code) || ![1, 3].includes(adults) || !validTravelDates(departure, returnDate) || !["ESB", "IST", "SAW", "ESB / IST / SAW"].includes(origin) || !Number.isFinite(oldPrice) || oldPrice <= 0) {
    return new Response(page("Geçersiz bilet bağlantısı", "<h1>Bağlantı geçersiz</h1><p>Fırsatı uygulamadan yeniden açıp tekrar dene.</p><div class=\"actions\"><a class=\"secondary\" href=\"/\">Rota Radar’a dön</a></div>"), { status: 400, headers: { "content-type": "text/html; charset=utf-8" } });
  }

  const destination = DESTINATIONS[code];
  const nights = Math.round((new Date(`${returnDate}T12:00:00Z`).getTime() - new Date(`${departure}T12:00:00Z`).getTime()) / 86_400_000);
  const deal: Deal = {
    destination: code,
    city: destination?.city ?? code,
    country: destination?.country ?? "",
    adults,
    departure,
    returnDate,
    nights,
    totalPriceTry: Math.round(oldPrice),
    perPersonTry: Math.round(oldPrice / adults),
    origin,
    visaSafe: destination?.visaSafe ?? false,
    stopPolicy: flightSearchPolicy(code).label,
    weatherNote: destination?.weatherNote ?? "Mevsim kontrolü gerekli",
    tripPlan: destination?.tripPlan,
    reason: "Satın alma öncesi yeniden doğrulanıyor",
    source: "live",
  };

  try {
    const handoff = await createBookingHandoff(deal);
    const action = trustedGoogleUrl(handoff.url);
    const fallback = trustedGoogleUrl(handoff.fallbackUrl);
    if (!action || !handoff.postData) {
      const target = fallback ?? routeSearchUrl(deal);
      return new Response(page("Satıcı bağlantısı doğrulanamadı", `<h1>Satıcı bağlantısı doğrulanamadı</h1><p>${escapeHtml(origin)} → ${escapeHtml(deal.city)} · ${escapeHtml(departure)}–${escapeHtml(returnDate)} · ${adults} kişi. Uçuş kontrolündeki toplam: ${escapeHtml(String(handoff.currentTotalPriceTry))} TL. Satıcı fiyatını ayrıca kontrol et.</p><div class="actions"><a class="primary" href="${escapeHtml(target)}" target="_blank" rel="noopener noreferrer">Rotayı Google’da kontrol et</a><a class="secondary" href="/">Rota Radar’a dön</a></div>`), { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } });
    }
    const fields = [...new URLSearchParams(handoff.postData)].map(([name, value]) =>
      `<input type="hidden" name="${escapeHtml(name)}" value="${escapeHtml(value)}">`,
    ).join("");
    const oldLabel = new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY", maximumFractionDigits: 0 }).format(oldPrice);
    const newLabel = new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY", maximumFractionDigits: 0 }).format(handoff.currentTotalPriceTry);
    const changed = Math.round(oldPrice) !== handoff.currentTotalPriceTry;
    const routeLabel = `<p>${escapeHtml(handoff.verified.origin)} → ${escapeHtml(deal.city)} · ${escapeHtml(departure)}–${escapeHtml(returnDate)} · ${adults} kişi</p>`;
    const body = routeLabel + (changed
      ? `<h1>Fiyat değişti</h1><p>İlk gördüğün toplam fiyat <strong>${escapeHtml(oldLabel)}</strong>, güncel toplam fiyat <strong>${escapeHtml(newLabel)}</strong>. Devam edersen ${escapeHtml(handoff.seller ?? "satıcı")} sayfasına gideceksin.</p><form id="booking-form" method="post" action="${escapeHtml(action)}">${fields}<div class="actions"><button class="primary" type="submit">Yeni fiyatla devam et</button><a class="secondary" href="/">Vazgeç</a></div></form>`
      : `<h1>Bilet yeniden doğrulandı</h1><p>${escapeHtml(handoff.seller ?? "Satıcı")} sayfasına yönlendiriliyorsun.</p><div class="price">${escapeHtml(newLabel)}</div><form id="booking-form" method="post" action="${escapeHtml(action)}">${fields}<div class="actions"><button class="primary" type="submit">Şimdi satıcıya git</button><a class="secondary" href="/">Vazgeç</a></div></form><p class="small">Satın alma işlemi Rota Radar’da yapılmaz; son fiyat ve koşullar satıcının sayfasında geçerlidir.</p>`);
    return new Response(page(changed ? "Fiyat değişti" : "Bilet doğrulandı", body, !changed), { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Bilet bağlantısı hazırlanamadı";
    const oldLabel = new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY", maximumFractionDigits: 0 }).format(oldPrice);
    const providerLimited = message.includes("429");
    const heading = providerLimited ? "Canlı fiyat kaynağı geçici olarak sınırlı" : "Fiyat doğrulanamadı";
    const explanation = providerLimited
      ? `Kartta gördüğün <strong>${escapeHtml(oldLabel)}</strong> toplam fiyat henüz yeniden doğrulanamadı. Bu fiyatı kesin kabul etmeden Google Flights üzerinde kontrol et.`
      : `${escapeHtml(message)} Kartta gördüğün toplam fiyat <strong>${escapeHtml(oldLabel)}</strong>.`;
    const body = `<h1>${heading}</h1><p>${explanation}</p><div class="actions"><a class="primary" href="${escapeHtml(routeSearchUrl(deal))}" target="_blank" rel="noopener noreferrer">Rotayı Google’da kontrol et</a><a class="secondary" href="/">Rota Radar’a dön</a></div><p class="small">Ödeme Rota Radar’da yapılmaz; geçerli fiyat ve koşullar satıcının ekranındadır.</p>`;
    return new Response(page(heading, body), { status: 503, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } });
  }
}
