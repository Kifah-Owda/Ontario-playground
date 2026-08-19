/* Add-a-place wizard (Stitch design): 4 steps, three location types.
   Same payload contract as before + new fields; moderation unchanged.
   I1 update-pre-fill preserved: ?update=<id> loads the current public data. */
"use strict";

const S = {
  meta: null, map: null, pin: null, step: 1, updateOf: null,
  type: "playground", files: [],
};
const A11Y_FIELDS = Object.entries(A11Y_LABELS); // [key, label]
const TRI_KEYS = ["washroom", "parking", "shade", "fenced", "water_access"];

init().catch((e) => showError(`Could not load the form: ${escapeHtml(e.message)}`));

async function init() {
  S.meta = await API.get("/api/meta");
  buildTypeCards();
  buildTris();
  buildA11y();
  fillSelect("p-surface", S.meta.surfaces);
  document.getElementById("photo-hint").textContent =
    `JPG or PNG · up to ${S.meta.max_photos} photos (we resize them automatically)`;

  S.map = makeBaseMap(document.getElementById("pick-map"), S.meta);
  S.map.on("click", (e) => setPin(e.latlng.lat, e.latlng.lng));
  document.getElementById("p-lat").addEventListener("change", coordsTyped);
  document.getElementById("p-lng").addEventListener("change", coordsTyped);
  document.getElementById("use-gps").addEventListener("click", useGps);
  wireGeocoder();
  wirePhotos();
  wireEquipment();
  wireNav();
  wireDuplicateHint();

  const params = new URLSearchParams(location.search);
  if (params.get("update")) {
    S.updateOf = Number(params.get("update"));
    await prefillUpdate(params);
  } else {
    addEquipmentEntry();
  }
  syncTypeUI();
}

/* ---- Step 1: type + location --------------------------------------------- */
function buildTypeCards() {
  const wrap = document.getElementById("type-cards");
  wrap.innerHTML = S.meta.location_types.map((t) =>
    `<button type="button" class="type-card" data-t="${t}" aria-pressed="${t === S.type}">
      <span class="ms" aria-hidden="true">${locIcon(t)}</span>${locLabel(t)}</button>`).join("");
  wrap.querySelectorAll(".type-card").forEach((b) => b.addEventListener("click", () => {
    S.type = b.dataset.t;
    wrap.querySelectorAll(".type-card").forEach((x) =>
      x.setAttribute("aria-pressed", x.dataset.t === S.type));
    syncTypeUI();
  }));
}

function syncTypeUI() {
  document.querySelectorAll("[data-only]").forEach((el) => {
    el.classList.toggle("hidden", !el.dataset.only.split(" ").includes(S.type));
  });
  const isPlay = S.type === "playground";
  document.getElementById("equip-wrap").classList.toggle("hidden", !isPlay);
  document.getElementById("equip-skip").classList.toggle("hidden", isPlay);
  document.getElementById("step3-title").textContent =
    isPlay ? "What's there to play on?" : "Equipment";
}

function setPin(lat, lng) {
  lat = Number(lat.toFixed(6)); lng = Number(lng.toFixed(6));
  document.getElementById("p-lat").value = lat;
  document.getElementById("p-lng").value = lng;
  if (!S.pin) {
    S.pin = L.marker([lat, lng], { draggable: true }).addTo(S.map);
    S.pin.on("dragend", () => {
      const ll = S.pin.getLatLng(); setPin(ll.lat, ll.lng);
    });
  } else S.pin.setLatLng([lat, lng]);
}

function coordsTyped() {
  const lat = parseFloat(document.getElementById("p-lat").value);
  const lng = parseFloat(document.getElementById("p-lng").value);
  if (Number.isFinite(lat) && Number.isFinite(lng)) {
    setPin(lat, lng); S.map.setView([lat, lng], Math.max(S.map.getZoom(), 14));
  }
}

