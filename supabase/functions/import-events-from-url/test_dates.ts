import { toLocal, fixRange, parseTime, easternToIso } from "./dates.ts";
const cases: [string, string | null][] = [
  ["2026-10-31T19:00:00-04:00", "2026-10-31T19:00"],
  ["2026-10-31T23:00:00Z", "2026-10-31T19:00"],
  ["2026-12-05T19:00:00-0500", "2026-12-05T19:00"],
  ["2026-10-31 19:00", "2026-10-31T19:00"],
  ["2026-10-31T19:00:00.000", "2026-10-31T19:00"],
  ["10/31/2026 7:00 PM", "2026-10-31T19:00"],
  ["Oct 31, 2026 7pm", "2026-10-31T19:00"],
  ["Saturday, October 31, 2026 at 7:30 PM", "2026-10-31T19:30"],
  ["2026-10-31", "2026-10-31T00:00"],
];
let bad = 0;
for (const [i, want] of cases) { const got = toLocal(i)?.local ?? null; if (got !== want) { bad++; console.log("FAIL", i, got, "want", want); } }
const n: string[] = [];
const r1 = fixRange(toLocal("2026-10-31T21:00"), toLocal("2026-10-31T02:00"), n); if (r1.end_local !== "2026-11-01T02:00") { bad++; console.log("FAIL overnight", r1); }
const r2 = fixRange(toLocal("2026-10-31T19:00"), toLocal("2026-10-31"), []); if (r2.end_local !== null) { bad++; console.log("FAIL same-day date-only end", r2); }
const r3 = fixRange(toLocal("2026-10-30"), toLocal("2026-11-01"), []); if (r3.end_local !== "2026-11-01T23:59") { bad++; console.log("FAIL festival end", r3); }
for (const [t, w] of [["7pm","19:00"],["12 PM","12:00"],["12am","00:00"],["7:30 p.m.","19:30"],["noon","12:00"]]) if (parseTime(t) !== w) { bad++; console.log("FAIL time", t, parseTime(t)); }
if (easternToIso("2026-11-01T01:30") === null) bad++;
if (easternToIso("2026-07-04T19:00") !== "2026-07-04T23:00:00.000Z") { bad++; console.log("FAIL dst", easternToIso("2026-07-04T19:00")); }
if (easternToIso("2026-12-04T19:00") !== "2026-12-05T00:00:00.000Z") { bad++; console.log("FAIL est", easternToIso("2026-12-04T19:00")); }
console.log(bad === 0 ? "ALL PASS" : `${bad} failures`);
