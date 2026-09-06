"use strict";
const KEY = "shift-spa-v1";
const $ = (id) => document.getElementById(id);
const uid = () => Math.random().toString(36).slice(2, 9);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

function todayPlus(n) {
  const d = new Date(); d.setDate(d.getDate() + n);
  return fmtDate(d);
}
// toISOStringはUTC基準でJSTは前日になるためローカル日付で整形する
const fmtDate = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
function defaultState() {
  const m1 = uid(), m2 = uid(), m3 = uid();
  const st1 = uid(), st2 = uid();
  return {
    period: { start: todayPlus(1), end: todayPlus(7) },
    stations: [
      { id: st1, name: "キッチン" },
      { id: st2, name: "ホール" },
    ],
    members: [
      { id: m1, name: "田中", isLeader: true, stationIds: [st1, st2] },
      { id: m2, name: "佐藤", isLeader: false, stationIds: [st1, st2] },
      { id: m3, name: "鈴木", isLeader: false, stationIds: [st1, st2] },
    ],
    shifts: [
      { id: uid(), name: "朝番", time: "9:00-14:00", need: 2, needLeader: 1, stationId: st1 },
      { id: uid(), name: "昼番", time: "10:00-16:00", need: 2, needLeader: 0, stationId: st2 },
      { id: uid(), name: "夜番", time: "16:00-21:00", need: 2, needLeader: 1, stationId: st2 },
    ],
    leaves: [], // ["memberId|YYYY-MM-DD"]
    result: {}, // {"YYYY-MM-DD|shiftId": [memberId]}
  };
}
let state;
try {
  state = JSON.parse(localStorage.getItem(KEY)) || defaultState();
} catch { state = defaultState(); }
const save = () => localStorage.setItem(KEY, JSON.stringify(state));
const leaveSet = () => new Set(state.leaves);
// v1保存データに持ち場がなければ付与 (既存のメンバー・枠・休みは保持)
if (!state.stations) {
  const st1 = uid(), st2 = uid();
  state.stations = [{ id: st1, name: "キッチン" }, { id: st2, name: "ホール" }];
  state.members.forEach((m) => (m.stationIds = [st1, st2]));
  state.shifts.forEach((s) => (s.stationId = st1));
  save();
}

function dates() {
  const out = [];
  if (!state.period.start || !state.period.end) return out;
  let d = new Date(state.period.start + "T00:00:00");
  const end = new Date(state.period.end + "T00:00:00");
  // ponytail: 31日上限、長期シフトは必要時に拡張
  while (d <= end && out.length < 31) {
    out.push(fmtDate(d));
    d.setDate(d.getDate() + 1);
  }
  return out;
}
const wday = (iso) => "日月火水木金土"[new Date(iso + "T00:00:00").getDay()];
const md = (iso) => iso.slice(5).replace("-", "/");
const memberById = (id) => state.members.find((m) => m.id === id);
const stationName = (id) => state.stations.find((t) => t.id === id)?.name || "";

// --- 自動割付: 日付順の貪欲1パス。休み除外→責任者優先→回数少→前日非勤務→ランダム
function autoAssign() {
  const ds = dates(), counts = {}, result = {};
  state.members.forEach((m) => (counts[m.id] = 0));
  const leaves = leaveSet();
  let prevDay = new Set();
  for (const date of ds) {
    const assignedToday = new Set();
    for (const s of state.shifts) {
      const key = date + "|" + s.id;
      const cand = (onlyLeader) =>
        state.members
          .filter((m) => !leaves.has(m.id + "|" + date) && !assignedToday.has(m.id))
          .filter((m) => !s.stationId || (m.stationIds || []).includes(s.stationId))
          .filter((m) => (onlyLeader ? m.isLeader : true))
          .sort((a, b) => counts[a.id] - counts[b.id] || (prevDay.has(a.id) ? 1 : 0) - (prevDay.has(b.id) ? 1 : 0) || Math.random() - 0.5);
      const picked = [];
      cand(true).slice(0, Math.min(s.needLeader, s.need)).forEach((m) => { picked.push(m.id); assignedToday.add(m.id); });
      cand(false).slice(0, s.need - picked.length).forEach((m) => { picked.push(m.id); assignedToday.add(m.id); });
      picked.forEach((id) => counts[id]++);
      result[key] = picked;
    }
    prevDay = assignedToday;
  }
  state.result = result;
  save(); renderResult();
}