function useGps() {
  const msg = document.getElementById("geo-msg");
  if (!navigator.geolocation) { msg.textContent = "Location isn't available in this browser — tap the map instead."; return; }
  msg.textContent = "Locating…";
  navigator.geolocation.getCurrentPosition(
    (pos) => { setPin(pos.coords.latitude, pos.coords.longitude); S.map.setView([pos.coords.latitude, pos.coords.longitude], 16); msg.textContent = ""; },
    () => { msg.textContent = "We couldn't get your location — search or tap the map instead."; }
  );
}

function wireGeocoder() {
  const input = document.getElementById("p-search");
  const msg = document.getElementById("geo-msg");
  if (!S.meta.geocoder.enabled) {
    document.getElementById("geo-field").classList.add("hidden");
    return;
  }
  let t = null;
  input.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); go(); } });
  input.addEventListener("change", go);
  async function go() {
    const q = input.value.trim();
    if (q.length < 3) return;
    clearTimeout(t);
    t = setTimeout(async () => {
      msg.textContent = "Searching…";
      try {
        const url = `${S.meta.geocoder.url}?format=json&limit=1&countrycodes=ca&q=${encodeURIComponent(q)}`;
        const res = await fetch(url, { headers: { Accept: "application/json" } });
        const hits = await res.json();
        if (!hits.length) { msg.textContent = "No match found — try the map pin or manual address."; return; }
        const h = hits[0];
        setPin(parseFloat(h.lat), parseFloat(h.lon));
        S.map.setView([h.lat, h.lon], 16);
        if (!document.getElementById("p-address").value) {
          document.getElementById("p-address").value = (h.display_name || "").slice(0, 255);
        }
        msg.textContent = "";
      } catch {
        msg.textContent = "Address search is unavailable right now — tap the map instead.";
      }
    }, 250);
  }
}

/* ---- Step 2 widgets -------------------------------------------------------- */
function buildTris() {
  document.querySelectorAll(".tri[data-tri]").forEach((wrap) => {
    const name = wrap.dataset.tri;
    wrap.innerHTML = [["yes", "Yes"], ["no", "No"], ["", "Not sure"]].map(([v, l]) =>
      `<label>${l}<input type="radio" name="${name}" value="${v}"${v === "" ? " checked" : ""}></label>`).join("");
  });
}
function buildA11y() {
  document.getElementById("a11y-fields").innerHTML = A11Y_FIELDS.map(([key, label]) =>
    `<div class="field"><label>${label}?</label><div class="tri" data-tri="${key}"></div></div>`).join("");
  document.querySelectorAll("#a11y-fields .tri").forEach((wrap) => {
    const name = wrap.dataset.tri;
    wrap.innerHTML = [["yes", "Yes"], ["no", "No"], ["", "Not sure"]].map(([v, l]) =>
      `<label>${l}<input type="radio" name="${name}" value="${v}"${v === "" ? " checked" : ""}></label>`).join("");
  });
}
function triValue(name) {
  const v = document.querySelector(`input[name="${name}"]:checked`)?.value;
  return v === "yes" ? true : v === "no" ? false : null;
}
function setTri(name, value) {
  const v = value === true ? "yes" : value === false ? "no" : "";
  const el = document.querySelector(`input[name="${name}"][value="${v}"]`);
  if (el) el.checked = true;
}
function fillSelect(id, values) {
  const sel = document.getElementById(id);
  values.forEach((v) => sel.append(new Option(v, v)));
}

