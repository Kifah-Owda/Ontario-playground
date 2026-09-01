/* Explore page: category cards + chip filters + photo cards + map + insights.
   Client-side cross-filtering preserved from the original dashboard model. */
"use strict";

const state = {
  meta: null, parks: [], map: null, markers: new Map(),
  charts: {},
  /* `selected` is deliberately NOT a filter — it only sorts a park to the top
     of the list, highlights it, and opens its popup. It used to short-circuit
     parkMatches(), which made every other park fail and emptied the map. */
  f: { q: "", types: new Set(), ages: new Set(), facs: new Set(),
       cond: "", surface: "", selected: null },
};

init().catch((e) => {
  document.getElementById("park-list").innerHTML =
    `<p class="notice err">Could not load data. Is the server running?<br><small>${escapeHtml(e.message)}</small></p>`;
});

async function init() {
  state.meta = await API.get("/api/meta");
  state.map = makeBaseMap(document.getElementById("map"), state.meta);
  // Stitch supplies its own floating controls, and the attribution has to move
  // out of the bottom-right corner to make room for them.
  state.map.zoomControl.remove();
  state.map.attributionControl.setPosition("bottomleft");
  wireMapControls();
  state.map.on("moveend", render);
  // Clicking bare map (not a marker) clears the selection.
  state.map.on("click", () => setSelected(null));
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") setSelected(null);
  });

  buildTypeChips();
  buildAgeChips();
  fillSelect("f-cond", state.meta.conditions);
  fillSelect("f-surface", state.meta.surfaces);
  wireControls();
  wireFilterCollapse();
  applyUrlFilters();

  state.parks = await API.get("/api/parks");
  buildMarkers();
  render();
}

function buildTypeChips() {
  const wrap = document.getElementById("type-chips");
  wrap.innerHTML = state.meta.location_types.map((t) =>
    `<button class="chip" data-t="${t}" aria-pressed="false"><span class="ms" aria-hidden="true">${locIcon(t)}</span> ${locPlural(t)}</button>`
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
    `<button class="chip chip-sm chip-age age-${AGE_KEY[a] || "t"}" data-a="${escapeHtml(a)}" aria-pressed="false">${AGE_SHORT[a] || a}</button>`
  ).join("");
  wrap.querySelectorAll(".chip").forEach((b) => b.addEventListener("click", () => {
    toggleSet(state.f.ages, b.dataset.a);
    b.setAttribute("aria-pressed", state.f.ages.has(b.dataset.a));
    state.f.selected = null; render();
  }));
}

/* The filter panel is a <details>. Below the stacking breakpoint it collapses
   so search and the map are reachable without scrolling past every chip; above
   it, it is forced open and its summary is hidden by CSS. */
function wireFilterCollapse() {
  const card = document.getElementById("filter-card");
  if (!card) return;
  const mq = matchMedia("(max-width: 900px)");
  const sync = () => { card.open = !mq.matches; };
  sync();
  mq.addEventListener("change", sync);
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
  document.querySelectorAll("#fac-chips .fac-btn").forEach((b) => b.addEventListener("click", () => {
    toggleSet(state.f.facs, b.dataset.f);
    b.setAttribute("aria-pressed", state.f.facs.has(b.dataset.f));
    state.f.selected = null; render();
  }));
  // Water fountain moved under "More filters" — same facs set, checkbox UI.
  document.getElementById("f-water").addEventListener("change", (e) => {
    e.target.checked ? state.f.facs.add("water") : state.f.facs.delete("water");
    state.f.selected = null; render();
  });
  document.getElementById("clear-filters").addEventListener("click", clearFilters);
}

/* The landing page's category cards link here as /explore.html?type=beach, so
   arriving with a type pre-selects the matching chip. Unknown values are
   ignored rather than producing an empty result set with no visible cause. */
function applyUrlFilters() {
  const wanted = new URLSearchParams(location.search).getAll("type");
  const valid = wanted.filter((t) => state.meta.location_types.includes(t));
  if (!valid.length) return;

  valid.forEach((t) => {
    state.f.types.add(t);
    const chip = document.querySelector(`#type-chips .chip[data-t="${t}"]`);
    if (chip) chip.setAttribute("aria-pressed", "true");
  });
}

function clearFilters() {
  state.f = { ...state.f, q: "", types: new Set(), ages: new Set(), facs: new Set(),
              cond: "", surface: "", selected: null };
  document.getElementById("f-q").value = "";
  document.getElementById("f-cond").value = "";
  document.getElementById("f-surface").value = "";
  document.getElementById("f-water").checked = false;
  document.querySelectorAll("[aria-pressed]").forEach((b) => b.setAttribute("aria-pressed", "false"));
  render();
}

function toggleSet(set, v) { set.has(v) ? set.delete(v) : set.add(v); }

/* ---- Filtering ------------------------------------------------------------ */
function parkMatches(p, bounds) {
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
  const next = state.f.selected === id ? null : id;   // clicking again deselects
  const p = state.parks.find((x) => x.id === id);
  state.f.selected = next;

  if (next !== null && p) {
    // setView fires moveend, which re-renders; render() sets the marker icons.
    if (zoom) state.map.setView([p.lat, p.lng], Math.max(state.map.getZoom(), 15));
    render();
    const m = state.markers.get(id);
    if (m) m.openPopup();
    // The card is row 1 now - make sure the panel is actually showing it.
    // behavior:"instant" because the global `scroll-behavior: smooth` would
    // otherwise defer the scroll and desync anything measuring straight after.
    const card = document.querySelector(".park-card.selected");
    if (card) card.scrollIntoView({ block: "nearest", behavior: "instant" });
  } else {
    render();
  }
}

