export function matchesProfileEntry(destination: string, entry: string) {
  if (destination === entry) return true;
  return destination === "TYO" && entry === "NRT";
}