// --- 描画
function renderMembers() {
  $("memberList").innerHTML = state.members.map((m) => `
    <div class="mrow" data-id="${m.id}">
      <input type="checkbox" ${m.isLeader ? "checked" : ""} data-k="isLeader" title="責任者">責
      <input type="text" value="${esc(m.name)}" data-k="name" maxlength="20">
      ${state.stations.map((t) => `<label class="st"><input type="checkbox" data-k="station" value="${t.id}" ${(m.stationIds || []).includes(t.id) ? "checked" : ""}>${esc(t.name)}</label>`).join("")}
      <button data-act="del">削除</button>
    </div>`).join("") || '<p class="hint">メンバーを追加してください</p>';
}
function renderStations() {
  $("stationList").innerHTML = state.stations.map((t) => `
    <span class="srow" data-id="${t.id}">
      <input type="text" value="${esc(t.name)}" data-k="name" maxlength="20" title="持ち場名">
      <button data-act="del">削除</button>
    </span>`).join("");
}
function renderShifts() {
  $("shiftList").innerHTML = state.shifts.map((s) => `
    <div class="srow" data-id="${s.id}">
      <input type="text" value="${esc(s.name)}" data-k="name" title="シフト名">
      <input type="text" value="${esc(s.time)}" data-k="time" title="時間帯" placeholder="9:00-13:00">
      <select data-k="stationId" title="持ち場">${state.stations.map((t) => `<option value="${t.id}" ${s.stationId === t.id ? "selected" : ""}>${esc(t.name)}</option>`).join("")}</select>
      <label>人数 <input type="number" value="${s.need}" min="1" max="20" data-k="need"></label>
      <label>責任者 <input type="number" value="${s.needLeader}" min="0" max="20" data-k="needLeader"></label>
      <button data-act="del">削除</button>
    </div>`).join("");
}
function renderLeave() {
  const ds = dates(), leaves = leaveSet();
  let h = `<tr><th>名前</th>${ds.map((d) => `<th>${md(d)}<br>(${wday(d)})</th>`).join("")}</tr>`;
  h += state.members.map((m) => `<tr><td>${esc(m.name)}${m.isLeader ? "★" : ""}</td>${ds.map((d) => {
    const off = leaves.has(m.id + "|" + d);
    return `<td class="leave${off ? " off" : ""}" data-m="${m.id}" data-d="${d}">${off ? "休" : ""}</td>`;
  }).join("")}</tr>`).join("");
  $("leaveTable").innerHTML = h;
}
function renderResult() {
  const ds = dates();
  let h = `<tr><th>日付</th>${state.shifts.map((s) => {
    const st = stationName(s.stationId);
    return `<th>${esc(s.name)}${st ? `(${esc(st)})` : ""}<br><span class="hint">${esc(s.time)} ${s.need}人${s.needLeader ? `(責${s.needLeader})` : ""}</span></th>`;
  }).join("")}</tr>`;
  h += ds.map((d) => `<tr><td>${md(d)}(${wday(d)})</td>${state.shifts.map((s) => {
    const ids = state.result[d + "|" + s.id] || [];
    const chips = ids.map((id) => {
      const m = memberById(id); if (!m) return "";
      return `<span class="chip${m.isLeader ? " leader" : ""}">${esc(m.name)}<button data-rm="${id}" data-d="${d}" data-s="${s.id}">×</button></span>`;
    }).join("");
    const opts = state.members.filter((m) => !ids.includes(m.id))
      .map((m) => `<option value="${m.id}">${esc(m.name)}</option>`).join("");
    const miss = s.need - ids.length;
    return `<td class="${miss > 0 ? "short" : ""}">${chips}${miss > 0 ? `<div>要${miss}</div>` : ""}<select data-add data-d="${d}" data-s="${s.id}"><option value="">+追加</option>${opts}</select></td>`;
  }).join("")}</tr>`).join("");
  $("resultTable").innerHTML = h;
  const cnt = {};
  Object.values(state.result).flat().forEach((id) => (cnt[id] = (cnt[id] || 0) + 1));
  $("summary").textContent = state.members.map((m) => `${m.name}:${cnt[m.id] || 0}回`).join(" ");
}
function renderAll() {
  $("startDate").value = state.period.start;
  $("endDate").value = state.period.end;
  renderMembers(); renderStations(); renderShifts(); renderLeave(); renderResult();
}

