const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { loadApp, fire } = require("./helpers/load-app.cjs");

const row = (id) => ({ closest: () => ({ dataset: { id } }) });

describe("CRUD・リセット", () => {
  it("持ち場を追加できる", () => {
    const app = loadApp();
    app.document.getElementById("stationName").value = "惣菜";
    fire(app.registry, "btnAddStation", "onclick");
    assert.equal(app.getState().stations.length, 3);
    assert.ok(app.getState().stations.some((t) => t.name === "惣菜"));
    // 新持ち場は全員担当可で開始
    assert.ok(app.getState().members.every((m) => m.stationIds.length === 3));
  });

  it("持ち場削除で枠の付け替え・メンバーの除外が起きる", () => {
    const app = loadApp();
    const target = app.getState().stations[0];
    assert.ok(app.getState().shifts.some((s) => s.stationId === target.id));
    fire(app.registry, "stationList", "onclick", { dataset: { act: "del" }, ...row(target.id) });
    const st = app.getState();
    assert.equal(st.stations.length, 1);
    assert.ok(st.shifts.every((s) => s.stationId === st.stations[0].id));
    assert.ok(st.members.every((m) => !m.stationIds.includes(target.id)));
  });

  it("シフト枠を追加できる", () => {
    const app = loadApp();
    fire(app.registry, "btnAddShift", "onclick");
    const st = app.getState();
    assert.equal(st.shifts.length, 4);
    assert.equal(st.shifts[3].stationId, st.stations[0].id);
  });

  it("メンバー追加・削除 (削除時は休みも消える)", () => {
    const app = loadApp();
    app.document.getElementById("memberName").value = "高橋";
    fire(app.registry, "btnAddMember", "onclick");
    assert.equal(app.getState().members.length, 4);

    const m = app.getState().members[0];
    app.getState().leaves.push(m.id + "|2026-09-01");
    fire(app.registry, "memberList", "onclick", { dataset: { act: "del" }, ...row(m.id) });
    const st = app.getState();
    assert.ok(!st.members.some((x) => x.id === m.id));
    assert.ok(st.leaves.every((k) => !k.startsWith(m.id + "|")));
  });

  it("空名のメンバー・持ち場は追加されない", () => {
    const app = loadApp();
    app.document.getElementById("memberName").value = "   ";
    fire(app.registry, "btnAddMember", "onclick");
    app.document.getElementById("stationName").value = "";
    fire(app.registry, "btnAddStation", "onclick");
    assert.equal(app.getState().members.length, 3);
    assert.equal(app.getState().stations.length, 2);
  });

  it("リセットで初期状態に戻る", () => {
    const app = loadApp();
    fire(app.registry, "btnAddShift", "onclick");
    fire(app.registry, "btnAddStation", "onclick");
    fire(app.registry, "btnReset", "onclick");
    const st = app.getState();
    assert.equal(st.shifts.length, 3);
    assert.equal(st.stations.length, 2);
    assert.equal(st.members.length, 3);
  });
});
