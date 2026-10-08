import assert from 'node:assert/strict';
import { readFileSync, readdirSync, mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';

const root = resolve('.');
const temp = mkdtempSync(join(tmpdir(), 'radar-test-'));
try {
  writeFileSync(join(temp, 'package.json'), '{"type":"module"}');
  writeFileSync(join(temp, 'env.mjs'), `export const records = new Map();
export function getStore() { return { async get(key) { return records.get(key) ?? null; }, async setJSON(key, value) { records.set(key, JSON.parse(JSON.stringify(value))); } }; }`);
  writeFileSync(join(temp, 'data-seed.mjs'), `export default ${readFileSync(join(root, 'data/seed-history.json'), 'utf8')};`);
  const compile = (relative) => {
    const target = join(temp, relative.replace(/\.ts$/, '.mjs'));
    let source = readFileSync(join(root, relative), 'utf8').replaceAll('"@netlify/blobs"', JSON.stringify(pathToFileURL(join(temp, 'env.mjs')).href)).replaceAll('"@/data/seed-history.json"', JSON.stringify(pathToFileURL(join(temp, 'data-seed.mjs')).href));
    source = source.replace(/(["'])@\/([^"']+)\1/g, (_, quote, path) => JSON.stringify(pathToFileURL(join(temp, `${path}.mjs`)).href));
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText);
  };
  ['lib/flight-history-store.ts', 'lib/runtime-env.ts', 'lib/flight-monitor.ts', 'lib/destination-catalog.ts', 'lib/flight-option-selector.ts', 'lib/booking-policy.ts', 'lib/flight-search-policy.ts', 'lib/price-baseline.ts', 'lib/search-window.ts', 'app/api/destinations/route.ts', 'app/api/flights/route.ts', 'app/api/history/route.ts', 'app/api/book/route.ts'].forEach(compile);
  const load = path => import(pathToFileURL(join(temp, path)).href);
  const { records } = await load('env.mjs');
  const { radarWindow, validTravelDates, settledWithLimit } = await load('lib/search-window.mjs');
  const { runScan, createBookingHandoff } = await load('lib/flight-monitor.mjs');
  const catalogAPI = await load('app/api/destinations/route.mjs');
  const catalogBody = await (await catalogAPI.GET()).json();
  assert.equal(catalogBody.catalogCount, 83); assert.equal(catalogBody.groundCount, 8);
  const flights = await load('app/api/flights/route.mjs');
  const history = await load('app/api/history/route.mjs');
  const book = await load('app/api/book/route.mjs');
  process.env.SEARCHAPI_API_KEY = 'fixture-only';
  const now = new Date();
  const months = new Set();
  for (let i = 0; i < 35; i++) {
    const date = new Date(Date.UTC(2026, 9, 1 + i));
    const window = radarWindow(date);
    const difference = (window.start.getUTCFullYear() - date.getUTCFullYear()) * 12 + window.start.getUTCMonth() - date.getUTCMonth();
    assert(difference >= 6 && difference <= 12);
    assert.equal((window.end - window.start) / 86400000, 6);
    assert.equal(window.start.getUTCMonth(), window.end.getUTCMonth());
    months.add(difference);
  }
  assert.equal(months.size, 7);
  assert(!validTravelDates('2027-02-30', '2027-03-05', new Date('2026-10-08')));
  assert(!validTravelDates('2026-10-07', '2026-10-12', new Date('2026-10-08')));
  assert(!validTravelDates('2027-04-05', '2027-04-01', new Date('2026-10-08')));
  let active = 0, maximum = 0;
  const settled = await settledWithLimit([1,2,3,4,5,6], 3, async number => {
    active++; maximum = Math.max(maximum, active); await new Promise(resolve => setTimeout(resolve, 2)); active--;
    if (number === 2) throw new Error('fixture'); return number;
  });
  assert.equal(maximum, 3); assert.equal(settled[1].status, 'rejected'); assert.equal(settled[5].value, 6);
  const groundResponse = await flights.GET(new Request('https://fixture/api/flights?destination=EDIRNE&adults=3'));
  assert.equal(groundResponse.status, 422);
  let mode = 'normal';
  const requests = [];
  globalThis.fetch = async url => {
    const params = new URL(url).searchParams; requests.push(params);
    if (mode === 'quota') return new Response('{}', { status: 429 });
    if (params.get('engine') === 'google_flights_calendar') {
      const start = params.get('outbound_date_start'); const end = params.get('outbound_date_end');
      const returnStart = params.get('return_date_start'); const returnEnd = params.get('return_date_end');
      const days = (a,b) => (Date.parse(b) - Date.parse(a)) / 86400000 + 1;
      assert(days(start,end) * days(returnStart,returnEnd) <= 200, 'calendar combinations bounded');
      const departure = start;
      const returnDate = new Date(Date.parse(start) + 8 * 86400000).toISOString().slice(0,10);
      if (mode === 'empty') return Response.json({ calendar: [] });
      return Response.json({ calendar: [30000,60000,60000].map((price, index) => ({ departure: new Date(Date.parse(departure)+index*86400000).toISOString().slice(0,10), return: new Date(Date.parse(returnDate)+index*86400000).toISOString().slice(0,10), price, departure_id: 'SAW' })) });
    }
    assert.equal(params.get('adults'), '3', 'traveller count preserved at all detail steps');
    assert.equal(params.get('departure_id'), 'SAW', 'origin preserved');
    if (params.has('booking_token')) {
      return Response.json({ booking_options: [
        { price: 10000, book_with: 'phone only' },
        { price: mode === 'changed' ? 45000 : 30000, book_with: 'fixture airline', booking_request: { url: 'https://www.google.com/travel/clk/f', post_data: 'token=fixture' } },
      ] });
    }
    const option = { price: mode === 'missing' ? undefined : 30000, flights: [{ airline: 'Fixture', departure_airport: { id: 'SAW' } }], total_duration: 200 };
    return Response.json({ best_flights: [{ ...option, ...(params.has('departure_token') ? { booking_token: 'back' } : { departure_token: 'out' }) }] });
  };
  const scan = await runScan(['CMN'], 3, 1);
  assert(scan.deals.length > 0); assert.equal(scan.deals[0].opportunityPct, 50);
  assert.equal(scan.deals[0].verificationStatus, 'verified');
  assert.equal(scan.deals[0].seller, 'fixture airline');
  assert(scan.deals[0].bookingPath.includes('origin=SAW'));
  const count = records.get('deals/3/CMN').length;
  await runScan(['CMN'], 3, 0);
  assert.equal(records.get('deals/3/CMN').length, count, 'daily snapshots upsert without duplication');
  assert(records.get('baselines/3/CMN').every(row => row.travelMonth.length === 7));
  const cached = await (await history.GET(new Request('https://fixture/api/history?destination=CMN&adults=3'))).json();
  assert.equal(cached.deals[0].opportunityPct, 50); assert.equal(cached.deals[0].baselinePerPersonTry, 20000);
  assert.equal(cached.deals[0].source, 'history');
  assert(cached.deals[0].bookingPath.includes('origin=SAW'));
  records.set('deals/1/CMN', [{ ...scan.deals[0], adults: 1, departure: '2025-01-01', returnDate: '2025-01-09', observedAt: '2099-01-01T00:00:00Z' }]);
  const past = await (await history.GET(new Request('https://fixture/api/history?destination=CMN&adults=1'))).json();
  assert(past.deals.every(deal => deal.departure > new Date().toISOString().slice(0,10)), 'departed trips excluded');
  const { readHistoricalBaselines } = await load('lib/flight-history-store.mjs');
  records.set('baselines/3/CMN', [{ nights: 8, medianPerPersonTry: 100, observedAt: new Date().toISOString(), observedDay: '2000-01-01', travelMonth: '1999-01' }]);
  assert.deepEqual(await readHistoricalBaselines('CMN', 3, 7, 9, '2099-01-01', scan.deals[0].departure.slice(0,7)), [], 'other travel months excluded');
  mode = 'changed';
  const changed = await createBookingHandoff(scan.deals[0]);
  assert.equal(changed.currentTotalPriceTry, 45000); assert.equal(changed.verified.verificationStatus, 'price_changed');
  const changedPage = await book.GET(new Request(`https://fixture${scan.deals[0].bookingPath}`));
  const html = await changedPage.text(); assert(html.includes('Yeni fiyatla devam et')); assert(!html.includes('setTimeout'));
  mode = 'missing';
  // Booking seller price still supplies a current fare, even when flight list omits it.
  assert.equal((await createBookingHandoff(scan.deals[0])).currentTotalPriceTry, 30000);
  mode = 'empty';
  const empty = await flights.GET(new Request('https://fixture/api/flights?destination=CMN&adults=3'));
  assert.equal(empty.status, 200); assert.deepEqual((await empty.json()).deals, []);
  mode = 'quota';
  const unavailable = await flights.GET(new Request('https://fixture/api/flights?destination=CMN&adults=3'));
  assert.equal(unavailable.status, 503); const unavailableBody = await unavailable.json(); assert.equal(unavailableBody.errorCode, 'provider_unavailable'); assert(unavailableBody.error.includes('429'));
  const fallbackPage = await book.GET(new Request(`https://fixture${scan.deals[0].bookingPath}`));
  const fallbackHtml = await fallbackPage.text(); assert(fallbackHtml.includes('SAW')); assert(fallbackHtml.includes('q=Google')); assert(fallbackHtml.includes(scan.deals[0].departure));
  const invalidPage = await book.GET(new Request('https://fixture/api/book?destination=CMN&adults=3&departure=2027-02-30&return=2027-03-05&price=30000'));
  assert.equal(invalidPage.status, 400);
  console.log('PASS: date rotation, calendar limit, bounded concurrency, snapshot/history, traveller/origin handoff, seller selection, changed-price page, empty/error contracts, targeted fallback, invalid dates');
} finally { rmSync(temp, { recursive: true, force: true }); }
