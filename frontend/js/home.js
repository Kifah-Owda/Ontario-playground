/* Landing page: the map tile.

   The tile is a link, not a map you drive. Every Leaflet interaction handler is
   off, so a drag never fights the navigation — the whole tile stays one target.
   If anything here fails (offline, API down, tiles blocked) the tile degrades to
   its mint background and still links through to the dashboard. */
"use strict";

(async function homeMap() {
  const host = document.getElementById("home-map");
  if (!host || typeof L === "undefined") return;

  let meta, parks;
  try {
    [meta, parks] = await Promise.all([API.get("/api/meta"), API.get("/api/parks")]);
  } catch {
    return;                                  // tile keeps its placeholder styling
  }

  const count = document.getElementById("home-count");
  if (count && parks.length) {
    count.textContent = `${parks.length} place${parks.length === 1 ? "" : "s"} across Ontario`;
  }

  const map = L.map(host, {
    zoomControl: false, attributionControl: false,
    dragging: false, scrollWheelZoom: false, doubleClickZoom: false,
    boxZoom: false, keyboard: false, touchZoom: false, tap: false,
  }).setView(meta.map.start, meta.map.zoom);

  L.tileLayer(meta.map.tile_url, { maxZoom: 19 }).addTo(map);

  // OpenStreetMap's licence requires visible credit even on a preview. Pinned
  // top-right so it clears the "Open map" bar along the bottom edge.
  L.control.attribution({ position: "topright", prefix: false })
    .addAttribution(meta.map.tile_attribution)
    .addTo(map);

  parks.forEach((p) => {
    if (p.lat == null || p.lng == null) return;
    L.marker([p.lat, p.lng], { icon: parkIcon(p, false), keyboard: false,
                               interactive: false }).addTo(map);
  });

  // Fit the pins when there are enough to define a region, so the tile always
  // shows populated map rather than empty countryside.
  const pts = parks.filter((p) => p.lat != null && p.lng != null)
                   .map((p) => [p.lat, p.lng]);
  if (pts.length > 1) {
    map.fitBounds(L.latLngBounds(pts).pad(0.15), { animate: false });
  }

  // Same reason as the dashboard map: the container is still settling when
  // Leaflet takes its one measurement.
  if (typeof ResizeObserver === "function") {
    new ResizeObserver(() => map.invalidateSize({ animate: false })).observe(host);
  }
})();
