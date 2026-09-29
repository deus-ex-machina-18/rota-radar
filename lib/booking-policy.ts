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
}) {
  const params = new URLSearchParams({
    destination: deal.destination,
    adults: String(deal.adults),
    departure: deal.departure,
    return: deal.returnDate,
    price: String(deal.totalPriceTry),
  });
  return `/api/book?${params.toString()}`;
}