/* ---- Step 3: equipment repeater -------------------------------------------- */
function wireEquipment() {
  document.getElementById("add-equip").addEventListener("click", () => addEquipmentEntry());
}
function addEquipmentEntry() {
  const div = document.createElement("div");
  div.className = "equip-entry";
  div.innerHTML = `
    <div class="field"><label>Equipment *</label>
      <select data-k="equipment_type" required><option value="">Choose…</option>
        ${S.meta.equipment_types.map((t) => `<option>${t}</option>`).join("")}</select></div>
    <div class="field"><label>Best for *</label>
      <select data-k="age_group" required><option value="">Choose…</option>
        ${S.meta.age_groups.map((a) => `<option value="${escapeHtml(a)}">${AGE_SHORT[a] || a}</option>`).join("")}</select></div>
    <div class="field"><label>Condition *</label>
      <select data-k="condition" required><option value="">Choose…</option>
        ${S.meta.conditions.map((c) => `<option>${c}</option>`).join("")}</select></div>
    <button type="button" class="btn btn-ghost btn-sm" aria-label="Remove this equipment">✕</button>
    <div class="field full"><label>Notes</label>
      <input type="text" data-k="notes" maxlength="1000" placeholder="e.g. high-back toddler swing"></div>`;
  div.querySelector("button").addEventListener("click", () => div.remove());
  document.getElementById("equipment-list").append(div);
  return div;
}
function readEquipment() {
  return [...document.querySelectorAll(".equip-entry")].map((div) => {
    const o = {};
    div.querySelectorAll("[data-k]").forEach((el) => { o[el.dataset.k] = el.value || null; });
    if (!o.notes) delete o.notes;
    return o;
  }).filter((o) => o.equipment_type || o.age_group || o.condition);
}

/* ---- Step 4: photos --------------------------------------------------------- */
function wirePhotos() {
  const dz = document.getElementById("dropzone");
  const input = document.getElementById("p-photos");
  dz.addEventListener("click", () => input.click());
  dz.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); input.click(); } });
  dz.addEventListener("dragover", (e) => { e.preventDefault(); });
  dz.addEventListener("drop", (e) => { e.preventDefault(); addFiles(e.dataTransfer.files); });
  input.addEventListener("change", () => { addFiles(input.files); input.value = ""; });
}
function addFiles(list) {
  for (const f of list) {
    if (!f.type.startsWith("image/")) continue;
    if (S.files.length >= S.meta.max_photos) {
      showError(`At most ${S.meta.max_photos} photos per report.`); break;
    }
    S.files.push(f);
  }
  renderPreviews();
}
function renderPreviews() {
  const wrap = document.getElementById("previews");
  wrap.innerHTML = "";
  S.files.forEach((f, i) => {
    const fig = document.createElement("figure");
    const img = document.createElement("img");
    img.alt = f.name; img.src = URL.createObjectURL(f);
    const rm = document.createElement("button");
    rm.type = "button"; rm.textContent = "✕"; rm.setAttribute("aria-label", `Remove ${f.name}`);
    rm.addEventListener("click", () => { S.files.splice(i, 1); renderPreviews(); });
    fig.append(img, rm); wrap.append(fig);
  });
}

