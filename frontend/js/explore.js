/* Explore page: category cards + chip filters + photo cards + map + insights.
   Client-side cross-filtering preserved from the original dashboard model. */
"use strict";

const state = {
  meta: null, parks: [], map: null, markers: new Map(),
  charts: {},
  f: { q: "", types: new Set(), ages: new Set(), facs: new Set(),
       cond: "", surface: "", extent: true, selected: null },
};

init().catch((e) => {
  document.getElementById("park-list").innerHTML =
    `<p class="notice err">Could not load data. Is the server running?<br><small>${escapeHtml(e.message)}</small></p>`;
});

async function init() {
  state.meta = await API.get("/api/meta");
  state.map = makeBaseMap(document.getElementById("map"), state.meta);
  state.map.on("moveend", () => { if (state.f.extent) render(); });

  buildTypeChips();
  buildAgeChips();
  fillSelect("f-cond", state.meta.conditions);
  fillSelect("f-surface", state.meta.surfaces);
  wireControls();
  wireCategoryCards();

  state.parks = await API.get("/api/parks");
  buildMarkers();
  render();
}

function buildTypeChips() {
  const wrap = document.getElementById("type-chips");
  wrap.innerHTML = state.meta.location_types.map((t) =>
    `<button class="chip" data-t="${t}" aria-pressed="false"><span class="ms" aria-hidden="true">${locIcon(t)}</span> ${locLabel(t)}s</button>`
  ).join("");
  wrap.querySelectorAll(".chip").forEach((b) => b.addEventListener("click", () => {
    toggleSet(state.f.types, b.dataset.t);
    b.setAttribute("aria-pressed", state.f.types.has(b.dataset.t));
    state.f.selected = null; render();
  }));
}

function buildAgeChips() {
  const wrap = document.getElementById("age-chips");
  wrap.innerHTML = state.meta.age_groups.map((a) =>
    `<button class="chip" data-a="${escapeHtml(a)}" aria-pressed="false"><span class="dot" style="background:${AGE_COLORS[a]}"></span> ${AGE_SHORT[a] || a}</button>`
  ).join("");
  wrap.querySelectorAll(".chip").forEach((b) => b.addEventListener("click", () => {
    toggleSet(state.f.ages, b.dataset.a);
    b.setAttribute("aria-pressed", state.f.ages.has(b.dataset.a));
    state.f.selected = null; render();
  }));
}

function fillSelect(id, values) {
  const sel = document.getElementById(id);
  values.forEach((v) => sel.append(new Option(v, v)));
}

function wireControls() {
  document.getElementById("f-q").addEventListener("input", (e) => {
    state.f.q = e.target.value.trim().toLowerCase(); state.f.selected = null; render();
  });
  document.getElementById("f-cond").addEventListener("change", (e) => {
    state.f.cond = e.target.value; state.f.selected = null; render();
  });
  document.getElementById("f-surface").addEventListener("change", (e) => {
    state.f.surface = e.target.value; state.f.selected = null; render();
  });
  document.getElementById("f-extent").addEventListener("change", (e) => {
    state.f.extent = e.target.checked; render();
  });
  document.querySelectorAll("#fac-chips .chip").forEach((b) => b.addEventListener("click", () => {
    toggleSet(state.f.facs, b.dataset.f);
    b.setAttribute("aria-pressed", state.f.facs.has(b.dataset.f));
    state.f.selected = null; render();
  }));
  document.getElementById("clear-filters").addEventListener("click", clearFilters);
}

function wireCategoryCards() {
  document.querySelectorAll(".cat-card").forEach((card) => card.addEventListener("click", () => {
    clearFilters();
    const t = card.dataset.cat;
    state.f.types.add(t);
    const chip = document.querySelector(`#type-chips .chip[data-t="${t}"]`);
    if (chip) chip.setAttribute("aria-pressed", "true");
    render();
  }));
}

function clearFilters() {
  state.f = { ...state.f, q: "", types: new Set(), ages: new Set(), facs: new Set(),
              cond: "", surface: "", selected: null };
  document.getElementById("f-q").value = "";
  document.getElementById("f-cond").value = "";
  document.getElementById("f-surface").value = "";
  document.querySelectorAll(".chip[aria-pressed]").forEach((b) => b.setAttribute("aria-pressed", "false"));
  render();
}

