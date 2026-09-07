const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { loadApp, fire } = require("./helpers/load-app.cjs");

// 持ち場導入前の旧保存データ
const legacy = JSON.stringify({
  period: { start: "2026-09-01", end: "2026-09-03" },
  members: [{ id: "m1", name: "田中", isLeader: true }],
  shifts: [{ id: "s1", name: "朝番", time: "9:00-14:00", need: 1, needLeader: 0 }],
  leaves: ["m1|2026-09-02"],
  result: {},
});

describe("旧データ移行", () => {
  it("起動死せず持ち場が付与され、既存データは保持される", () => {
    const app = loadApp(legacy); // 例外が出たらここで失敗する
    const st = app.getState();
    assert.equal(st.stations.length, 2);
    assert.deepEqual(st.members[0].stationIds, st.stations.map((t) => t.id));
    assert.equal(st.shifts[0].stationId, st.stations[0].id);
    assert.deepEqual(st.leaves, ["m1|2026-09-02"]);
    assert.equal(st.members[0].name, "田中");
  });

  it("移行後も追加・リセットが動く", () => {
    const app = loadApp(legacy);
    fire(app.registry, "btnAddShift", "onclick");
    assert.equal(app.getState().shifts.length, 2);
    fire(app.registry, "btnReset", "onclick");
    const st = app.getState();
    assert.equal(st.shifts.length, 3);
    assert.equal(st.stations.length, 2);
  });
});
