/* Admin console: login, dashboard counts, queue by status, approve/reject
   with note, EDIT in place (2026), delete, CSV export, revision diffs (I1).
   Token kept in sessionStorage (cleared when the tab closes). */
"use strict";

const A = {
  token: sessionStorage.getItem("admin_token") || null,
  status: "pending", meta: null, editing: null,
};

document.getElementById("login-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const errEl = document.getElementById("login-error");
  errEl.classList.add("hidden");
  try {
    const data = await API.post("/api/admin/login", {
      password: document.getElementById("admin-pass").value,
    });
    A.token = data.token;
    sessionStorage.setItem("admin_token", A.token);
    showQueue();
  } catch (err) {
    errEl.textContent = "Sign-in failed: " + err.message;
    errEl.classList.remove("hidden");
  }
});

document.querySelectorAll(".tabs .chip[data-status]").forEach((b) =>
  b.addEventListener("click", () => {
    A.status = b.dataset.status;
    document.querySelectorAll(".tabs .chip[data-status]").forEach((x) =>
      x.setAttribute("aria-pressed", String(x === b)));
    loadQueue();
  })
);

document.getElementById("signout-btn").addEventListener("click", () => {
  sessionStorage.removeItem("admin_token");
  location.reload();
});

document.getElementById("export-link").addEventListener("click", async (e) => {
  e.preventDefault();
  const res = await fetch("/api/admin/export.csv", {
    headers: { Authorization: `Bearer ${A.token}` },
  });
  if (!res.ok) return queueError("Export failed: " + res.status);
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = "locations.csv"; a.click();
  URL.revokeObjectURL(url);
});

if (A.token) showQueue();

async function showQueue() {
  document.getElementById("login-view").classList.add("hidden");
  document.getElementById("queue-view").classList.remove("hidden");
  document.getElementById("signout-btn").classList.remove("hidden");
  if (!A.meta) {
    try { A.meta = await API.get("/api/meta"); buildEditor(); } catch { /* editor disabled */ }
  }
  loadQueue();
}

async function loadQueue() {
  const wrap = document.getElementById("queue");
  wrap.innerHTML = "<p>Loading…</p>";
  try {
    const res = await fetch(`/api/admin/parks?status=all`, {
      headers: { Authorization: `Bearer ${A.token}` },
    });
    if (res.status === 401) {
      sessionStorage.removeItem("admin_token");
      location.reload();
      return;
    }
    if (!res.ok) throw new Error(String(res.status));
    const all = await res.json();
    renderStats(all);
    const parks = all.filter((p) => p.status === A.status);
    wrap.innerHTML = parks.length
      ? parks.map(card).join("")
      : `<p class="notice info">Nothing ${A.status} right now.</p>`;
    wrap.querySelectorAll("[data-act]").forEach((btn) =>
      btn.addEventListener("click", () => act(btn, parks))
    );
    enhanceRevisionDiffs(parks);
  } catch (err) {
    queueError("Could not load queue: " + err.message);
  }
}

/* Basic dashboard: live counts across the whole database. */
function renderStats(all) {
  const by = (s) => all.filter((p) => p.status === s).length;
  document.getElementById("admin-stats").innerHTML = [
    [by("pending"), "Pending"],
    [by("approved"), "Live"],
    [by("rejected"), "Rejected"],
    [by("archived"), "Archived"],
    [all.reduce((n, p) => n + (p.photos || []).length, 0), "Photos"],
  ].map(([v, l]) => `<div class="kpi"><b>${v}</b><span>${l}</span></div>`).join("");
}