function toggleSet(set, v) { set.has(v) ? set.delete(v) : set.add(v); }

/* ---- Filtering ------------------------------------------------------------ */
function parkMatches(p, bounds) {
  if (state.f.selected && p.id !== state.f.selected) return false;
  if (state.f.q && !p.name.toLowerCase().includes(state.f.q)) return false;
  if (state.f.types.size && !state.f.types.has(p.location_type)) return false;
  if (state.f.surface && p.surfacing_material !== state.f.surface) return false;
  if (state.f.ages.size &&
      !(p.age_groups_present || []).some((a) => state.f.ages.has(a))) return false;
  if (state.f.cond && !(p.equipment || []).some((e) => e.condition === state.f.cond)) return false;
  for (const f of state.f.facs) {
    if (f === "accessible" && !isAccessible(p)) return false;
    if (f === "washroom" && p.washroom_nearby !== true) return false;
    if (f === "water" && !(p.water_fountains > 0)) return false;
    if (f === "parking" && p.parking !== true) return false;
    if (f === "shade" && p.shade !== true) return false;
    if (f === "fenced" && p.fenced !== true) return false;
  }
  if (bounds && !bounds.contains([p.lat, p.lng])) return false;
  return true;
}

/* Which equipment counts for charts, honouring age/condition filters. */
function equipmentFor(p) {
  return (p.equipment || []).filter((e) =>
    (!state.f.ages.size || state.f.ages.has(e.age_group)) &&
    (!state.f.cond || e.condition === state.f.cond));
}

/* ---- Map ------------------------------------------------------------------- */
function buildMarkers() {
  for (const p of state.parks) {
    const m = L.marker([p.lat, p.lng], { icon: parkIcon(p, false) })
      .bindPopup(() => popupHtml(p));
    m.on("click", () => selectPark(p.id, { zoom: false }));
    state.markers.set(p.id, m);
  }
}

function selectPark(id, { zoom = true } = {}) {
  state.f.selected = state.f.selected === id ? null : id;
  const p = state.parks.find((x) => x.id === id);
  if (state.f.selected && p) {
    if (zoom) state.map.setView([p.lat, p.lng], Math.max(state.map.getZoom(), 15));
    render();
    const m = state.markers.get(id);
    if (m) { m.setIcon(parkIcon(p, true)); m.openPopup(); }
  } else {
    render();
  }
}

/* ---- Render ----------------------------------------------------------------- */
function render() {
  const bounds = state.f.extent ? state.map.getBounds() : null;
  const visible = state.parks.filter((p) => parkMatches(p, bounds));
  // Markers ignore the extent filter (the map IS the extent):
  const markerVisible = state.parks.filter((p) => parkMatches(p, null));

  for (const p of state.parks) {
    const m = state.markers.get(p.id);
    const show = markerVisible.includes(p);
    if (show && !state.map.hasLayer(m)) m.addTo(state.map);
    if (!show && state.map.hasLayer(m)) m.remove();
    if (show) m.setIcon(parkIcon(p, state.f.selected === p.id));
  }

  renderKpis(visible);
  renderList(visible);
  renderCharts(visible);
}

function renderKpis(parks) {
  const eq = parks.flatMap(equipmentFor).length;
  const acc = parks.filter(isAccessible).length;
  const water = parks.filter((p) => p.water_fountains > 0).length;
  const wash = parks.filter((p) => p.washroom_nearby === true).length;
  const photos = parks.reduce((n, p) => n + (p.photos || []).length, 0);
  document.getElementById("kpis").innerHTML = [
    [parks.length, "Places"], [eq, "Equipment"], [acc, "♿ Accessible"],
    [water, "Water"], [wash, "Washroom"], [photos, "Photos"],
  ].map(([v, l]) => `<div class="kpi"><b>${v}</b><span>${l}</span></div>`).join("");
  document.getElementById("count-pill").textContent = parks.length;
}

