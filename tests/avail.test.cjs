const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { loadApp } = require("./helpers/load-app.cjs");

const seed = (avail) => JSON.stringify({
  period: { start: "2026-09-01", end: "2026-09-01" },
  stations: [{ id: "h", name: "ホール" }],
  members: [
    { id: "a", name: "A", isLeader: false, stationIds: ["h"] },
    { id: "b", name: "B", isLeader: false, stationIds: ["h"] },
  ],
  shifts: [
    { id: "morning", name: "朝番", time: "9:00-14:00", need: 1, needLeader: 0, stationId: "h" },
    { id: "night", name: "夜番", time: "16:00-21:00", need: 1, needLeader: 0, stationId: "h" },
  ],
  leaves: [],
  avail,
  result: {},
});

describe("希望時間", () => {
  it("parseRange: 正常・異常", () => {
    const app = loadApp(seed({}));
    assert.deepEqual(app.parseRange("9:00-14:00"), [540, 840]);
    assert.equal(app.parseRange(""), null);
    assert.equal(app.parseRange("9:00-"), null);
    assert.equal(app.parseRange("14:00-9:00"), null);
  });

  it("hourOpts: 旧形式も時で選択表示、空は未選択", () => {
    const app = loadApp(seed({}));
    assert.match(app.hourOpts("9:00"), /value="9:00" selected/);
    assert.match(app.hourOpts("09:00"), /value="9:00" selected/);
    assert.match(app.hourOpts("9:30"), /value="9:00" selected/);
    assert.doesNotMatch(app.hourOpts(""), /selected/);
  });

  it("枠と重ならない人は割付られない", () => {
    // Aは午前のみ可、Bは夜のみ可 → 朝=A・夜=Bに決定的に割付られる
    const app = loadApp(seed({ "a|2026-09-01": "09:00-14:00", "b|2026-09-01": "16:00-21:00" }));
    app.autoAssign();
    const st = app.getState();
    assert.deepEqual(st.result["2026-09-01|morning"], ["a"]);
    assert.deepEqual(st.result["2026-09-01|night"], ["b"]);
  });

  it("部分重なりでも割付られる (9-12希望 → 9-14枠)", () => {
    // Aは朝枠と部分重なり、Bは朝枠と重ならない → 朝=A・夜=B
    const app = loadApp(seed({ "a|2026-09-01": "09:00-12:00", "b|2026-09-01": "16:00-21:00" }));
    app.autoAssign();
    const st = app.getState();
    assert.deepEqual(st.result["2026-09-01|morning"], ["a"]);
    assert.deepEqual(st.result["2026-09-01|night"], ["b"]);
  });

  it("重なりが大きい人が優先される (回数同点時)", () => {
    // 朝枠9-14: Aは全体(9-17)、Bは部分(9-10)。回数同点 → Aが決定的に選ばれる
    const app = loadApp(seed({ "a|2026-09-01": "09:00-17:00", "b|2026-09-01": "09:00-10:00" }));
    app.autoAssign();
    const st = app.getState();
    assert.deepEqual(st.result["2026-09-01|morning"], ["a"]);
  });

  it("希望なしは終日可として割付られる", () => {
    const app = loadApp(seed({}));
    assert.ok(app.fitsAvail("a", "2026-09-01", "9:00-14:00"));
  });

  it("旧データ(availなし)でも起動・割付できる", () => {
    const legacy = JSON.parse(seed({}));
    delete legacy.avail;
    const app = loadApp(JSON.stringify(legacy));
    app.autoAssign(); // 例外が出なければOK
    assert.equal(app.getState().avail !== undefined, true);
    assert.equal(Object.keys(app.getState().result).length, 2);
  });
});
