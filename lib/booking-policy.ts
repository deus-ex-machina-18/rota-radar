const GOOGLE_HOST = "google.com";

export function trustedGoogleUrl(value?: string) {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    const trustedHost = url.hostname === GOOGLE_HOST || url.hostname.endsWith(`.${GOOGLE_HOST}`);
    return url.protocol === "https:" && trustedHost ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}

export function hasSignificantPriceChange(previousTotal: number, currentTotal: number) {
  if (!Number.isFinite(previousTotal) || previousTotal <= 0 || !Number.isFinite(currentTotal)) return true;
  return Math.abs(currentTotal - previousTotal) / previousTotal > 0.1;
}

export function ticketCheckPath(deal: {
  destination: string;
  adults: number;
  departure: string;
  returnDate: string;
  totalPriceTry: number;
  origin?: string;
}) {
  const params = new URLSearchParams({
    destination: deal.destination,
    adults: String(deal.adults),
    departure: deal.departure,
    return: deal.returnDate,
    price: String(deal.totalPriceTry),
  });
  if (deal.origin && ["ESB", "IST", "SAW"].includes(deal.origin)) params.set("origin", deal.origin);
  return `/api/book?${params.toString()}`;
}

export function routeSearchUrl(deal: { origin: string; destination: string; departure: string; returnDate: string; adults: number }) {
  const query = `Google Flights ${deal.origin} to ${deal.destination} ${deal.departure} return ${deal.returnDate} ${deal.adults} adults round trip`;
  return `https://www.google.com/search?${new URLSearchParams({ q: query }).toString()}`;
}
