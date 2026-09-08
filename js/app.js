"use strict";
const KEY = "shift-spa-v1";
const APP_VERSION = "1.3.0";
const $ = (id) => document.getElementById(id);
const $input = (id) => document.getElementById(id);
const tgt = (e) => e.target;
const uid = () => Math.random().toString(36).slice(2, 9);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
function todayPlus(n) {
    const d = new Date();
    d.setDate(d.getDate() + n);
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
        leaves: [],
        avail: {},
        result: {},
    };
}
let state;
try {
    state = JSON.parse(localStorage.getItem(KEY)) || defaultState();
}
catch {
    state = defaultState();
}
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
// v1保存データに希望時間がなければ付与
if (!state.avail) {
    state.avail = {};
    save();
}
function dates() {
    const out = [];
    if (!state.period.start || !state.period.end)
        return out;
    const d = new Date(state.period.start + "T00:00:00");
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
// --- 希望時間判定: "H:MM"→分、"H:MM-H:MM"→[from,to]。不正・片側空はnull=制約なし扱い
function toMin(t) {
    const m = /^(\d{1,2}):(\d{2})$/.exec(t.trim());
    if (!m)
        return null;
    const h = +m[1], mi = +m[2];
    if (h > 23 || mi > 59)
        return null;
    return h * 60 + mi;
}
function parseRange(s) {
    const p = String(s).split("-");
    if (p.length !== 2)
        return null;
    const a = toMin(p[0]), b = toMin(p[1]);
    if (a === null || b === null || a >= b)
        return null;
    return [a, b];
}
// 希望時間とシフト枠の重なり分数。希望なし=枠全体、枠の時刻不明=0(全員同列)
function overlapMin(memberId, date, shiftTime) {
    const s = parseRange(shiftTime);
    if (!s)
        return 0;
    const r = parseRange(state.avail?.[memberId + "|" + date] || "");
    if (!r)
        return s[1] - s[0];
    return Math.max(0, Math.min(r[1], s[1]) - Math.max(r[0], s[0]));
}
// 重なりがあれば割付可。希望なし・時刻の読めない枠は可とする
function fitsAvail(memberId, date, shiftTime) {
    if (!parseRange(shiftTime))
        return true;
    return overlapMin(memberId, date, shiftTime) > 0;
}
// --- 自動割付: 日付順の貪欲1パス。休み・希望時間と重ならない人除外→責任者優先→回数少→重なり大→前日非勤務→ランダム
function autoAssign() {
    const ds = dates(), counts = {}, result = {};
    state.members.forEach((m) => (counts[m.id] = 0));
    const leaves = leaveSet();
    let prevDay = new Set();
    for (const date of ds) {
        const assignedToday = new Set();
        for (const s of state.shifts) {
            const key = date + "|" + s.id;
            const cand = (onlyLeader) => state.members
                .filter((m) => !leaves.has(m.id + "|" + date) && !assignedToday.has(m.id) && fitsAvail(m.id, date, s.time))
                .filter((m) => !s.stationId || (m.stationIds || []).includes(s.stationId))
                .filter((m) => (onlyLeader ? m.isLeader : true))
                .sort((a, b) => counts[a.id] - counts[b.id] || overlapMin(b.id, date, s.time) - overlapMin(a.id, date, s.time) || (prevDay.has(a.id) ? 1 : 0) - (prevDay.has(b.id) ? 1 : 0) || Math.random() - 0.5);
            const picked = [];
            cand(true).slice(0, Math.min(s.needLeader, s.need)).forEach((m) => { picked.push(m.id); assignedToday.add(m.id); });
            cand(false).slice(0, s.need - picked.length).forEach((m) => { picked.push(m.id); assignedToday.add(m.id); });
            picked.forEach((id) => counts[id]++);
            result[key] = picked;
        }
        prevDay = assignedToday;
    }
    state.result = result;
    save();
    renderResult();
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
        const k = m.id + "|" + d;
        const off = leaves.has(k);
        const [af, at] = String(state.avail?.[k] || "").split("-");
        return `<td class="leave${off ? " off" : ""}">` +
            `<input type="time" step="3600" data-av="from" data-m="${m.id}" data-d="${d}" value="${esc(af || "")}" title="開始" ${off ? "disabled" : ""}>` +
            `<span>〜</span><input type="time" step="3600" data-av="to" data-m="${m.id}" data-d="${d}" value="${esc(at || "")}" title="終了" ${off ? "disabled" : ""}>` +
            `<button data-off data-m="${m.id}" data-d="${d}" title="休み切替">${off ? "消" : "休"}</button></td>`;
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
            const m = memberById(id);
            if (!m)
                return "";
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
    $input("startDate").value = state.period.start;
    $input("endDate").value = state.period.end;
    renderMembers();
    renderStations();
    renderShifts();
    renderLeave();
    renderResult();
}
// --- イベント (委譲で最小化)
$("startDate").onchange = (e) => { state.period.start = e.target.value; save(); renderLeave(); renderResult(); };
$("endDate").onchange = (e) => { state.period.end = e.target.value; save(); renderLeave(); renderResult(); };
$("btnAddMember").onclick = () => {
    const v = $input("memberName").value.trim();
    if (!v)
        return;
    state.members.push({ id: uid(), name: v, isLeader: false, stationIds: state.stations.map((t) => t.id) });
    $input("memberName").value = "";
    save();
    renderAll();
};
$("btnAddStation").onclick = () => {
    const v = $input("stationName").value.trim();
    if (!v)
        return;
    const id = uid();
    state.stations.push({ id, name: v });
    // 新持ち場は全員担当可で開始 (外すのはチェックで)
    state.members.forEach((m) => { (m.stationIds ||= []).includes(id) || m.stationIds.push(id); });
    $input("stationName").value = "";
    save();
    renderAll();
};
$("stationList").onclick = (e) => {
    const t = tgt(e);
    if (t.dataset["act"] !== "del")
        return;
    const id = t.closest("[data-id]")?.dataset["id"];
    if (!id)
        return;
    state.stations = state.stations.filter((x) => x.id !== id);
    const first = state.stations[0]?.id || "";
    state.shifts.forEach((s) => { if (!state.stations.some((x) => x.id === s.stationId))
        s.stationId = first; });
    state.members.forEach((m) => (m.stationIds = (m.stationIds || []).filter((x) => x !== id)));
    save();
    renderAll();
};
$("stationList").onchange = (e) => {
    const t = tgt(e);
    if (t.dataset["k"] !== "name")
        return;
    const st = state.stations.find((x) => x.id === t.closest("[data-id]")?.dataset["id"]);
    if (!st)
        return;
    st.name = t.value;
    save();
    renderAll();
};
$("btnAddShift").onclick = () => {
    state.shifts.push({ id: uid(), name: "新番", time: "9:00-12:00", need: 1, needLeader: 0, stationId: state.stations[0]?.id || "" });
    save();
    renderAll();
};
$("memberList").onclick = (e) => {
    const t = tgt(e);
    if (t.dataset["act"] !== "del")
        return;
    const row = t.closest(".mrow");
    if (!row?.dataset["id"])
        return;
    const m = memberById(row.dataset["id"]);
    if (!m)
        return;
    state.members = state.members.filter((x) => x.id !== m.id);
    state.leaves = state.leaves.filter((k) => !k.startsWith(m.id + "|"));
    if (state.avail)
        Object.keys(state.avail).forEach((k) => { if (k.startsWith(m.id + "|"))
            delete state.avail[k]; });
    save();
    renderAll();
};
$("memberList").onchange = (e) => {
    const t = tgt(e);
    const row = t.closest(".mrow");
    if (!row?.dataset["id"])
        return;
    const m = memberById(row.dataset["id"]);
    if (!m)
        return;
    const inp = t;
    if (t.dataset["k"] === "isLeader")
        m.isLeader = inp.checked;
    else if (t.dataset["k"] === "name")
        m.name = inp.value;
    else if (t.dataset["k"] === "station") {
        m.stationIds ||= [];
        if (inp.checked) {
            if (!m.stationIds.includes(inp.value))
                m.stationIds.push(inp.value);
        }
        else
            m.stationIds = m.stationIds.filter((id) => id !== inp.value);
    }
    else
        return;
    save();
    renderAll();
};
$("shiftList").onclick = (e) => {
    const t = tgt(e);
    if (t.dataset["act"] !== "del")
        return;
    const row = t.closest(".srow");
    if (!row)
        return;
    state.shifts = state.shifts.filter((x) => x.id !== row.dataset["id"]);
    save();
    renderShifts();
    renderResult();
};
$("shiftList").onchange = (e) => {
    const t = tgt(e);
    const row = t.closest(".srow");
    if (!row)
        return;
    const s = state.shifts.find((x) => x.id === row.dataset["id"]);
    if (!s)
        return;
    const v = t.value;
    if (t.dataset["k"] === "name")
        s.name = v;
    else if (t.dataset["k"] === "time")
        s.time = v;
    else if (t.dataset["k"] === "stationId")
        s.stationId = v;
    else if (t.dataset["k"] === "need")
        s.need = Math.max(1, +v || 1);
    else if (t.dataset["k"] === "needLeader")
        s.needLeader = Math.max(0, +v || 0);
    else
        return;
    save();
    renderShifts();
    renderResult();
};
$("leaveTable").onclick = (e) => {
    const btn = tgt(e).closest("[data-off]");
    if (!btn)
        return;
    const k = (btn.dataset["m"] ?? "") + "|" + (btn.dataset["d"] ?? "");
    const set = leaveSet();
    set.has(k) ? set.delete(k) : set.add(k);
    state.leaves = [...set];
    save();
    renderLeave();
};
$("leaveTable").onchange = (e) => {
    const inp = tgt(e);
    if (!inp.dataset["av"] || !inp.dataset["m"] || !inp.dataset["d"])
        return;
    const k = inp.dataset["m"] + "|" + inp.dataset["d"];
    const cur = String(state.avail?.[k] || "").split("-");
    const from = inp.dataset["av"] === "from" ? inp.value : (cur[0] || "");
    const to = inp.dataset["av"] === "to" ? inp.value : (cur[1] || "");
    state.avail ||= {};
    if (!from && !to)
        delete state.avail[k];
    else
        state.avail[k] = `${from}-${to}`;
    save(); // 再描画しない (入力フォーカス維持)
};
($("resultTable").onchange = $("resultTable").onclick = (e) => {
    const t = tgt(e);
    if (t.dataset["rm"]) {
        const { rm, d, s } = t.dataset;
        if (!rm || !d || !s)
            return;
        state.result[d + "|" + s] = (state.result[d + "|" + s] || []).filter((id) => id !== rm);
        save();
        renderResult();
    }
    else if (t.dataset["add"] !== undefined && t.value) {
        const { d, s } = t.dataset;
        if (!d || !s)
            return;
        (state.result[d + "|" + s] ||= []).push(t.value);
        save();
        renderResult();
    }
});
$("btnAuto").onclick = autoAssign;
// --- PNG出力: 表をcanvasに直接描画。SVG foreignObject経由はChromeで汚染taintのため不使用。
const PNG_FONT = "13px system-ui, sans-serif";
const PNG_PX = 16, PNG_PT = 16, PNG_PB = 28; // ponytail: 余白固定
function cellText(d, s) {
    const ids = state.result[d + "|" + s.id] || [];
    const names = ids.map((id) => memberById(id)?.name || "").filter(Boolean).join("・") || "不足";
    const miss = s.need - ids.length;
    return { top: names, bottom: miss > 0 ? `要${miss}` : "", short: miss > 0 };
}
function tableLayout(measure) {
    const ds = dates();
    const headTop = ["日付", ...state.shifts.map((s) => `${s.name}${stationName(s.stationId) ? `(${stationName(s.stationId)})` : ""}`)];
    const headBot = ["", ...state.shifts.map((s) => `${s.time} ${s.need}人${s.needLeader ? `(責${s.needLeader})` : ""}`)];
    const body = ds.map((d) => ({ date: `${md(d)}(${wday(d)})`, cells: state.shifts.map((s) => cellText(d, s)) }));
    const widths = headTop.map((_, c) => {
        const texts = c === 0
            ? [headTop[0], ...body.map((r) => r.date)]
            : [headTop[c], headBot[c], ...body.map((r) => r.cells[c - 1].top), ...body.map((r) => r.cells[c - 1].bottom)];
        return Math.ceil(Math.max(0, ...texts.map(measure))) + 12;
    });
    const headerH = 40, rowH = 36;
    return { widths, headerH, rowH, W: widths.reduce((a, b) => a + b, 0) + PNG_PX * 2, H: PNG_PT + headerH + rowH * ds.length + PNG_PB };
}
function drawTable(ctx, L) {
    const ds = dates();
    ctx.font = PNG_FONT;
    ctx.textBaseline = "middle";
    ctx.textAlign = "center";
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, L.W, L.H);
    const xs = [PNG_PX];
    L.widths.forEach((w) => xs.push(xs[xs.length - 1] + w));
    const cx = (c) => (xs[c] + xs[c + 1]) / 2;
    // ヘッダ
    ctx.fillStyle = "#eee";
    ctx.fillRect(PNG_PX, PNG_PT, L.W - PNG_PX * 2, L.headerH);
    ctx.fillStyle = "#000";
    ctx.fillText("日付", cx(0), PNG_PT + 13);
    state.shifts.forEach((s, i) => {
        const st = stationName(s.stationId);
        ctx.fillText(`${s.name}${st ? `(${st})` : ""}`, cx(i + 1), PNG_PT + 13);
        ctx.fillStyle = "#555";
        ctx.fillText(`${s.time} ${s.need}人${s.needLeader ? `(責${s.needLeader})` : ""}`, cx(i + 1), PNG_PT + 29);
        ctx.fillStyle = "#000";
    });
    // 本体
    ds.forEach((d, r) => {
        const y = PNG_PT + L.headerH + r * L.rowH;
        ctx.fillStyle = "#000";
        ctx.fillText(`${md(d)}(${wday(d)})`, cx(0), y + L.rowH / 2);
        state.shifts.forEach((s, i) => {
            const ct = cellText(d, s);
            ctx.fillStyle = ct.short ? "#dc2626" : "#000";
            ctx.fillText(ct.top, cx(i + 1), y + 12);
            if (ct.bottom)
                ctx.fillText(ct.bottom, cx(i + 1), y + 26);
        });
    });
    // 罫線
    ctx.strokeStyle = "#999";
    ctx.lineWidth = 1;
    ctx.beginPath();
    xs.forEach((x) => { ctx.moveTo(x, PNG_PT); ctx.lineTo(x, L.H - PNG_PB); });
    ctx.moveTo(PNG_PX, PNG_PT);
    ctx.lineTo(L.W - PNG_PX, PNG_PT);
    ctx.moveTo(PNG_PX, PNG_PT + L.headerH);
    ctx.lineTo(L.W - PNG_PX, PNG_PT + L.headerH);
    ds.forEach((_, r) => {
        const y = PNG_PT + L.headerH + (r + 1) * L.rowH;
        ctx.moveTo(PNG_PX, y);
        ctx.lineTo(L.W - PNG_PX, y);
    });
    ctx.stroke();
}
// 遷移・data URLなし。進捗と失敗理由はあらかじめ用意した枠内に表示する。
$("btnPng").onclick = async () => {
    const card = $("pngCard"), img = $("pngImg"), msg = $("pngMsg");
    const say = (t) => { msg.textContent = t; };
    card.hidden = false;
    try {
        say("生成中…");
        const c = document.createElement("canvas");
        const meas = c.getContext("2d");
        meas.font = PNG_FONT;
        const L = tableLayout((t) => meas.measureText(t).width);
        c.width = L.W * 2;
        c.height = L.H * 2; // 2倍解像度
        const ctx = c.getContext("2d");
        ctx.scale(2, 2);
        drawTable(ctx, L);
        // 文字と罫線のみの描画のため汚染なし。全ブラウザでtoBlob可。
        const blob = await new Promise((res) => c.toBlob(res, "image/png"));
        if (!blob)
            throw new Error("PNG化に失敗");
        // PCは自動ダウンロード、タッチ端末は共有シート→不可なら枠内に表示(長押し保存)
        if (!matchMedia("(pointer: coarse)").matches) {
            Object.assign(document.createElement("a"), { download: "shift.png", href: URL.createObjectURL(blob) }).click();
            say("ダウンロードを開始しました");
            return;
        }
        try {
            const file = new File([blob], "shift.png", { type: "image/png" });
            if (navigator.canShare?.({ files: [file] })) {
                await navigator.share({ files: [file], title: "シフト表" });
                say("共有シートを開きました");
                return;
            }
        }
        catch { }
        if (pngUrl)
            URL.revokeObjectURL(pngUrl);
        pngUrl = URL.createObjectURL(blob);
        img.src = pngUrl;
        say("画像を長押し → 「写真に追加」で保存できます");
    }
    catch (e) {
        say(`失敗: ${e instanceof Error ? e.message : String(e)}`);
    }
    card.scrollIntoView();
};
let pngUrl = "";
$("btnPngClose").onclick = () => {
    $("pngCard").hidden = true;
    if (pngUrl) {
        URL.revokeObjectURL(pngUrl);
        pngUrl = "";
    }
};
$("btnReset").onclick = () => { if (confirm("初期化しますか?")) {
    state = defaultState();
    save();
    renderAll();
} };
$("btnCsv").onclick = async () => {
    const rows = [["日付", ...state.shifts.flatMap((s) => [s.name, s.time])]];
    dates().forEach((d) => rows.push([`${d}(${wday(d)})`, ...state.shifts.flatMap((s) => [(state.result[d + "|" + s.id] || []).map((id) => memberById(id)?.name || "").join("・") || "不足", ""])]));
    const csv = rows.map((r) => r.map((c) => `"${String(c).replaceAll('"', '""')}"`).join(",")).join("\n");
    try {
        await navigator.clipboard.writeText(csv);
        alert("CSVをコピーしました");
    }
    catch {
        prompt("コピーしてください", csv);
    }
};
$("appVer").textContent = "v" + APP_VERSION;
renderAll();