function card(p) {
  const rows = p.equipment
    .map(
      (e) => `<tr><td><span class="age-chip age-${AGE_KEY[e.age_group] || "t"}">${escapeHtml(AGE_SHORT[e.age_group] || e.age_group)}</span></td><td>${escapeHtml(e.equipment_type)}</td>
        <td><span class="cond-pill" data-c="${escapeHtml(e.condition)}">${escapeHtml(e.condition)}</span></td>
        <td>${escapeHtml(e.notes || "")}</td></tr>`
    )
    .join("");
  const photos = (p.photos || [])
    .map((ph) => `<a href="${ph.url}" target="_blank" rel="noopener"><img src="${ph.thumb_url}" alt=""></a>`)
    .join(" ");
  const amen = [
    `<span class="mini-chip"><span class="ms">${locIcon(p.location_type)}</span> ${locLabel(p.location_type)}</span>`,
    p.surfacing_material && `<span class="mini-chip">⬢ ${escapeHtml(p.surfacing_material)}</span>`,
    p.washroom_nearby === true && `<span class="mini-chip ok">WC</span>`,
    p.parking === true && `<span class="mini-chip ok">Parking</span>`,
    p.shade === true && `<span class="mini-chip ok">Shade</span>`,
    p.fenced === true && `<span class="mini-chip ok">Fenced</span>`,
    p.water_access === true && `<span class="mini-chip ok">Water entry</span>`,
    p.water_fountains != null && `<span class="mini-chip">🚰 ${p.water_fountains}</span>`,
  ].filter(Boolean).join(" ");
  const noteInput = p.status === "pending"
    ? `<input type="text" placeholder="Moderation note (optional)" aria-label="Moderation note" data-note="${p.id}" style="max-width:280px">`
    : "";
  const modBtns = p.status === "pending"
    ? `<button class="btn btn-primary btn-sm" data-act="approve" data-id="${p.id}">Approve</button>
       <button class="btn btn-ghost btn-sm" data-act="reject" data-id="${p.id}">Reject</button>`
    : "";
  return `<article class="card sub-card">
    <header>
      <h3>${escapeHtml(p.name)}</h3>
      <span class="status-pill ${p.status}">${p.status}</span>
      <span class="meta">#${p.id} · ${escapeHtml(p.address || p.city || "—")} · ${p.lat.toFixed(4)}, ${p.lng.toFixed(4)}
        · submitted ${new Date(p.created_at).toLocaleString()}
        ${p.submitter_name ? ` · by ${escapeHtml(p.submitter_name)}` : ""}
        ${p.revision_of_id ? ` · <b>updates #${p.revision_of_id}</b>` : ""}</span>
    </header>
    ${p.status === "pending" && p.revision_of_id ? `<div class="rev-diff" data-newid="${p.id}">Comparing with the current public version…</div>` : ""}
    <div class="mini-chips">${amen}</div>
    ${p.notes ? `<p><b>Description:</b> ${escapeHtml(p.notes)}</p>` : ""}
    ${p.review_comment ? `<p><b>Review:</b> “${escapeHtml(p.review_comment)}”</p>` : ""}
    ${a11yBadges(p)}
    ${p.accessibility_notes ? `<p><b>Accessibility notes:</b> ${escapeHtml(p.accessibility_notes)}</p>` : ""}
    ${rows ? `<table><thead><tr><th></th><th>Equipment</th><th>Condition</th><th>Notes</th></tr></thead><tbody>${rows}</tbody></table>` : ""}
    ${photos ? `<div class="thumbs">${photos}</div>` : ""}
    ${p.moderation_note ? `<p class="meta">Moderator note: ${escapeHtml(p.moderation_note)}</p>` : ""}
    <div class="actions">
      ${noteInput}${modBtns}
      <button class="btn btn-secondary btn-sm" data-act="edit" data-id="${p.id}"><span class="ms" aria-hidden="true">edit</span> Edit</button>
      <button class="btn btn-danger btn-sm" data-act="delete" data-id="${p.id}">Delete permanently</button>
    </div>
  </article>`;
}

function a11yBadges(park) {
  const yes = Object.entries(A11Y_LABELS)
    .filter(([k]) => park[k] === true)
    .map(([, label]) => `<span class="mini-chip a11y">♿ ${label}</span>`);
  return yes.length ? `<div class="mini-chips" style="margin:0.3rem 0">${yes.join(" ")}</div>` : "";
}

async function act(btn, parks) {
  const id = btn.dataset.id;
  const action = btn.dataset.act;
  if (action === "edit") { openEditor(parks.find((p) => p.id === Number(id))); return; }
  if (action === "delete" && !confirm("Permanently delete this record and its photos? This cannot be undone.")) return;
  const note = document.querySelector(`[data-note="${id}"]`)?.value || null;
  btn.disabled = true;
  try {
    const url =
      action === "delete" ? `/api/admin/parks/${id}` : `/api/admin/parks/${id}/${action}`;
    const res = await fetch(url, {
      method: action === "delete" ? "DELETE" : "POST",
      headers: {
        Authorization: `Bearer ${A.token}`,
        "Content-Type": "application/json",
      },
      body: action === "delete" ? undefined : JSON.stringify({ note }),
    });
    if (!res.ok) throw new Error(String(res.status));
    loadQueue();
  } catch (err) {
    queueError(`${action} failed: ` + err.message);
    btn.disabled = false;
  }
}

/* --- Edit dialog (2026: in-place moderator corrections) ---------------------- */
function buildEditor() {
  const typeSel = document.getElementById("ed-type");
  A.meta.location_types.forEach((t) => typeSel.append(new Option(locLabel(t), t)));
  A.meta.surfaces.forEach((s) =>
    document.getElementById("ed-surface").append(new Option(s, s)));
  document.getElementById("ed-a11y").innerHTML = Object.entries(A11Y_LABELS).map(
    ([k, label]) => `<div class="field"><label>${label}</label><div class="tri" data-ed="${k}"></div></div>`).join("");
  document.querySelectorAll("#editor .tri[data-ed]").forEach((wrap) => {
    const name = "ed_" + wrap.dataset.ed;
    wrap.innerHTML = [["yes", "Yes"], ["no", "No"], ["", "?"]].map(([v, l]) =>
      `<label>${l}<input type="radio" name="${name}" value="${v}"></label>`).join("");
  });
  document.getElementById("ed-add-equip").addEventListener("click", () => edAddEquip());
  document.getElementById("ed-cancel").addEventListener("click", () =>
    document.getElementById("editor").close());
  document.getElementById("ed-form").addEventListener("submit", saveEdit);
  typeSel.addEventListener("change", () => syncEditorType(typeSel.value));
}

function syncEditorType(t) {
  const isPlay = t === "playground";
  document.getElementById("ed-equipment").parentElement
    .querySelectorAll("#ed-equipment, #ed-add-equip")
    .forEach((el) => el.classList.toggle("hidden", !isPlay));
}

function edSetTri(key, value) {
  const v = value === true ? "yes" : value === false ? "no" : "";
  const el = document.querySelector(`input[name="ed_${key}"][value="${v}"]`);
  if (el) el.checked = true;
}
function edTriValue(key) {
  const v = document.querySelector(`input[name="ed_${key}"]:checked`)?.value;
  return v === "yes" ? true : v === "no" ? false : null;
}

function edAddEquip(item) {
  const div = document.createElement("div");
  div.className = "equip-entry";
  div.innerHTML = `
    <div class="field"><select data-k="equipment_type"><option value="">Type…</option>
      ${A.meta.equipment_types.map((t) => `<option>${t}</option>`).join("")}</select></div>
    <div class="field"><select data-k="age_group"><option value="">Age…</option>
      ${A.meta.age_groups.map((a) => `<option value="${escapeHtml(a)}">${AGE_SHORT[a] || a}</option>`).join("")}</select></div>
    <div class="field"><select data-k="condition"><option value="">Condition…</option>
      ${A.meta.conditions.map((c) => `<option>${c}</option>`).join("")}</select></div>
    <button type="button" class="btn btn-ghost btn-sm" aria-label="Remove">✕</button>
    <div class="field full"><input type="text" data-k="notes" maxlength="1000" placeholder="Notes"></div>`;
  if (item) div.querySelectorAll("[data-k]").forEach((el) => { el.value = item[el.dataset.k] ?? ""; });
  div.querySelector("button").addEventListener("click", () => div.remove());
  document.getElementById("ed-equipment").append(div);
}

function openEditor(p) {
  if (!A.meta || !p) return queueError("Editor unavailable (meta failed to load).");
  A.editing = p;
  document.getElementById("ed-error").classList.add("hidden");
  document.getElementById("ed-id").textContent = `#${p.id} · ${p.status}`;
  document.getElementById("ed-name").value = p.name;
  document.getElementById("ed-type").value = p.location_type || "playground";
  document.getElementById("ed-city").value = p.city || "";
  document.getElementById("ed-address").value = p.address || "";
  document.getElementById("ed-lat").value = p.lat;
  document.getElementById("ed-lng").value = p.lng;
  document.getElementById("ed-surface").value = p.surfacing_material || "";
  document.getElementById("ed-water").value = p.water_fountains ?? "";
  edSetTri("washroom_nearby", p.washroom_nearby);
  edSetTri("parking", p.parking);
  edSetTri("shade", p.shade);
  edSetTri("fenced", p.fenced);
  edSetTri("water_access", p.water_access);
  for (const k of Object.keys(A11Y_LABELS)) edSetTri(k, p[k]);
  document.getElementById("ed-notes").value = p.notes || "";
  document.getElementById("ed-review").value = p.review_comment || "";
  document.getElementById("ed-a11y-notes").value = p.accessibility_notes || "";
  const eq = document.getElementById("ed-equipment");
  eq.innerHTML = "";
  (p.equipment || []).forEach((item) => edAddEquip(item));
  syncEditorType(p.location_type || "playground");
  document.getElementById("editor").showModal();
}

