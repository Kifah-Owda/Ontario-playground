/* Park detail page: gallery, tags, description, accessibility, amenities,
   equipment, map + copy-address (park_detail_sunny_meadows_updated design;
   no directions / scores / generated ratings per approved decisions). */
"use strict";

init().catch((e) => {
  document.getElementById("detail").innerHTML =
    `<div class="card"><h2>We couldn't find that location</h2>
     <p>${escapeHtml(e.message.includes("404") ? "It may have been updated or removed." : e.message)}</p>
     <p><a class="btn btn-primary" href="/explore.html">Back to the map</a></p></div>`;
});

async function init() {
  const id = new URLSearchParams(location.search).get("id");
  if (!id) throw new Error("404 no id");
  const [meta, p] = await Promise.all([API.get("/api/meta"), API.get(`/api/parks/${id}`)]);
  document.title = `${p.name} — Ontario Playground`;
  document.getElementById("crumb").textContent = p.name;
  renderDetail(p, meta);
}

function tri(v, yesText, noText) {
  if (v === true) return `<span class="tag ok">✓ ${yesText}</span>`;
  if (v === false) return `<span class="tag" style="background:var(--paper-dim);color:var(--muted)">✗ ${noText}</span>`;
  return "";
}

function renderDetail(p, meta) {
  const photos = p.photos || [];
  const gallery = photos.length
    ? `<div class="gallery">
        <a class="main" href="${photos[0].url}" target="_blank" rel="noopener"><img src="${photos[0].url}" alt="Photo of ${escapeHtml(p.name)}"></a>
        <div class="side">${photos.slice(1, 3).map((ph) =>
          `<a href="${ph.url}" target="_blank" rel="noopener"><img src="${ph.thumb_url}" alt="Photo of ${escapeHtml(p.name)}"></a>`).join("")}
          ${photos.length > 3 ? `<div class="gallery-empty" style="height:154px"><span>+${photos.length - 3} more photos</span></div>` : ""}
        </div>
      </div>`
    : `<div class="gallery-empty"><span class="ms" style="font-size:2.4rem" aria-hidden="true">${locIcon(p.location_type)}</span>
       <span>No photos yet — <a href="/submit.html?update=${p.id}">add some</a>!</span></div>`;

  const ageTags = (p.age_groups_present || []).map((a) => {
    const cls = { circle: "age-t", diamond: "age-p", triangle: "age-s" }[AGE_SHAPES[a]];
    return `<span class="tag ${cls}">${shapeSpan(a)} ${AGE_SHORT[a] || a}</span>`;
  }).join("");

  const amenities = FACILITY_META.map(([key, label, icon]) => {
    let v = p[key];
    if (key === "water_fountains") v = p.water_fountains > 0 ? true : (p.water_fountains === 0 ? false : null);
    if (key === "water_access" && p.location_type === "playground") return "";
    if (key === "fenced" && p.location_type !== "playground" && v == null) return "";
    if (v == null) return "";
    return `<div class="amenity${v ? "" : " off"}"><span class="ms" aria-hidden="true">${icon}</span>${label}${v ? "" : " — no"}</div>`;
  }).filter(Boolean).join("");

  const a11yRows = Object.entries(A11Y_LABELS)
    .filter(([k]) => p[k] !== null && p[k] !== undefined)
    .map(([k, label]) => `<div>${p[k] ? "✅" : "▢"} ${label}</div>`).join("");

  const equip = (p.equipment || []).map((e) => `
    <div class="equip-card">
      <span>${shapeSpan(e.age_group)} <small>${AGE_SHORT[e.age_group] || ""}</small></span>
      <b>${escapeHtml(e.equipment_type)}</b>
      <span class="cond-pill" data-c="${escapeHtml(e.condition)}">${escapeHtml(e.condition)}</span>
      ${e.notes ? `<small>${escapeHtml(e.notes)}</small>` : ""}
    </div>`).join("");

  const addr = p.address || (p.city ? `${p.city}, Ontario` : `${p.lat.toFixed(5)}, ${p.lng.toFixed(5)}`);

  document.getElementById("detail").innerHTML = `
  <div>
    <div class="card">${gallery}
      <h1 style="margin-top:0.9rem">${escapeHtml(p.name)}</h1>
      <div class="tag-row">
        <span class="tag type"><span class="ms" aria-hidden="true">${locIcon(p.location_type)}</span> ${locLabel(p.location_type)}</span>
        ${isAccessible(p) ? `<span class="tag ok"><span class="ms" aria-hidden="true">accessible</span> Accessible features</span>` : ""}
        ${ageTags}
      </div>
      ${p.notes ? `<p>${escapeHtml(p.notes)}</p>` : ""}
      ${p.review_comment ? `<p style="color:var(--ink-soft)"><i>“${escapeHtml(p.review_comment)}”</i> — a visiting parent</p>` : ""}
    </div>

    <div class="card">
      <h2><span class="ms" aria-hidden="true">accessible</span> Accessibility info</h2>
      ${a11yRows || `<p style="color:var(--muted)">Not assessed yet — <a href="/submit.html?update=${p.id}">you can help</a>.</p>`}
      ${tri(p.fenced, "Fully fenced area", "Not fenced")}
      ${p.location_type !== "playground" ? tri(p.water_access, "Accessible water entry", "No accessible water entry") : ""}
      ${p.surfacing_material ? `<p style="margin-top:0.6rem"><b>Surface type:</b> ${escapeHtml(p.surfacing_material)}</p>` : ""}
      ${p.accessibility_notes ? `<p>${escapeHtml(p.accessibility_notes)}</p>` : ""}
    </div>

    <div class="card">
      <h2>Common amenities</h2>
      <div class="amenity-grid">${amenities || `<p style="color:var(--muted)">No amenity details yet.</p>`}</div>
    </div>

    ${p.location_type === "playground" ? `
    <div class="card">
      <h2>Play equipment</h2>
      <div class="equip-cards">${equip || "<p>No equipment recorded.</p>"}</div>
    </div>` : ""}
  </div>

  <aside>
    <div class="card">
      <div id="mini-map" class="side-map" aria-label="Map showing ${escapeHtml(p.name)}"></div>
      <div class="addr-row">
        <span class="ms" aria-hidden="true">location_on</span>
        <span id="addr-text">${escapeHtml(addr)}</span>
      </div>
      <div class="addr-row">
        <button class="btn btn-secondary btn-sm" id="copy-addr"><span class="ms" aria-hidden="true">content_copy</span> Copy address</button>
      </div>
    </div>
    <div class="card">
      <h3>Seen something change?</h3>
      <p style="font-size:0.92rem;color:var(--ink-soft)">Reports come from families like yours and are checked by a moderator before publishing.</p>
      <a class="btn btn-primary" style="width:100%" href="/submit.html?update=${p.id}&name=${encodeURIComponent(p.name)}&lat=${p.lat}&lng=${p.lng}">
        <span class="ms" aria-hidden="true">edit_location</span> Suggest an update</a>
    </div>
  </aside>`;

  const map = makeBaseMap(document.getElementById("mini-map"), meta);
  map.setView([p.lat, p.lng], 15);
  L.marker([p.lat, p.lng], { icon: parkIcon(p, true) }).addTo(map);
  map.scrollWheelZoom.disable();

  document.getElementById("copy-addr").addEventListener("click", async (ev) => {
    const btn = ev.currentTarget;
    const text = `${p.name}, ${addr}`;
    try {
      await navigator.clipboard.writeText(text);
      btn.innerHTML = `<span class="ms" aria-hidden="true">check</span> Copied!`;
    } catch {
      window.prompt("Copy the address:", text);
    }
    setTimeout(() => { btn.innerHTML = `<span class="ms" aria-hidden="true">content_copy</span> Copy address`; }, 1800);
  });
}