/* ---- Navigation / validation ------------------------------------------------- */
function wireNav() {
  document.getElementById("btn-next").addEventListener("click", () => go(1));
  document.getElementById("btn-back").addEventListener("click", () => go(-1));
  document.getElementById("wizard").addEventListener("submit", submit);
}
function go(dir) {
  hideError();
  if (dir > 0 && !validateStep(S.step)) return;
  let next = S.step + dir;
  // Non-playgrounds skip step 3.
  if (next === 3 && S.type !== "playground") next += dir;
  S.step = Math.min(4, Math.max(1, next));
  document.querySelectorAll(".step-panel").forEach((p) =>
    p.hidden = Number(p.dataset.step) !== S.step);
  document.querySelectorAll(".steps .bar").forEach((b) =>
    b.classList.toggle("done", Number(b.dataset.s) <= S.step));
  document.getElementById("step-label").textContent = `Step ${S.step} of 4`;
  document.getElementById("btn-back").disabled = S.step === 1;
  document.getElementById("btn-next").classList.toggle("hidden", S.step === 4);
  document.getElementById("btn-submit").classList.toggle("hidden", S.step !== 4);
  if (S.step === 4) renderReview();
  window.scrollTo({ top: 0 });
  if (S.step === 1) S.map.invalidateSize();
}
function validateStep(step) {
  if (step === 1) {
    if (document.getElementById("p-name").value.trim().length < 2)
      return showError("Please give this place a name."), false;
    const lat = parseFloat(document.getElementById("p-lat").value);
    const lng = parseFloat(document.getElementById("p-lng").value);
    if (!Number.isFinite(lat) || !Number.isFinite(lng))
      return showError("Please set the location — search, use your location, or tap the map."), false;
  }
  if (step === 3 && S.type === "playground") {
    const eq = readEquipment();
    if (!eq.length || eq.some((e) => !e.equipment_type || !e.age_group || !e.condition))
      return showError("Add at least one equipment entry, with its type, age fit, and condition."), false;
  }
  return true;
}
function renderReview() {
  const eq = readEquipment();
  const rows = [
    ["Type", locLabel(S.type)],
    ["Name", document.getElementById("p-name").value],
    ["Address", document.getElementById("p-address").value || document.getElementById("p-city").value || "—"],
    ["Coordinates", `${document.getElementById("p-lat").value}, ${document.getElementById("p-lng").value}`],
    ["Washroom", triText("washroom")], ["Parking", triText("parking")], ["Shade", triText("shade")],
  ];
  if (S.type === "playground") rows.push(["Fenced", triText("fenced")], ["Equipment", `${eq.length} item${eq.length === 1 ? "" : "s"}`]);
  else rows.push(["Accessible water entry", triText("water_access")]);
  rows.push(["Photos", `${S.files.length}`]);
  document.getElementById("review-list").innerHTML =
    rows.map(([k, v]) => `<dt>${k}</dt><dd>${escapeHtml(v || "—")}</dd>`).join("");
}
function triText(name) {
  const v = triValue(name);
  return v === true ? "Yes" : v === false ? "No" : "Not sure";
}

/* ---- Submit -------------------------------------------------------------------- */
async function submit(e) {
  e.preventDefault();
  hideError();
  if (!validateStep(1) || !validateStep(3)) { return; }
  const payload = {
    name: document.getElementById("p-name").value.trim(),
    location_type: S.type,
    city: document.getElementById("p-city").value.trim() || null,
    address: document.getElementById("p-address").value.trim() || null,
    lat: parseFloat(document.getElementById("p-lat").value),
    lng: parseFloat(document.getElementById("p-lng").value),
    surfacing_material: document.getElementById("p-surface").value || null,
    washroom_nearby: triValue("washroom"),
    water_fountains: document.getElementById("p-water").value === "" ? null : Number(document.getElementById("p-water").value),
    parking: triValue("parking"),
    shade: triValue("shade"),
    fenced: S.type === "playground" ? triValue("fenced") : null,
    water_access: S.type !== "playground" ? triValue("water_access") : null,
    notes: document.getElementById("p-notes").value.trim() || null,
    review_comment: document.getElementById("p-review").value.trim() || null,
    accessibility: Object.fromEntries(
      A11Y_FIELDS.map(([k]) => [k, triValue(k)]).concat(
        [["accessibility_notes", document.getElementById("p-a11y-notes").value.trim() || null]])),
    equipment: S.type === "playground" ? readEquipment() : [],
    submitter_name: document.getElementById("p-submitter").value.trim() || null,
    revision_of_id: S.updateOf,
    website: document.getElementById("p-website").value || null,
  };
  const fd = new FormData();
  fd.append("payload", JSON.stringify(payload));
  for (const f of S.files) fd.append("photos", f, f.name);

  const btn = document.getElementById("btn-submit");
  btn.disabled = true;
  try {
    const res = await fetch("/api/submissions", { method: "POST", body: fd });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(typeof data.detail === "string" ? data.detail : JSON.stringify(data.detail || res.status));
    document.getElementById("wizard").classList.add("hidden");
    document.getElementById("done").classList.remove("hidden");
    document.getElementById("done-msg").textContent =
      data.message || "Your report will appear on the map once a moderator approves it.";
    window.scrollTo({ top: 0 });
  } catch (err) {
    showError(`Submission failed: ${escapeHtml(err.message)}`);
  } finally {
    btn.disabled = false;
  }
}

