import test from "node:test";
import assert from "node:assert/strict";
import { parseDateValue } from "./timeClockDates";

test("parseDateValue keeps YYYY-MM-DD as a local date without timezone shift", () => {
  const parsed = parseDateValue("2026-08-04");

  assert.ok(parsed);
  assert.equal(parsed?.getFullYear(), 2026);
  assert.equal(parsed?.getMonth(), 7);
  assert.equal(parsed?.getDate(), 4);
});

test("parseDateValue parses ISO timestamps", () => {
  const parsed = parseDateValue("2026-08-04T15:30:00.000Z");

  assert.ok(parsed);
  assert.equal(parsed?.getUTCFullYear(), 2026);
  assert.equal(parsed?.getUTCMonth(), 7);
  assert.equal(parsed?.getUTCDate(), 4);
});
