type ApiPayload = Record<string, unknown>;

export type FlightOptionToken = "departure_token" | "booking_token";

function enabledFlag(value: unknown) {
  return value === true || value === 1 || value === "1" || value === "true";
}

export function hasSeparateTicketRisk(option: Record<string, unknown>) {
  return enabledFlag(option.is_self_transfer) ||
    enabledFlag(option.is_separate_tickets) ||
    enabledFlag(option.is_split_booking);
}

function flightOptions(payload: ApiPayload) {
  return ["best_flights", "other_flights"].flatMap((key) =>
    Array.isArray(payload[key])
      ? (payload[key] as Array<Record<string, unknown>>)
      : [],
  );
}

export function chooseFlightOption(
  payload: ApiPayload,
  tokenName: FlightOptionToken,
  allowSeparateTickets = false,
) {
  const candidates = flightOptions(payload).filter((option) => {
    const flights = Array.isArray(option.flights) ? option.flights : [];
    const layovers = Array.isArray(option.layovers) ? option.layovers : [];
    return flights.length >= 1 &&
      flights.length <= 2 &&
      typeof option[tokenName] === "string" &&
      (allowSeparateTickets || !hasSeparateTicketRisk(option)) &&
      layovers.every((item) =>
        !item || typeof item !== "object" ||
        typeof (item as Record<string, unknown>).duration !== "number" ||
        Number((item as Record<string, unknown>).duration) <= 360
      );
  });
  candidates.sort((a, b) => Number(a.price ?? Number.MAX_SAFE_INTEGER) - Number(b.price ?? Number.MAX_SAFE_INTEGER));
  if (!candidates.length) throw new Error("Ayrıntılı doğrulamada uygun uçuş bulunamadı");
  return candidates[0];
}