// --- イベント (委譲で最小化)
$("startDate").onchange = (e) => { state.period.start = e.target.value; save(); renderLeave(); renderResult(); };
$("endDate").onchange = (e) => { state.period.end = e.target.value; save(); renderLeave(); renderResult(); };
$("btnAddMember").onclick = () => {
  const v = $("memberName").value.trim(); if (!v) return;
  state.members.push({ id: uid(), name: v, isLeader: false, stationIds: state.stations.map((t) => t.id) });
  $("memberName").value = ""; save(); renderAll();
};
$("btnAddStation").onclick = () => {
  const v = $("stationName").value.trim(); if (!v) return;
  const id = uid();
  state.stations.push({ id, name: v });
  // 新持ち場は全員担当可で開始 (外すのはチェックで)
  state.members.forEach((m) => { (m.stationIds ||= []).includes(id) || m.stationIds.push(id); });
  $("stationName").value = ""; save(); renderAll();
};
$("stationList").onclick = (e) => {
  if (e.target.dataset.act !== "del") return;
  const id = e.target.closest("[data-id]")?.dataset.id; if (!id) return;
  state.stations = state.stations.filter((t) => t.id !== id);
  const first = state.stations[0]?.id || "";
  state.shifts.forEach((s) => { if (!state.stations.some((t) => t.id === s.stationId)) s.stationId = first; });
  state.members.forEach((m) => (m.stationIds = (m.stationIds || []).filter((x) => x !== id)));
  save(); renderAll();
};
$("stationList").onchange = (e) => {
  if (e.target.dataset.k !== "name") return;
  const t = state.stations.find((x) => x.id === e.target.closest("[data-id]")?.dataset.id); if (!t) return;
  t.name = e.target.value; save(); renderAll();
};
$("btnAddShift").onclick = () => {
  state.shifts.push({ id: uid(), name: "新番", time: "9:00-12:00", need: 1, needLeader: 0, stationId: state.stations[0]?.id || "" });
  save(); renderAll();
};
$("memberList").onclick = (e) => {
  if (e.target.dataset.act !== "del") return;
  const row = e.target.closest(".mrow"); if (!row) return;
  const m = memberById(row.dataset.id); if (!m) return;
  state.members = state.members.filter((x) => x.id !== m.id);
  state.leaves = state.leaves.filter((k) => !k.startsWith(m.id + "|"));
  save(); renderAll();
};
$("memberList").onchange = (e) => {
  const row = e.target.closest(".mrow"); if (!row) return;
  const m = memberById(row.dataset.id); if (!m) return;
  if (e.target.dataset.k === "isLeader") m.isLeader = e.target.checked;
  else if (e.target.dataset.k === "name") m.name = e.target.value;
  else if (e.target.dataset.k === "station") {
    m.stationIds ||= [];
    if (e.target.checked) { if (!m.stationIds.includes(e.target.value)) m.stationIds.push(e.target.value); }
    else m.stationIds = m.stationIds.filter((id) => id !== e.target.value);
  }
  else return;
  save(); renderAll();
};
$("shiftList").onclick = (e) => {
  if (e.target.dataset.act !== "del") return;
  const row = e.target.closest(".srow"); if (!row) return;
  state.shifts = state.shifts.filter((x) => x.id !== row.dataset.id);
  save(); renderShifts(); renderResult();
};
$("shiftList").onchange = (e) => {
  const row = e.target.closest(".srow"); if (!row) return;
  const s = state.shifts.find((x) => x.id === row.dataset.id); if (!s) return;
  if (e.target.dataset.k === "name") s.name = e.target.value;
  else if (e.target.dataset.k === "time") s.time = e.target.value;
  else if (e.target.dataset.k === "stationId") s.stationId = e.target.value;
  else if (e.target.dataset.k === "need") s.need = Math.max(1, +e.target.value || 1);
  else if (e.target.dataset.k === "needLeader") s.needLeader = Math.max(0, +e.target.value || 0);
  else return;
  save(); renderShifts(); renderResult();
};
$("leaveTable").onclick = (e) => {
  const td = e.target.closest("td.leave"); if (!td) return;
  const k = td.dataset.m + "|" + td.dataset.d;
  const set = leaveSet();
  set.has(k) ? set.delete(k) : set.add(k);
  state.leaves = [...set]; save(); renderLeave();
};
$("resultTable").onchange = $("resultTable").onclick = (e) => {
  if (e.target.dataset.rm) {
    const { rm, d, s } = e.target.dataset;
    state.result[d + "|" + s] = (state.result[d + "|" + s] || []).filter((id) => id !== rm);
    save(); renderResult();
  } else if (e.target.dataset.add !== undefined && e.target.value) {
    const { d, s } = e.target.dataset;
    (state.result[d + "|" + s] ||= []).push(e.target.value);
    save(); renderResult();
  }
};
$("btnAuto").onclick = autoAssign;
// 結果表をPNG保存。SVG foreignObject→canvasで依存なし。select/×は除外して出力。
$("btnPng").onclick = async () => {
  const el = $("resultTable");
  const w = el.scrollWidth, h = el.scrollHeight;
  // ponytail: 左右上16px・下28px固定、15日分まで一枚絵
  const PX = 16, PT = 16, PB = 28, W = w + PX * 2, H = h + PT + PB;
  const clone = el.cloneNode(true);
  clone.querySelectorAll("select,button").forEach((n) => n.remove());
  let css = "table{border-collapse:collapse;font-size:13px}th,td{border:1px solid #999;padding:4px 6px;background:#fff}th{background:#eee}";
  try { css = await fetch("css/style.css").then((r) => r.text()); } catch {}
  // outerHTMLは<br>等がXML不正になるためXMLSerializerで直列化する
  const tableXml = new XMLSerializer().serializeToString(clone);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><foreignObject x="${PX}" y="${PT}" width="${w}" height="${h}"><div xmlns="http://www.w3.org/1999/xhtml"><style>${css.replaceAll("&", "&amp;")}</style>${tableXml}</div></foreignObject></svg>`;
  const img = new Image();
  img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
  try { await img.decode(); }
  catch { alert("PNG化に失敗しました"); return; }
  const c = document.createElement("canvas"); c.width = W * 2; c.height = H * 2;
  const x = c.getContext("2d"); x.scale(2, 2);
  x.fillStyle = "#fff"; x.fillRect(0, 0, W, H); x.drawImage(img, PX, PT, w, h);
  Object.assign(document.createElement("a"), { download: "shift.png", href: c.toDataURL("image/png") }).click();
};
$("btnReset").onclick = () => { if (confirm("初期化しますか?")) { state = defaultState(); save(); renderAll(); } };
$("btnCsv").onclick = async () => {
  const rows = [["日付", ...state.shifts.flatMap((s) => [s.name, s.time])]];
  dates().forEach((d) => rows.push([`${d}(${wday(d)})`, ...state.shifts.flatMap((s) =>
    [(state.result[d + "|" + s.id] || []).map((id) => memberById(id)?.name || "").join("・") || "不足", ""])]));
  const csv = rows.map((r) => r.map((c) => `"${String(c).replaceAll('"', '""')}"`).join(",")).join("\n");
  try { await navigator.clipboard.writeText(csv); alert("CSVをコピーしました"); }
  catch { prompt("コピーしてください", csv); }
};

renderAll();