async function saveEdit(e) {
  e.preventDefault();
  const p = A.editing;
  const type = document.getElementById("ed-type").value;
  const equipment = type !== "playground" ? [] :
    [...document.querySelectorAll("#ed-equipment .equip-entry")].map((div) => {
      const o = {};
      div.querySelectorAll("[data-k]").forEach((el) => { o[el.dataset.k] = el.value || null; });
      if (!o.notes) delete o.notes;
      return o;
    }).filter((o) => o.equipment_type && o.age_group && o.condition);
  const body = {
    name: document.getElementById("ed-name").value.trim(),
    location_type: type,
    city: document.getElementById("ed-city").value.trim() || null,
    address: document.getElementById("ed-address").value.trim() || null,
    lat: parseFloat(document.getElementById("ed-lat").value),
    lng: parseFloat(document.getElementById("ed-lng").value),
    surfacing_material: document.getElementById("ed-surface").value || null,
    washroom_nearby: edTriValue("washroom_nearby"),
    water_fountains: document.getElementById("ed-water").value === "" ? null : Number(document.getElementById("ed-water").value),
    parking: edTriValue("parking"),
    shade: edTriValue("shade"),
    fenced: edTriValue("fenced"),
    water_access: edTriValue("water_access"),
    notes: document.getElementById("ed-notes").value.trim() || null,
    review_comment: document.getElementById("ed-review").value.trim() || null,
    accessibility: Object.fromEntries(
      Object.keys(A11Y_LABELS).map((k) => [k, edTriValue(k)]).concat(
        [["accessibility_notes", document.getElementById("ed-a11y-notes").value.trim() || null]])),
    equipment,
  };
  const errEl = document.getElementById("ed-error");
  errEl.classList.add("hidden");
  try {
    await API.put(`/api/admin/parks/${p.id}`, body, A.token);
    document.getElementById("editor").close();
    loadQueue();
  } catch (err) {
    errEl.textContent = "Save failed: " + err.message +
      (type === "playground" && !equipment.length ? " (a playground needs at least one complete equipment row)" : "");
    errEl.classList.remove("hidden");
  }
}

