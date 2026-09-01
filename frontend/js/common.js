/* Shared utilities: API client, location-type + age-shape system, markers. */
"use strict";

const API = {
  async get(path) {
    const res = await fetch(path);
    if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
    return res.json();
  },
  async post(path, body, token) {
    const headers = { "Content-Type": "application/json" };
    if (token) headers.Authorization = `Bearer ${token}`;
    const res = await fetch(path, { method: "POST", headers, body: JSON.stringify(body) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.detail ? JSON.stringify(data.detail) : res.status);
    return data;
  },
  async put(path, body, token) {
    const headers = { "Content-Type": "application/json" };
    if (token) headers.Authorization = `Bearer ${token}`;
    const res = await fetch(path, { method: "PUT", headers, body: JSON.stringify(body) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.detail ? JSON.stringify(data.detail) : res.status);
    return data;
  },
};

/* Location types (2026 recreation-location model) */
const LOC_META = {
  playground: { label: "Playground", plural: "Playgrounds", icon: "nature_people" },
  splash_pad: { label: "Splash pad", plural: "Splash pads", icon: "water_drop" },
  beach: { label: "Beach", plural: "Beaches", icon: "beach_access" },
};
function locLabel(t) { return (LOC_META[t] || LOC_META.playground).label; }
/* Not label + "s" — that produced "Beachs". */
function locPlural(t) { return (LOC_META[t] || LOC_META.playground).plural; }
function locIcon(t) { return (LOC_META[t] || LOC_META.playground).icon; }

/* Age groups are labelled, never glyphed. The old circle/diamond/triangle set
   needed a legend to decode, and a human-figure icon set would bake in
   skin-tone and ability assumptions. Colour reinforces, text carries. */
/* Short keys for the tinted filter chips; the darkened text colours they pair
   with already exist in style.css as the .tag.age-* pairs. */
const AGE_KEY = {
  "Toddler (6-23 months)": "t",
  "Pre-schoolers (2-5 years)": "p",
  "School-age (5-12 years)": "s",
};
const AGE_SHORT = {
  "Toddler (6-23 months)": "Toddlers",
  "Pre-schoolers (2-5 years)": "Preschool",
  "School-age (5-12 years)": "School age",
};
function getCss(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}
const AGE_COLORS = {
  "Toddler (6-23 months)": getCss("--age-toddler"),
  "Pre-schoolers (2-5 years)": getCss("--age-preschool"),
  "School-age (5-12 years)": getCss("--age-school"),
};
const CONDITION_COLORS = {
  "Like new": getCss("--cond-good"),
  "Acceptable": getCss("--cond-fair"),
  "Very old": getCss("--cond-poor"),
};
const SURFACE_COLORS = ["#b0793f", "#5fb3d9", "#e0c36b", "#8bbf7a", "#a58ad1", "#c9c9c9"];

/** Age groups as labelled, colour-tinted chips. Shared by the result cards
    and the map popup so the two never drift. */
function ageChipsHtml(park) {
  return (park.age_groups_present || []).map((a) =>
    `<span class="age-chip age-${AGE_KEY[a] || "t"}">${escapeHtml(AGE_SHORT[a] || a)}</span>`
  ).join("");
}

/** Leaflet divIcon: a circular marker coloured by location type (Stitch).
    A marker only has to say what kind of place this is — age groups moved to
    the popup, where they can be labelled properly. */
function parkIcon(park, highlighted) {
  const t = park.location_type || "playground";
  const size = highlighted ? 38 : 30;
  return L.divIcon({
    className: "",
    html: `<div class="park-marker t-${t}${highlighted ? " hl" : ""}" role="img" aria-label="${escapeHtml(locLabel(t))}: ${escapeHtml(park.name)}"><span class="ms" aria-hidden="true">${locIcon(t)}</span></div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -size / 2],
  });
}

function boolIcon(v, yes, no, unknown) {
  if (v === true) return yes;
  if (v === false) return no;
  return unknown;
}

const A11Y_LABELS = {
  accessible_parking: "Accessible parking",
  accessible_washroom: "Accessible washroom",
  step_free_access: "Step-free access",
  accessible_surfacing: "Accessible surfacing",
  inclusive_equipment: "Inclusive equipment",
};
const FACILITY_META = [
  ["washroom_nearby", "Washroom", "wc"],
  ["water_fountains", "Water fountain", "water_full"],
  ["parking", "Parking", "local_parking"],
  ["shade", "Shade area", "nature"],
  ["fenced", "Fenced", "fence"],
  ["water_access", "Accessible water entry", "pool"],
];
function isAccessible(p) {
  return p.step_free_access === true || p.inclusive_equipment === true ||
         p.accessible_surfacing === true;
}

/* Popup: name, age groups, Learn more. The marker no longer encodes age, so
   the groups are spelled out here instead of shown as bare glyphs. */
function popupHtml(park) {
  const t = park.location_type || "playground";
  const facts = [locLabel(t), park.city || "",
                 isAccessible(park) ? "♿ Accessible features" : ""]
    .filter(Boolean).join(" · ");
  const ages = ageChipsHtml(park);
  return `<div class="popup">
    <h3>${escapeHtml(park.name)}</h3>
    <div class="sub">${escapeHtml(facts)}</div>
    ${ages ? `<div class="age-chips">${ages}</div>` : ""}
    <p style="margin:0.6rem 0 0"><a class="btn btn-primary btn-sm" href="/park.html?id=${park.id}">Learn more</a></p>
  </div>`;
}

function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}

function makeBaseMap(el, meta) {
  const map = L.map(el, { scrollWheelZoom: true }).setView(meta.map.start, meta.map.zoom);
  L.tileLayer(meta.map.tile_url, { attribution: meta.map.tile_attribution, maxZoom: 19 }).addTo(map);

  // Leaflet measures the container once, at construction. On phones the shell
  // is still settling (fonts, stacked grid, address bar) when that happens, so
  // a map built against a zero-height box stays stuck at world zoom. Re-measure
  // whenever the container actually changes size.
  if (typeof ResizeObserver === "function") {
    let seen = false;
    new ResizeObserver(() => {
      map.invalidateSize({ animate: false });
      if (!seen && el.clientHeight > 0) {       // first real layout: restore the
        seen = true;                            // intended view, not the fallback
        map.setView(meta.map.start, meta.map.zoom, { animate: false });
      }
    }).observe(el);
  }
  window.addEventListener("orientationchange", () => {
    setTimeout(() => map.invalidateSize({ animate: false }), 200);
  });
  return map;
}

/* ---- Mobile navigation --------------------------------------------------
   Shared by every page: the header collapses its links behind a toggle below
   860px (see the matching breakpoint in style.css). */
(function mobileNav() {
  const wire = () => {
    const btn = document.getElementById("nav-toggle");
    const nav = document.getElementById("site-nav");
    if (!btn || !nav) return;

    const setOpen = (open) => {
      btn.setAttribute("aria-expanded", String(open));
      nav.dataset.open = String(open);
      btn.querySelector(".ms").textContent = open ? "close" : "menu";
    };
    setOpen(false);

    btn.addEventListener("click", () => {
      setOpen(btn.getAttribute("aria-expanded") !== "true");
    });
    // Follow a link, then close, so the panel never covers the destination.
    nav.addEventListener("click", (e) => { if (e.target.closest("a")) setOpen(false); });
    document.addEventListener("keydown", (e) => { if (e.key === "Escape") setOpen(false); });
    // Widening past the breakpoint reveals the links again; drop the open state
    // so the toggle and the panel never disagree.
    matchMedia("(min-width: 861px)").addEventListener("change", (e) => {
      if (e.matches) setOpen(false);
    });
  };
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", wire);
  } else {
    wire();
  }
})();