function renderList(parks) {
  const wrap = document.getElementById("park-list");
  if (!parks.length) {
    wrap.innerHTML = `<p class="notice info">No places match these filters yet. Try clearing a filter — or <a href="/submit.html">add the first one</a>!</p>`;
    return;
  }
  wrap.innerHTML = parks.slice(0, 60).map((p) => {
    const photo = (p.photos || [])[0];
    const img = photo
      ? `<img src="${photo.thumb_url}" alt="" loading="lazy">`
      : `<span class="ph"><span class="ms" aria-hidden="true">${locIcon(p.location_type)}</span></span>`;
    const chips = [
      `<span class="mini-chip">${locLabel(p.location_type)}</span>`,
      isAccessible(p) ? `<span class="mini-chip a11y"><span class="ms">accessible</span> Access</span>` : "",
      p.washroom_nearby === true ? `<span class="mini-chip ok"><span class="ms">wc</span> WC</span>` : "",
      p.shade === true ? `<span class="mini-chip ok"><span class="ms">park</span> Shade</span>` : "",
    ].filter(Boolean).join("");
    return `<button class="park-card${state.f.selected === p.id ? " selected" : ""}" data-id="${p.id}" role="option" aria-selected="${state.f.selected === p.id}">
      ${img}
      <span>
        <h3>${escapeHtml(p.name)}</h3>
        <span class="sub">${escapeHtml(p.address || p.city || "Ontario")}</span>
        <span class="mini-chips">${chips}</span>
        ${p.location_type === "playground" ? `<span>${shapesFor(p)}</span>` : ""}
      </span>
    </button>`;
  }).join("");
  wrap.querySelectorAll(".park-card").forEach((el) =>
    el.addEventListener("click", () => selectPark(Number(el.dataset.id))));
}

/* Charts (Community Insights, collapsible) */
function renderCharts(parks) {
  const play = parks.filter((p) => p.location_type === "playground" || !p.location_type);
  const byTypeAge = {};
  for (const p of play) for (const e of equipmentFor(p)) {
    (byTypeAge[e.equipment_type] ??= {})[e.age_group] =
      ((byTypeAge[e.equipment_type] ??= {})[e.age_group] || 0) + 1;
  }
  const types = state.meta.equipment_types.filter((t) => byTypeAge[t]);
  upsertChart("chart-type", {
    type: "bar",
    data: {
      labels: types,
      datasets: state.meta.age_groups.map((a) => ({
        label: AGE_SHORT[a] || a,
        data: types.map((t) => byTypeAge[t]?.[a] || 0),
        backgroundColor: AGE_COLORS[a],
      })),
    },
    options: {
      responsive: true, scales: { x: { stacked: true }, y: { stacked: true, ticks: { precision: 0 } } },
      plugins: { legend: { position: "bottom", labels: { boxWidth: 12 } } },
    },
  });

  const byCond = {};
  for (const p of play) for (const e of equipmentFor(p))
    byCond[e.condition] = (byCond[e.condition] || 0) + 1;
  doughnut("chart-cond", state.meta.conditions, byCond,
    state.meta.conditions.map((c) => CONDITION_COLORS[c]));

  const bySurf = {};
  for (const p of parks) if (p.surfacing_material)
    bySurf[p.surfacing_material] = (bySurf[p.surfacing_material] || 0) + 1;
  doughnut("chart-surf", Object.keys(bySurf), bySurf, SURFACE_COLORS);
}

function doughnut(id, labels, counts, colors) {
  const used = labels.filter((l) => counts[l]);
  upsertChart(id, {
    type: "doughnut",
    data: { labels: used, datasets: [{ data: used.map((l) => counts[l]), backgroundColor: colors.slice(0, used.length) }] },
    options: { responsive: true, plugins: { legend: { position: "bottom", labels: { boxWidth: 12 } } } },
  });
}

function upsertChart(id, config) {
  const ctx = document.getElementById(id);
  if (state.charts[id]) {
    state.charts[id].data = config.data;
    state.charts[id].update();
  } else {
    state.charts[id] = new Chart(ctx, config);
  }
}
