export function flightSearchPolicy(destinationCode: string) {
  return destinationCode === "CMN"
    ? { stops: "nonstop", label: "Yalnız direkt" }
    : { stops: "one_stop_or_fewer", label: "En fazla 1 aktarma" };
}