/* Single path for clearing/setting selection from non-card sources. */
function setSelected(id) {
  if (state.f.selected === id) return;
  state.f.selected = id;
  render();
}

/* Custom map controls (Stitch): locate + a stacked zoom pair, bottom-right. */
function wireMapControls() {
  document.getElementById("btn-zoom-in").addEventListener("click", () => state.map.zoomIn());
  document.getElementById("btn-zoom-out").addEventListener("click", () => state.map.zoomOut());

  const locate = document.getElementById("btn-locate");
  locate.addEventListener("click", () => {
    if (!navigator.geolocation) return;
    locate.disabled = true;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        locate.disabled = false;
        state.map.setView([pos.coords.latitude, pos.coords.longitude], 14);
      },
      // Denied or unavailable: re-enable rather than leave the control stuck
      // disabled with no explanation.
      () => { locate.disabled = false; },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 300000 });
  });
}

/* Fit the map around every park matching the current filters. */
function fitAllMatching() {
  const all = state.parks.filter((p) => parkMatches(p, null));
  if (!all.length) return;
  state.map.fitBounds(L.latLngBounds(all.map((p) => [p.lat, p.lng])), { padding: [40, 40] });
}

/* ---- Render ----------------------------------------------------------------- */
function render() {
  const bounds = state.map.getBounds();
  // Markers show every filter match - the map IS the extent, so clipping them
  // to their own viewport would be circular.
  const matching = state.parks.filter((p) => parkMatches(p, null));
  // The list follows the map view. The selected park is force-included so that
  // panning it off-screen never makes the thing you just clicked vanish.
  const inView = matching.filter(
    (p) => bounds.contains([p.lat, p.lng]) || p.id === state.f.selected);
  // Selected sorts to the top; everything else keeps source order.
  const sel = state.f.selected;
  const listed = inView.slice().sort((a, b) => (b.id === sel) - (a.id === sel));

  for (const p of state.parks) {
    const m = state.markers.get(p.id);
    const show = matching.includes(p);
    if (show && !state.map.hasLayer(m)) m.addTo(state.map);
    if (!show && state.map.hasLayer(m)) m.remove();
    if (show) m.setIcon(parkIcon(p, sel === p.id));
  }

  renderKpis(inView);
  renderList(listed, matching.length - inView.length);
  renderCharts(inView);
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

function renderList(parks, outsideCount = 0) {
  const wrap = document.getElementById("park-list");
  if (!parks.length) {
    wrap.innerHTML = outsideCount
      ? `<p class="notice info">No places in this map area.<br><button class="linkbtn" data-zoom-out>Zoom out to see all ${outsideCount}</button></p>`
      : `<p class="notice info">No places match these filters yet. Try clearing a filter — or <a href="/submit.html">add the first one</a>!</p>`;
    wireZoomOut(wrap);
    return;
  }
  wrap.innerHTML = parks.slice(0, 60).map((p) => {
    const photo = (p.photos || [])[0];
    const img = photo
      ? `<img src="${photo.thumb_url}" alt="" loading="lazy">`
      : `<span class="ph"><span class="ms" aria-hidden="true">${locIcon(p.location_type)}</span></span>`;
    // The type chip carries a dot in the marker's own colour, so a card and
    // its pin read as the same thing. Facilities each get their own tint.
    const t = p.location_type || "playground";
    const chips = [
      `<span class="mini-chip"><span class="lg-dot t-${t}"></span> ${locLabel(t)}</span>`,
      isAccessible(p) ? `<span class="mini-chip a11y"><span class="ms">accessible</span> Access</span>` : "",
      p.washroom_nearby === true ? `<span class="mini-chip wc"><span class="ms">wc</span> WC</span>` : "",
      p.shade === true ? `<span class="mini-chip ok"><span class="ms">nature</span> Shade</span>` : "",
      ageChipsHtml(p),
    ].filter(Boolean).join("");
    return `<button class="park-card${state.f.selected === p.id ? " selected" : ""}" data-id="${p.id}" role="option" aria-selected="${state.f.selected === p.id}">
      ${img}
      <span>
        <h3>${escapeHtml(p.name)}</h3>
        <span class="sub">${escapeHtml(p.address || p.city || "Ontario")}</span>
        <span class="mini-chips">${chips}</span>
      </span>
    </button>`;
  }).join("") + (outsideCount
    ? `<p class="list-more"><span>${outsideCount} more outside this area</span>
         <button class="linkbtn" data-zoom-out>Zoom out</button></p>`
    : "");
  wrap.querySelectorAll(".park-card").forEach((el) =>
    el.addEventListener("click", () => selectPark(Number(el.dataset.id))));
  wireZoomOut(wrap);
}

function wireZoomOut(wrap) {
  wrap.querySelectorAll("[data-zoom-out]").forEach((b) =>
    b.addEventListener("click", fitAllMatching));
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
      responsive: true, aspectRatio: 1.7,
      scales: { x: { stacked: true }, y: { stacked: true, ticks: { precision: 0 } } },
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
    /* aspectRatio: without it Chart.js draws doughnuts square, so each one ran
       the full width of the rail in height inside the Insights panel. */
    options: { responsive: true, aspectRatio: 1.7,
               plugins: { legend: { position: "bottom", labels: { boxWidth: 12 } } } },
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
