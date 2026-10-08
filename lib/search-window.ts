const DAY = 86_400_000;

export function istanbulDay(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Istanbul', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
  const value = (type: string) => parts.find(part => part.type === type)!.value;
  return `${value('year')}-${value('month')}-${value('day')}`;
}

// Five departure blocks per month, seven future months. One bounded sample per run.
export function radarWindow(now = new Date()) {
  const today = new Date(`${istanbulDay(now)}T00:00:00Z`);
  const epochDay = Math.floor(today.getTime() / DAY);
  const offset = 6 + Math.floor(epochDay / 5) % 7;
  const month = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + offset, 1));
  const lastDay = new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth() + 1, 0)).getUTCDate();
  const firstDay = Math.min(1 + (epochDay % 5) * 7, lastDay - 6);
  const start = new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth(), firstDay));
  const end = new Date(start.getTime() + 6 * DAY);
  return { start, end, month: start.toISOString().slice(0, 7) };
}

export function validTravelDates(departure: string, returnDate: string, now = new Date()) {
  const valid = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(`${value}T00:00:00Z`)) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
  return valid(departure) && valid(returnDate) && departure > istanbulDay(now) && returnDate > departure;
}

export async function settledWithLimit<T, R>(items: T[], limit: number, task: (item: T) => Promise<R>) {
  const results: PromiseSettledResult<R>[] = new Array(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const index = next++;
      try { results[index] = { status: 'fulfilled', value: await task(items[index]) }; }
      catch (reason) { results[index] = { status: 'rejected', reason }; }
    }
  }));
  return results;
}
