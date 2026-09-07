const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { loadApp } = require("./helpers/load-app.cjs");

const seed = JSON.stringify({
  period: { start: "2026-09-01", end: "2026-09-02" },
  stations: [{ id: "k", name: "キッチン" }, { id: "h", name: "ホール" }],
  members: [
    { id: "tanaka", name: "田中", isLeader: true, stationIds: ["k", "h"] },
    { id: "sato", name: "佐藤", isLeader: false, stationIds: ["k", "h"] },
  ],
  shifts: [
    { id: "morning", name: "朝番", time: "9:00-14:00", need: 2, needLeader: 1, stationId: "k" },
    { id: "noon", name: "昼番", time: "10:00-16:00", need: 1, needLeader: 0, stationId: "h" },
  ],
  leaves: [],
  result: {},
});

const measure = (t) => t.length * 7; // 描画と無関係な簡易物差し

describe("PNGレイアウト", () => {
  it("空き枠は「不足」と「要N」になる", () => {
    const app = loadApp(seed);
    const s = app.getState().shifts[0];
    assert.deepEqual(app.cellText("2026-09-01", s), { top: "不足", bottom: "要2", short: true });
  });

  it("割付済みは名前を「・」で連結する", () => {
    const app = loadApp(seed);
    app.getState().result["2026-09-01|morning"] = ["tanaka", "sato"];
    const s = app.getState().shifts[0];
    assert.deepEqual(app.cellText("2026-09-01", s), { top: "田中・佐藤", bottom: "", short: false });
  });

  it("列数は日付+枠数、W/Hは余白込み", () => {
    const app = loadApp(seed);
    const L = app.tableLayout(measure);
    assert.equal(L.widths.length, 3);
    assert.equal(L.W, L.widths.reduce((a, b) => a + b, 0) + 32);
    assert.equal(L.H, 16 + L.headerH + L.rowH * 2 + 28);
  });

  it("長い名前ほど列が広くなる", () => {
    const app = loadApp(seed);
    const narrow = app.tableLayout(() => 10);
    const wide = app.tableLayout((t) => t.length * 100);
    assert.ok(wide.widths.every((w, i) => w >= narrow.widths[i]));
    assert.ok(wide.W > narrow.W);
  });
});
