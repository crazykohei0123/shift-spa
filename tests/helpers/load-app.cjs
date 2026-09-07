// ビルド済み js/app.js をDOMスタブで読み込み、検証用APIを返す
const fs = require("fs");
const path = require("path");

const SRC = fs.readFileSync(path.join(__dirname, "..", "..", "js", "app.js"), "utf8");

function mkEl(id) {
  return {
    id,
    innerHTML: "",
    textContent: "",
    value: "",
    checked: false,
    dataset: {},
    onclick: null,
    onchange: null,
    scrollWidth: 800,
    scrollHeight: 600,
    closest: () => null,
    querySelectorAll: () => [],
    cloneNode: () => ({ querySelectorAll: () => [] }),
  };
}

// seed: localStorageに事前投入するJSON文字列 (省略時は空=初期状態)
function loadApp(seed) {
  const store = seed === undefined ? {} : { "shift-spa-v1": seed };
  const localStorage = {
    getItem: (k) => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
  };
  const registry = {};
  const document = {
    getElementById: (id) => (registry[id] ||= mkEl(id)),
    createElement: (tag) => mkEl(tag),
  };
  const factory = new Function(
    "document", "localStorage", "confirm", "alert", "prompt", "fetch",
    SRC + "\nreturn { getState: () => state, dates, autoAssign, renderAll };"
  );
  const api = factory(
    document, localStorage,
    () => true, () => {}, () => null,
    async () => ({ text: async () => "" })
  );
  return { ...api, registry, document, store };
}

// ハンドラ発火 (click/change)。targetは必要分だけ上書き
function fire(registry, id, type, target = {}) {
  const el = registry[id];
  if (!el || typeof el[type] !== "function") throw new Error(`no handler: ${id}.${type}`);
  el[type]({ target: { dataset: {}, closest: () => null, checked: false, value: "", ...target } });
}

module.exports = { loadApp, fire };
