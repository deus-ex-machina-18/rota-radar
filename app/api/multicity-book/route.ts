import { validTravelDates } from "@/lib/search-window";
import { createOpenJawBookingHandoff } from "@/lib/flight-monitor";
import { hasSignificantPriceChange, trustedGoogleUrl } from "@/lib/booking-policy";

export const dynamic = "force-dynamic";

const airport = /^[A-Z]{3}$/;
const escapeHtml = (value: string) => value
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&#039;");

function page(body: string) {
  return `<!doctype html><html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Open-jaw bilet doğrulama</title><style>body{margin:0;background:#061827;color:#fff;font-family:system-ui,-apple-system,sans-serif}.shell{min-height:100vh;display:grid;place-items:center;padding:24px}.card{width:min(560px,100%);padding:28px;border:1px solid #29445f;border-radius:22px;background:#0a2035;box-shadow:0 24px 80px #0007}h1{margin:0 0 10px;font-size:25px}p{color:#aebdcd;line-height:1.6}.route{padding:14px;border-radius:14px;background:#071827;color:#ffd18b;font-weight:800}.price{font-size:28px;font-weight:900}.actions{display:grid;gap:10px;margin-top:22px}button,a{display:flex;min-height:48px;align-items:center;justify-content:center;border:0;border-radius:12px;padding:0 16px;text-decoration:none;font-weight:900;cursor:pointer}.primary{background:#ffb547;color:#071827}.secondary{background:#173550;color:#fff}.note{font-size:12px;color:#7f95aa}</style></head><body><main class="shell"><section class="card">${body}</section></main></body></html>`;
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const origin = (params.get("origin") || "") as "ESB" | "IST" | "SAW";
  const entry = (params.get("entry") || "").toUpperCase();
  const exit = (params.get("exit") || "").toUpperCase();
  const departure = params.get("departure") || "";
  const returnDate = params.get("return") || "";
  const adults = Number(params.get("adults"));
  const oldPrice = Number(params.get("price"));
  if (!["ESB", "IST", "SAW"].includes(origin) || !airport.test(entry) || !airport.test(exit) || !validTravelDates(departure, returnDate) || ![1, 3].includes(adults) || !Number.isFinite(oldPrice) || oldPrice <= 0) {
    return new Response(page('<h1>Bağlantı geçersiz</h1><p>Rotayı uygulamadan yeniden oluştur.</p><div class="actions"><a class="secondary" href="/">Rota Radar’a dön</a></div>'), { status: 400, headers: { "content-type": "text/html; charset=utf-8" } });
  }
  try {
    const result = await createOpenJawBookingHandoff({ origin, entry, exit, departure, returnDate, adults });
    const action = trustedGoogleUrl(result.booking?.url);
    const seller = escapeHtml(result.booking?.seller || "Google Flights");
    const option = result.option;
    const formatted = new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY", maximumFractionDigits: 0 }).format(option.totalPriceTry);
    const oldFormatted = new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY", maximumFractionDigits: 0 }).format(oldPrice);
    const priceChanged = hasSignificantPriceChange(oldPrice, option.totalPriceTry);
    const hidden = result.booking?.postData
      ? [...new URLSearchParams(result.booking.postData)].map(([name, value]) => `<input type="hidden" name="${escapeHtml(name)}" value="${escapeHtml(value)}">`).join("")
      : "";
    const actionHtml = action && result.booking?.postData
      ? `<form method="post" action="${escapeHtml(action)}" target="_blank">${hidden}<button class="primary" type="submit">${priceChanged ? "Yeni fiyatla devam et" : `${seller} üzerinde devam et →`}</button></form>`
      : `<a class="primary" href="https://www.google.com/search?${escapeHtml(new URLSearchParams({ q: `Google Flights multi city ${origin} to ${entry} ${departure} ${exit} to ${origin} ${returnDate} ${adults} adults` }).toString())}" target="_blank" rel="noopener noreferrer">Rotayı Google’da kontrol et →</a>`;
    const priceNotice = priceChanged
      ? `<p>İlk gördüğün toplam fiyat <strong>${escapeHtml(oldFormatted)}</strong>, güncel toplam fiyat <strong>${escapeHtml(formatted)}</strong>.</p>`
      : `<p class="price">${escapeHtml(formatted)}</p>`;
    return new Response(page(`<h1>${priceChanged ? "Fiyat değişti" : "Fiyat yeniden doğrulandı"}</h1><p class="route">${origin} → ${entry} / ${exit} → ${origin}</p>${priceNotice}<p>${escapeHtml(departure)}–${escapeHtml(returnDate)} · ${adults} kişi toplamı · ödeme satıcı sayfasında tamamlanır.</p><div class="actions">${actionHtml}<a class="secondary" href="/">Rota Radar’a dön</a></div><p class="note">Fiyat ve koltuk müsaitliği satıcı ekranında son kez değişebilir.</p>`), { headers: { "content-type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });
  } catch (error) {
    return new Response(page(`<h1>Fiyat doğrulanamadı</h1><p>${escapeHtml(error instanceof Error ? error.message : "Satın alma bağlantısı hazırlanamadı.")}</p><div class="actions"><a class="secondary" href="/">Rota Radar’a dön</a></div>`), { status: 503, headers: { "content-type": "text/html; charset=utf-8" } });
  }
}
