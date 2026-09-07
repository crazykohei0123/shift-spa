const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { loadApp } = require("./helpers/load-app.cjs");

// 田中=責任者(両対応)、佐藤=両対応、鈴木=ホールのみ。佐藤は9/1休み
const seed = JSON.stringify({
  period: { start: "2026-09-01", end: "2026-09-03" },
  stations: [{ id: "k", name: "キッチン" }, { id: "h", name: "ホール" }],
  members: [
    { id: "tanaka", name: "田中", isLeader: true, stationIds: ["k", "h"] },
    { id: "sato", name: "佐藤", isLeader: false, stationIds: ["k", "h"] },
    { id: "suzuki", name: "鈴木", isLeader: false, stationIds: ["h"] },
  ],
  shifts: [
    { id: "morning", name: "朝番", time: "9:00-14:00", need: 1, needLeader: 1, stationId: "k" },
    { id: "noon", name: "昼番", time: "10:00-16:00", need: 2, needLeader: 0, stationId: "h" },
  ],
  leaves: ["sato|2026-09-01"],
  result: {},
});

function assignedByDate(app) {
  const st = app.getState();
  const byDate = {};
  for (const [key, ids] of Object.entries(st.result)) {
    const [d] = key.split("|");
    (byDate[d] ||= []).push(...ids);
  }
  return byDate;
}

describe("自動割付", () => {
  it("休みの人は割付られない", () => {
    const app = loadApp(seed);
    app.autoAssign();
    assert.ok(!(assignedByDate(app)["2026-09-01"] || []).includes("sato"));
  });

  it("1人が1日に二重割付されない", () => {
    const app = loadApp(seed);
    app.autoAssign();
    for (const ids of Object.values(assignedByDate(app))) {
      assert.equal(new Set(ids).size, ids.length);
    }
  });

  it("持ち場外の人は割付られない (鈴木はキッチン朝番に入らない)", () => {
    const app = loadApp(seed);
    app.autoAssign();
    const st = app.getState();
    for (const d of ["2026-09-01", "2026-09-02", "2026-09-03"]) {
      assert.ok(!(st.result[d + "|morning"] || []).includes("suzuki"));
    }
  });

  it("責任者枠には責任者が入る", () => {
    const app = loadApp(seed);
    app.autoAssign();
    const st = app.getState();
    for (const d of ["2026-09-01", "2026-09-02", "2026-09-03"]) {
      assert.ok((st.result[d + "|morning"] || []).includes("tanaka"));
    }
  });

  it("全3日×全枠の結果が生成される", () => {
    const app = loadApp(seed);
    app.autoAssign();
    const st = app.getState();
    assert.equal(Object.keys(st.result).length, 6);
  });
});
