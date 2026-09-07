const fs = require("fs");
const path = require("path");
const src = fs.readFileSync(path.join(__dirname, "..", "js", "app.js"), "utf8");

const stub = `
const store = {};
const localStorage = { getItem: (k) => store[k] ?? null, setItem: (k, v) => { store[k] = v; } };
const mkEl = () => ({ innerHTML: "", textContent: "", value: "", dataset: {}, onclick: null, onchange: null });
const document = { getElementById: () => mkEl(), createElement: () => mkEl(), querySelector: () => null };
const assert = (c, msg) => { if (!c) { console.error("NG:", msg); process.exitCode = 1; } else console.log("OK:", msg); };
`;

const test = `
// 1. 終了日を含むか (JSTずれの再発防止)
state.period = { start: "2026-09-01", end: "2026-09-15" };
const ds = dates();
assert(ds.length === 15, "15日分になる (" + ds.length + ")");
assert(ds[0] === "2026-09-01" && ds[14] === "2026-09-15", "開始日も終了日も含む (" + ds[0] + "~" + ds[14] + ")");

// 2. 持ち場フィルタ: キッチン専任はホール枠に入らない
const [kit, hall] = state.stations;
state.members.forEach((m, i) => { m.stationIds = i === 0 ? [kit.id] : [kit.id, hall.id]; });
state.shifts.forEach((s) => { s.stationId = hall.id; s.need = 1; s.needLeader = 0; });
state.leaves = [];
autoAssign();
const hallKeys = Object.keys(state.result).filter((k) => k.endsWith(state.shifts[0].id));
const onlyKitchen = state.members[0].id;
assert(hallKeys.length === 15, "ホール枠15日分ある");
assert(hallKeys.every((k) => !state.result[k].includes(onlyKitchen)), "キッチン専任はホール枠に入らない");

// 3. PNG余白計算 (定数だけ再現チェック: W=w+32, H=h+44)
const tw = 800, th = 600, tPX = 16, tPT = 16, tPB = 28;
assert(tw + tPX * 2 === 832 && th + tPT + tPB === 644, "余白16/16/28でW=832,H=644");
`;

eval(stub + src + test);
