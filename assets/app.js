(function () {
  "use strict";

  const TZ = "Europe/Paris";
  // Fetched from the "data" branch on raw.githubusercontent.com rather
  // than through the Pages deployment on "main": this file updates on
  // every git push with no build step, and since Pages only watches
  // "main", pushes here never trigger a site rebuild.
  const DATA_URL = "https://raw.githubusercontent.com/sebeauvoir/velov/data/data/history.jsonl";
  const WEEKDAYS = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];

  const els = {
    subtitle: document.getElementById("subtitle"),
    statusBanner: document.getElementById("status-banner"),
    content: document.getElementById("content"),
    emptyState: document.getElementById("empty-state"),
    tiles: document.getElementById("tiles"),
    globalStats: document.getElementById("global-stats"),
    rangeButtons: document.getElementById("range-buttons"),
    themeToggle: document.getElementById("theme-toggle"),
  };

  let records = [];
  let tsChart = null;
  let hourChart = null;
  let weekdayChart = null;
  let currentRange = "all";

  initTheme();
  els.themeToggle.addEventListener("click", toggleTheme);

  fetch(DATA_URL, { cache: "no-store" })
    .then((res) => {
      if (!res.ok) throw new Error("HTTP " + res.status);
      return res.text();
    })
    .then((text) => {
      records = parseJsonl(text);
      if (records.length === 0) {
        showEmpty();
        return;
      }
      render();
    })
    .catch((err) => {
      console.error("Failed to load station history", err);
      showEmpty();
    });

  function parseJsonl(text) {
    const out = [];
    const lines = text.split("\n");
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        const rec = JSON.parse(trimmed);
        if (typeof rec.bikes === "number" && typeof rec.stands === "number") {
          out.push(rec);
        }
      } catch (e) {
        /* skip malformed line */
      }
    }
    out.sort((a, b) => new Date(a.ts) - new Date(b.ts));
    return out;
  }

  function showEmpty() {
    els.subtitle.textContent = "En attente des premières données";
    els.emptyState.style.display = "block";
    els.content.style.display = "none";
  }

  function render() {
    els.emptyState.style.display = "none";
    els.content.style.display = "block";

    const latest = records[records.length - 1];
    renderSubtitleAndBanner(latest);
    renderTiles(latest);
    renderGlobalStats();
    renderTimeseries(currentRange);
    renderHourly();
    renderWeekday();

    els.rangeButtons.addEventListener("click", (e) => {
      const btn = e.target.closest("button[data-range]");
      if (!btn) return;
      currentRange = btn.dataset.range;
      for (const b of els.rangeButtons.querySelectorAll("button")) {
        b.classList.toggle("active", b === btn);
      }
      renderTimeseries(currentRange);
    });
  }

  function renderSubtitleAndBanner(latest) {
    const lastDate = new Date(latest.ts);
    els.subtitle.textContent =
      "Dernière mise à jour : " + formatDateTime(lastDate) + " · " + records.length + " relevés";

    const ageMinutes = (Date.now() - lastDate.getTime()) / 60000;
    if (ageMinutes > 45) {
      els.statusBanner.classList.add("visible");
      els.statusBanner.textContent =
        "⚠ Dernier relevé il y a " + Math.round(ageMinutes) + " min : la collecte automatique semble interrompue.";
    } else {
      els.statusBanner.classList.remove("visible");
    }
  }

  function renderTiles(latest) {
    const occupancy = latest.capacity ? Math.round((latest.bikes / latest.capacity) * 100) : null;
    const isOpen = String(latest.status).toUpperCase() === "OPEN";

    const tiles = [
      { label: "Vélos disponibles", value: latest.bikes, sub: "sur " + latest.capacity + " bornes" },
      { label: "Places disponibles", value: latest.stands, sub: "" },
      { label: "Taux d'occupation", value: occupancy !== null ? occupancy + "%" : "—", sub: "" },
      {
        label: "Statut station",
        value: '<span class="badge ' + (isOpen ? "open" : "closed") + '">' + (isOpen ? "Ouverte" : "Fermée") + "</span>",
        sub: "",
        small: true,
        html: true,
      },
    ];

    els.tiles.innerHTML = tiles
      .map(
        (t) =>
          '<div class="tile"><div class="label">' +
          t.label +
          '</div><div class="value' +
          (t.small ? " small" : "") +
          '">' +
          (t.html ? t.value : escapeHtml(String(t.value))) +
          "</div>" +
          (t.sub ? '<div class="sub">' + t.sub + "</div>" : "") +
          "</div>"
      )
      .join("");
  }

  function renderGlobalStats() {
    let minBikes = Infinity;
    let minAt = null;
    let maxBikes = -Infinity;
    let maxAt = null;
    let occSum = 0;
    let occCount = 0;
    let openCount = 0;

    for (const r of records) {
      if (r.bikes < minBikes) {
        minBikes = r.bikes;
        minAt = r.ts;
      }
      if (r.bikes > maxBikes) {
        maxBikes = r.bikes;
        maxAt = r.ts;
      }
      if (r.capacity) {
        occSum += r.bikes / r.capacity;
        occCount++;
      }
      if (String(r.status).toUpperCase() === "OPEN") openCount++;
    }

    const avgOcc = occCount ? Math.round((occSum / occCount) * 100) : null;
    const uptimePct = records.length ? Math.round((openCount / records.length) * 100) : null;
    const first = records[0];
    const since = formatDate(new Date(first.ts));

    const stats = [
      { label: "Relevés collectés", value: records.length, sub: "depuis le " + since },
      { label: "Min. vélos observé", value: minBikes, sub: minAt ? formatDateTime(new Date(minAt)) : "" },
      { label: "Max. vélos observé", value: maxBikes, sub: maxAt ? formatDateTime(new Date(maxAt)) : "" },
      { label: "Occupation moyenne", value: avgOcc !== null ? avgOcc + "%" : "—", sub: "vélos / capacité" },
      { label: "Disponibilité station", value: uptimePct !== null ? uptimePct + "%" : "—", sub: "part des relevés 'ouverte'" },
    ];

    els.globalStats.innerHTML = stats
      .map(
        (t) =>
          '<div class="tile"><div class="label">' +
          t.label +
          '</div><div class="value small">' +
          escapeHtml(String(t.value)) +
          "</div>" +
          (t.sub ? '<div class="sub">' + escapeHtml(t.sub) + "</div>" : "") +
          "</div>"
      )
      .join("");
  }

  function renderTimeseries(range) {
    let filtered = records;
    if (range !== "all") {
      const hours = Number(range);
      const cutoff = Date.now() - hours * 3600 * 1000;
      filtered = records.filter((r) => new Date(r.ts).getTime() >= cutoff);
    }

    const MAX_POINTS = 600;
    if (filtered.length > MAX_POINTS) {
      const step = Math.ceil(filtered.length / MAX_POINTS);
      filtered = filtered.filter((_, i) => i % step === 0);
    }

    const labels = filtered.map((r) => new Date(r.ts));
    const bikes = filtered.map((r) => r.bikes);
    const stands = filtered.map((r) => r.stands);
    const styles = chartStyles();

    if (tsChart) tsChart.destroy();
    tsChart = new Chart(document.getElementById("chart-timeseries"), {
      type: "line",
      data: {
        labels,
        datasets: [
          lineDataset("Vélos disponibles", bikes, styles.series1),
          lineDataset("Places disponibles", stands, styles.series2),
        ],
      },
      options: baseLineOptions(styles, true),
    });
  }

  function renderHourly() {
    const buckets = Array.from({ length: 24 }, () => ({ bikes: 0, stands: 0, n: 0 }));
    for (const r of records) {
      const h = localParts(r.ts).hour;
      buckets[h].bikes += r.bikes;
      buckets[h].stands += r.stands;
      buckets[h].n++;
    }
    const avgBikes = buckets.map((b) => (b.n ? b.bikes / b.n : 0));
    const avgStands = buckets.map((b) => (b.n ? b.stands / b.n : 0));
    const labels = Array.from({ length: 24 }, (_, h) => String(h).padStart(2, "0") + "h");
    const styles = chartStyles();

    if (hourChart) hourChart.destroy();
    hourChart = new Chart(document.getElementById("chart-hourly"), {
      type: "bar",
      data: {
        labels,
        datasets: [barDataset("Vélos disponibles (moy.)", avgBikes, styles.series1)],
      },
      options: baseBarOptions(styles),
    });

    const tbody = document.querySelector("#table-hourly tbody");
    tbody.innerHTML = labels
      .map(
        (l, i) =>
          "<tr><td>" + l + "</td><td>" + avgBikes[i].toFixed(1) + "</td><td>" + avgStands[i].toFixed(1) + "</td></tr>"
      )
      .join("");
  }

  function renderWeekday() {
    const buckets = Array.from({ length: 7 }, () => ({ bikes: 0, stands: 0, n: 0 }));
    for (const r of records) {
      const d = localParts(r.ts).weekday;
      buckets[d].bikes += r.bikes;
      buckets[d].stands += r.stands;
      buckets[d].n++;
    }
    // Reorder Mon..Sun for display
    const order = [1, 2, 3, 4, 5, 6, 0];
    const labels = order.map((d) => WEEKDAYS[d]);
    const avgBikes = order.map((d) => (buckets[d].n ? buckets[d].bikes / buckets[d].n : 0));
    const avgStands = order.map((d) => (buckets[d].n ? buckets[d].stands / buckets[d].n : 0));
    const styles = chartStyles();

    if (weekdayChart) weekdayChart.destroy();
    weekdayChart = new Chart(document.getElementById("chart-weekday"), {
      type: "bar",
      data: {
        labels,
        datasets: [barDataset("Vélos disponibles (moy.)", avgBikes, styles.series1)],
      },
      options: baseBarOptions(styles),
    });

    const tbody = document.querySelector("#table-weekday tbody");
    tbody.innerHTML = labels
      .map(
        (l, i) =>
          "<tr><td>" + l + "</td><td>" + avgBikes[i].toFixed(1) + "</td><td>" + avgStands[i].toFixed(1) + "</td></tr>"
      )
      .join("");
  }

  function localParts(isoTs) {
    const d = new Date(isoTs);
    const fmt = new Intl.DateTimeFormat("en-US", {
      timeZone: TZ,
      hour: "2-digit",
      hour12: false,
      weekday: "short",
    });
    const parts = fmt.formatToParts(d);
    let hour = 0;
    let weekdayShort = "Sun";
    for (const p of parts) {
      if (p.type === "hour") hour = Number(p.value) % 24;
      if (p.type === "weekday") weekdayShort = p.value;
    }
    const map = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
    return { hour, weekday: map[weekdayShort] ?? 0 };
  }

  function formatDateTime(d) {
    return new Intl.DateTimeFormat("fr-FR", {
      timeZone: TZ,
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).format(d);
  }

  function formatDate(d) {
    return new Intl.DateTimeFormat("fr-FR", { timeZone: TZ, day: "2-digit", month: "2-digit", year: "numeric" }).format(d);
  }

  function escapeHtml(str) {
    return str.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  function chartStyles() {
    const cs = getComputedStyle(document.documentElement);
    return {
      series1: cs.getPropertyValue("--series-1").trim(),
      series2: cs.getPropertyValue("--series-2").trim(),
      textSecondary: cs.getPropertyValue("--text-secondary").trim(),
      muted: cs.getPropertyValue("--text-muted").trim(),
      grid: cs.getPropertyValue("--gridline").trim(),
      baseline: cs.getPropertyValue("--baseline").trim(),
    };
  }

  function lineDataset(label, data, color) {
    return {
      label,
      data,
      borderColor: color,
      backgroundColor: color,
      borderWidth: 2,
      pointRadius: 0,
      pointHoverRadius: 4,
      tension: 0.15,
      spanGaps: true,
    };
  }

  function barDataset(label, data, color) {
    return {
      label,
      data,
      backgroundColor: color,
      borderRadius: 4,
      maxBarThickness: 28,
    };
  }

  function baseLineOptions(styles, timeAxis) {
    return {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: "index", intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: styles.series1,
          titleColor: "#fff",
          bodyColor: "#fff",
        },
      },
      scales: {
        x: {
          type: timeAxis ? "time" : "category",
          time: timeAxis ? { tooltipFormat: "dd/MM HH:mm" } : undefined,
          grid: { color: styles.grid },
          ticks: { color: styles.muted, maxRotation: 0 },
          border: { color: styles.baseline },
        },
        y: {
          beginAtZero: true,
          grid: { color: styles.grid },
          ticks: { color: styles.muted },
          border: { color: styles.baseline },
        },
      },
    };
  }

  function baseBarOptions(styles) {
    return {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: {
          grid: { display: false },
          ticks: { color: styles.muted },
          border: { color: styles.baseline },
        },
        y: {
          beginAtZero: true,
          grid: { color: styles.grid },
          ticks: { color: styles.muted },
          border: { color: styles.baseline },
        },
      },
    };
  }

  function initTheme() {
    let saved = null;
    try {
      saved = localStorage.getItem("velov-theme");
    } catch (e) {
      /* ignore */
    }
    if (saved === "dark" || saved === "light") {
      document.documentElement.setAttribute("data-theme", saved);
    }
  }

  function toggleTheme() {
    const current = document.documentElement.getAttribute("data-theme");
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const effectiveCurrent = current || (prefersDark ? "dark" : "light");
    const next = effectiveCurrent === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    try {
      localStorage.setItem("velov-theme", next);
    } catch (e) {
      /* ignore */
    }
    if (records.length) {
      renderTimeseries(currentRange);
      renderHourly();
      renderWeekday();
    }
  }
})();