/* ---- Duplicate hint --------------------------------------------------------------- */
async function wireDuplicateHint() {
  if (S.updateOf) return;
  try {
    const parks = await API.get("/api/parks");
    const dl = document.getElementById("park-names");
    dl.innerHTML = parks.map((p) => `<option value="${escapeHtml(p.name)}">`).join("");
    document.getElementById("p-name").addEventListener("input", (e) => {
      const hit = parks.find((p) => p.name.toLowerCase() === e.target.value.trim().toLowerCase());
      const hint = document.getElementById("dup-hint");
      if (hit) {
        hint.innerHTML = `“${escapeHtml(hit.name)}” is already on the map — <a href="/submit.html?update=${hit.id}">suggest an update to it</a> instead?`;
        hint.classList.remove("hidden");
      } else hint.classList.add("hidden");
    });
  } catch { /* non-fatal */ }
}

/* ---- Update-flow pre-fill (I1) -----------------------------------------------------
   An approved revision REPLACES the previous snapshot, so the form must start
   from the park's current public data or partial updates silently erase it. */
async function prefillUpdate(params) {
  const n = document.getElementById("update-notice");
  let park = null;
  try { park = await API.get(`/api/parks/${S.updateOf}`); } catch { /* fallback below */ }

  if (park) {
    S.type = park.location_type || "playground";
    document.querySelectorAll("#type-cards .type-card").forEach((x) =>
      x.setAttribute("aria-pressed", x.dataset.t === S.type));
    document.getElementById("p-name").value = park.name;
    document.getElementById("p-city").value = park.city || "";
    document.getElementById("p-address").value = park.address || "";
    setPin(park.lat, park.lng);
    S.map.setView([park.lat, park.lng], 16);
    document.getElementById("p-surface").value = park.surfacing_material || "";
    setTri("washroom", park.washroom_nearby);
    setTri("parking", park.parking);
    setTri("shade", park.shade);
    setTri("fenced", park.fenced);
    setTri("water_access", park.water_access);
    document.getElementById("p-water").value = park.water_fountains ?? "";
    document.getElementById("p-notes").value = park.notes || "";
    // Deliberately NOT pre-filling "Your review": previous contributor's voice.
    for (const [key] of A11Y_FIELDS) setTri(key, park[key]);
    document.getElementById("p-a11y-notes").value = park.accessibility_notes || "";
    setEquipmentEntries(park.equipment || []);
    n.textContent = `You're updating “${park.name}”. We've filled in what's currently on the map — edit what's changed, remove what's gone, add what's new. Only remove an entry if the equipment is really gone: your report replaces the whole record once approved. Existing photos stay with the park's history; add new ones if you have them.`;
  } else {
    const name = params.get("name") || "";
    document.getElementById("p-name").value = name;
    const lat = parseFloat(params.get("lat")), lng = parseFloat(params.get("lng"));
    if (Number.isFinite(lat) && Number.isFinite(lng)) { setPin(lat, lng); S.map.setView([lat, lng], 16); }
    addEquipmentEntry();
    n.textContent = `You're suggesting an update to “${name}”. We couldn't load its current details, so please describe the current state of the WHOLE place — your report replaces the old record once approved.`;
  }
  n.classList.remove("hidden");
  window.scrollTo({ top: 0 });
}
function setEquipmentEntries(items) {
  const wrap = document.getElementById("equipment-list");
  wrap.innerHTML = "";
  if (!items.length) { addEquipmentEntry(); return; }
  for (const item of items) {
    const div = addEquipmentEntry();
    div.querySelectorAll("[data-k]").forEach((el) => { el.value = item[el.dataset.k] ?? ""; });
  }
}

/* ---- Errors -------------------------------------------------------------------------- */
function showError(msg) {
  const el = document.getElementById("form-error");
  el.innerHTML = msg; el.classList.remove("hidden");
  window.scrollTo({ top: 0 });
}
function hideError() { document.getElementById("form-error").classList.add("hidden"); }
