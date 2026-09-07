const fs = require("fs");
const path = require("path");
const src = fs.readFileSync(path.join(__dirname, "..", "js", "app.js"), "utf8");

// 旧v1保存データ (stationsなし) を事前に localStorage に入れて起動
const v1 = JSON.stringify({
  period: { start: "2026-09-01", end: "2026-09-03" },
  members: [{ id: "m1", name: "田中", isLeader: true }],
  shifts: [{ id: "s1", name: "朝番", time: "9:00-14:00", need: 1, needLeader: 0 }],
  leaves: ["m1|2026-09-02"],
  result: {},
});

const stub = `
const store = { "shift-spa-v1": ${JSON.stringify(v1)} };
const localStorage = { getItem: (k) => store[k] ?? null, setItem: (k, v) => { store[k] = v; } };
const registry = {};
const mkEl = (id) => ({ id, innerHTML: "", textContent: "", value: "", dataset: {}, onclick: null, onchange: null,
  closest: () => null, querySelectorAll: () => [] });
const document = { getElementById: (id) => (registry[id] ||= mkEl(id)), createElement: (id) => mkEl(id) };
const confirm = () => true;
const alert = (m) => console.log("alert:", m);
const assert = (c, msg) => { if (!c) { console.error("NG:", msg); process.exitCode = 1; } else console.log("OK:", msg); };
`;

const test = `
assert(state.stations.length === 2, "旧データに持ち場が付与される");
assert(state.members[0].stationIds.length === 2, "既存メンバーは全持ち場可");
assert(state.shifts[0].stationId === state.stations[0].id, "既存枠に持ち場が付く");
assert(state.leaves.length === 1 && state.members[0].name === "田中", "既存の休み・名前は保持");
assert(typeof registry["btnAddShift"].onclick === "function", "追加ハンドラが登録される");
registry["btnAddShift"].onclick();
assert(state.shifts.length === 2, "シフト追加できる");
registry["btnReset"].onclick();
assert(state.shifts.length === 3 && state.stations.length === 2, "リセットで初期状態に戻る");
`;

try {
  eval(stub + src + test);
} catch (e) {
  console.error("EXCEPTION (起動時死):", e.message);
  process.exitCode = 1;
}
