(function () {
  "use strict";

  const STATIONS_URL = "https://raw.githubusercontent.com/sebeauvoir/velov/data/data/stations.json";
  const DEFAULT_STATION = { number: 13001, name: "Décines Centre" };
  const LYON_CENTER = [45.764, 4.8357];

  function cleanName(name) {
    return String(name || "").replace(/^\d+\s*-\s*/, "");
  }

  const map = L.map("map").setView(LYON_CENTER, 12);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  }).addTo(map);

  let markers = new Map(); // number -> marker
  let selectedNumber = null;

  const rootStyle = getComputedStyle(document.documentElement);
  const seriesColor = rootStyle.getPropertyValue("--series-1").trim();
  const selectedColor = rootStyle.getPropertyValue("--series-2").trim();

  function markerStyle(selected) {
    return {
      radius: selected ? 8 : 5,
      weight: selected ? 3 : 1,
      color: selected ? selectedColor : seriesColor,
      fillColor: seriesColor,
      fillOpacity: 0.8,
    };
  }

  function selectStation(number, name) {
    if (markers.has(selectedNumber)) markers.get(selectedNumber).setStyle(markerStyle(false));
    selectedNumber = number;
    if (markers.has(number)) markers.get(number).setStyle(markerStyle(true));

    const params = new URLSearchParams(location.search);
    params.set("station", number);
    history.replaceState(null, "", "?" + params.toString());

    if (window.VelovApp) window.VelovApp.loadStation(number, name);
  }
  window.VelovSelectStation = selectStation;

  fetch(STATIONS_URL, { cache: "no-store" })
    .then((res) => {
      if (!res.ok) throw new Error("HTTP " + res.status);
      return res.json();
    })
    .then((stations) => {
      const bounds = [];
      for (const s of stations) {
        if (typeof s.lat !== "number" || typeof s.lng !== "number") continue;
        const marker = L.circleMarker([s.lat, s.lng], markerStyle(false)).addTo(map);
        marker.bindPopup(
          '<div class="station-popup"><div class="name">' +
            escapeHtml(cleanName(s.name) || "Station " + s.number) +
            '</div><button type="button">Voir les stats</button></div>'
        );
        marker.on("popupopen", (e) => {
          e.popup._contentNode
            .querySelector("button")
            .addEventListener("click", () => selectStation(s.number, cleanName(s.name)));
        });
        marker.on("click", () => selectStation(s.number, cleanName(s.name)));
        markers.set(s.number, marker);
        bounds.push([s.lat, s.lng]);
      }
      if (bounds.length) map.fitBounds(bounds, { padding: [20, 20], maxZoom: 13 });

      const params = new URLSearchParams(location.search);
      const requested = Number(params.get("station"));
      const found = stations.find((s) => s.number === requested);
      const initial = found ? { number: found.number, name: cleanName(found.name) } : DEFAULT_STATION;
      selectStation(initial.number, initial.name);
    })
    .catch((err) => {
      console.error("Failed to load station list", err);
      // Fall back to the default station even if the map/list failed to load.
      selectStation(DEFAULT_STATION.number, DEFAULT_STATION.name);
    });

  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }
})();
