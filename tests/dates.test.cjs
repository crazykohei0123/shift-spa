const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { loadApp } = require("./helpers/load-app.cjs");

const seed = (period) => JSON.stringify({ period, stations: [], members: [], shifts: [], leaves: [], result: {} });

describe("dates", () => {
  it("終了日を含む連日を返す", () => {
    const app = loadApp(seed({ start: "2026-09-01", end: "2026-09-03" }));
    assert.deepEqual(app.dates(), ["2026-09-01", "2026-09-02", "2026-09-03"]);
  });

  it("月またぎ・うるう日を正しく進める", () => {
    const app = loadApp(seed({ start: "2024-02-28", end: "2024-03-01" }));
    assert.deepEqual(app.dates(), ["2024-02-28", "2024-02-29", "2024-03-01"]);
  });

  it("31日で打ち切る", () => {
    const app = loadApp(seed({ start: "2026-01-01", end: "2026-12-31" }));
    const ds = app.dates();
    assert.equal(ds.length, 31);
    assert.equal(ds[0], "2026-01-01");
    assert.equal(ds[30], "2026-01-31");
  });

  it("期間未設定なら空", () => {
    const app = loadApp(seed({ start: "", end: "" }));
    assert.deepEqual(app.dates(), []);
  });
});