/* --- Revision change summary (I1) --------------------------------------------
   Approving a revision REPLACES the current public snapshot, so the moderator
   must see what would disappear. The predecessor is always an approved park
   (enforced at submission time), so the public endpoint suffices. */
async function enhanceRevisionDiffs(parks) {
  for (const p of parks) {
    if (p.status !== "pending" || !p.revision_of_id) continue;
    const el = document.querySelector(`.rev-diff[data-newid="${p.id}"]`);
    if (!el) continue;
    try {
      const old = await API.get(`/api/parks/${p.revision_of_id}`);
      el.innerHTML = diffSummary(old, p);
    } catch {
      el.textContent =
        "Previous version unavailable (archived or deleted) — review this as a full replacement.";
    }
  }
}

function diffSummary(oldP, newP) {
  const key = (e) => `${e.equipment_type} (${e.age_group})`;
  const tripleKey = (e) => `${e.equipment_type}|${e.age_group}|${e.condition}`;
  const count = (list) => list.reduce((m, k) => ((m[k] = (m[k] || 0) + 1), m), {});
  const oldC = count(oldP.equipment.map(key));
  const newC = count(newP.equipment.map(key));
  const removed = [], added = [];
  for (const k of new Set([...Object.keys(oldC), ...Object.keys(newC)])) {
    const d = (newC[k] || 0) - (oldC[k] || 0);
    if (d < 0) removed.push(`${k}${d < -1 ? ` ×${-d}` : ""}`);
    if (d > 0) added.push(`${k}${d > 1 ? ` ×${d}` : ""}`);
  }
  const condOnly =
    !removed.length && !added.length &&
    JSON.stringify(count(oldP.equipment.map(tripleKey))) !==
      JSON.stringify(count(newP.equipment.map(tripleKey)));
  const fields = [];
  if ((oldP.location_type || "playground") !== (newP.location_type || "playground")) fields.push("location type");
  if ((oldP.surfacing_material || null) !== (newP.surfacing_material || null)) fields.push("surfacing");
  if (oldP.washroom_nearby !== newP.washroom_nearby) fields.push("washroom");
  if (oldP.water_fountains !== newP.water_fountains) fields.push("water fountains");
  if (oldP.parking !== newP.parking) fields.push("parking");
  if (oldP.shade !== newP.shade) fields.push("shade");
  if (oldP.fenced !== newP.fenced) fields.push("fenced");
  if (oldP.water_access !== newP.water_access) fields.push("water entry");
  if ((oldP.address || null) !== (newP.address || null)) fields.push("address");
  for (const k of Object.keys(A11Y_LABELS)) {
    if (oldP[k] !== newP[k]) fields.push(A11Y_LABELS[k].toLowerCase());
  }
  const parts = [
    `<b>Change summary vs current version:</b> equipment ${oldP.equipment.length} → ${newP.equipment.length}`,
  ];
  if (removed.length)
    parts.push(`<span style="color:#8c2f2f"><b>⚠ Removed:</b> ${removed.map(escapeHtml).join(", ")}</span>`);
  if (added.length) parts.push(`<b>Added:</b> ${added.map(escapeHtml).join(", ")}`);
  if (condOnly) parts.push("condition updates");
  if (fields.length) parts.push(`Changed: ${escapeHtml(fields.join(", "))}`);
  if (parts.length === 1) parts.push("no equipment or amenity changes detected");
  return parts.join(" · ");
}

function queueError(msg) {
  const el = document.getElementById("queue-error");
  el.textContent = msg;
  el.classList.remove("hidden");
}
