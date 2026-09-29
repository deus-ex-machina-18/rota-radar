export type CalendarPricePoint = {
  nights: number;
  perPersonTry: number;
};

export type DailyCalendarBaseline = {
  nights: number;
  medianPerPersonTry: number;
  sampleCount: number;
};

export type HistoricalCalendarBaseline = DailyCalendarBaseline & {
  observedDay: string;
};

export function median(values: number[]) {
  const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (!sorted.length) return null;
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[middle]
    : Math.round((sorted[middle - 1] + sorted[middle]) / 2);
}

export function summarizeCalendarPrices(points: CalendarPricePoint[]) {
  const grouped = new Map<number, number[]>();
  for (const point of points) {
    if (!Number.isInteger(point.nights) || point.nights < 1 || !Number.isFinite(point.perPersonTry)) continue;
    grouped.set(point.nights, [...(grouped.get(point.nights) ?? []), point.perPersonTry]);
  }
  return [...grouped.entries()].flatMap(([nights, prices]): DailyCalendarBaseline[] => {
    const value = median(prices);
    return value == null ? [] : [{ nights, medianPerPersonTry: value, sampleCount: prices.length }];
  }).sort((a, b) => a.nights - b.nights);
}

export function choosePriceBaseline(
  nights: number,
  current: DailyCalendarBaseline[],
  history: HistoricalCalendarBaseline[],
) {
  const nearbyCurrent = current.filter((row) => Math.abs(row.nights - nights) <= 1);
  const nearbyHistory = history.filter((row) => Math.abs(row.nights - nights) <= 1);
  const currentMedian = median(nearbyCurrent.map((row) => row.medianPerPersonTry));
  const historyDays = new Set(nearbyHistory.map((row) => row.observedDay)).size;
  const useHistory = historyDays >= 3;
  const values = useHistory
    ? [...nearbyHistory.map((row) => row.medianPerPersonTry), ...(currentMedian == null ? [] : [currentMedian])]
    : currentMedian == null ? [] : [currentMedian];
  return {
    baseline: median(values),
    label: useHistory ? "30 günlük takvim medyanı" : "takvim medyanı",
    historyCount: historyDays,
  };
}
