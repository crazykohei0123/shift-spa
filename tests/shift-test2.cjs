const fs = require("fs");
const path = require("path");
const src = fs.readFileSync(path.join(__dirname, "..", "js", "app.js"), "utf8");

const stub = `
const store = {};
const localStorage = { getItem: (k) => store[k] ?? null, setItem: (k, v) => { store[k] = v; } };
const registry = {};
const mkEl = (id) => ({ id, innerHTML: "", textContent: "", value: "", dataset: {}, onclick: null, onchange: null,
  closest: () => null, querySelectorAll: () => [] });
const document = { getElementById: (id) => (registry[id] ||= mkEl(id)), createElement: (id) => mkEl(id), querySelector: () => null };
const confirm = () => true;
const alert = (m) => console.log("alert:", m);
const assert = (c, msg) => { if (!c) { console.error("NG:", msg); process.exitCode = 1; } else console.log("OK:", msg); };
const fire = (id, ev, arg) => registry[id][ev](arg);
const fakeEvt = (props) => ({ target: Object.assign({ dataset: {}, closest: () => null, value: "", checked: false }, props) });
`;

const test = `
try {
  // 持ち場追加
  document.getElementById("stationName").value = "レジ";
  fire("btnAddStation", "onclick");
  assert(state.stations.length === 3, "持ち場が3つになる (" + state.stations.length + ")");

  // シフト追加
  fire("btnAddShift", "onclick");
  assert(state.shifts.length === 4, "シフトが4つになる (" + state.shifts.length + ")");

  // メンバー追加
  document.getElementById("memberName").value = "高橋";
  fire("btnAddMember", "onclick");
  assert(state.members.length === 4, "メンバーが4人になる");

  // リセットで初期状態に戻る
  fire("btnReset", "onclick");
  assert(state.shifts.length === 3 && state.stations.length === 2 && state.members.length === 3,
    "リセットで初期状態 (枠" + state.shifts.length + "/持ち場" + state.stations.length + "/人" + state.members.length + ")");

  // 持ち場削除
  const delId = state.stations[0].id;
  fire("stationList", "onclick", fakeEvt({ dataset: { act: "del" }, closest: () => ({ dataset: { id: delId } }) }));
  assert(state.stations.length === 1, "持ち場削除で1つになる");
} catch (e) {
  console.error("EXCEPTION:", e.message);
  process.exitCode = 1;
}
`;

eval(stub + src + test);
