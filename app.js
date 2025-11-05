(function () {
  const api = window.TrafikverketAPI;
  const qs = (sel, el = document) => el.querySelector(sel);
  const qsa = (sel, el = document) => [...el.querySelectorAll(sel)];

  const loader = qs("#loader");
  const statusEl = qs("#status");
  const stationInput = qs("#station-input");
  const datalist = qs("#stations");
  const tbody = qs("#departures-body");
  const eventsList = qs("#events-list");

  const stationMap = new Map();

  function setLoading(isLoading) {
    console.log('setLoading called with:', isLoading);
    loader.hidden = !isLoading;
    loader.style.display = isLoading ? 'grid' : 'none';  // Explicit display control
    loader.setAttribute("aria-hidden", String(!isLoading));
    console.log('loader.hidden:', loader.hidden);
  }
  function setStatus(msg, type = "") {
    statusEl.textContent = msg || "";
    statusEl.className = type || "";
  }

  function timeStr(iso) {
    const d = new Date(iso);
    if (Number.isNaN(+d)) return "";
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }

  function resolveToNames(toLocation) {
    if (!toLocation) return [];
    const arr = Array.isArray(toLocation) ? toLocation : [toLocation];
    return arr
      .map((item) => {
        if (typeof item === "string") return stationMap.get(item) || item;
        if (item?.LocationSignature)
          return (
            stationMap.get(item.LocationSignature) || item.LocationSignature
          );
        if (item?.LocationName)
          return stationMap.get(item.LocationName) || item.LocationName;
        return String(item);
      })
      .filter(Boolean);
  }

  function renderDepartures(items) {
    tbody.innerHTML = "";
    if (!items || items.length === 0) {
      const tr = document.createElement("tr");
      tr.className = "placeholder";
      tr.innerHTML = `<td colspan="4">No departures found</td>`;
      tbody.appendChild(tr);
      return;
    }
    for (const it of items) {
      const time = timeStr(
        it.AdvertisedTimeAtLocation || it.EstimatedTimeAtLocation
      );
      const to = resolveToNames(it.ToLocation).join(", ");
      const owner = it.InformationOwner || "";
      const track = it.TrackAtLocation || "";
      const tr = document.createElement("tr");
      tr.innerHTML = `<td>${time}</td><td>${to}</td><td>${owner}</td><td>${track}</td>`;
      tbody.appendChild(tr);
    }
  }

  async function loadStations() {
    setLoading(true);
    setStatus("Loading stations…");
    
    // Force loader to hide after 5 seconds as a fallback
    setTimeout(() => setLoading(false), 5000);
    
    try {
      api.tvAssertApiKey();
      const stations = await api.tvFetchStations();
      for (const s of stations) {
        stationMap.set(s.sign, s.name);
      }
      const list = stations
        .filter((s) => s.prognosticated)
        .sort((a, b) => a.name.localeCompare(b.name));
      datalist.innerHTML = "";
      for (const s of list) {
        const opt = document.createElement("option");
        opt.value = s.name;
        opt.label = s.sign;
        opt.dataset.sign = s.sign;
        datalist.appendChild(opt);
      }
      setStatus(`Ready – ${list.length} stations`, "success");
    } catch (err) {
      console.error(err);
      setStatus(err?.message || "Could not load stations", "error");
    } finally {
      setLoading(false);
    }
  }

  function findSignatureFromInput() {
    const val = stationInput.value.trim();
    if (!val) return "";
    const opt = qsa("option", datalist).find((o) => o.value === val);
    if (opt?.dataset?.sign) return opt.dataset.sign;
    if (stationMap.has(val.toUpperCase())) return val.toUpperCase();
    const found = qsa("option", datalist).find(
      (o) => o.value.toLowerCase() === val.toLowerCase()
    );
    if (found?.dataset?.sign) return found.dataset.sign;
    return "";
  }

  async function onSearch(ev) {
    ev.preventDefault();
    const sign = findSignatureFromInput();
    if (!sign) {
      setStatus(
        "Select a station from the list or enter a signature.",
        "error"
      );
      stationInput.focus();
      return;
    }
    setLoading(true);
    setStatus("Fetching departures…");
    try {
      const data = await api.tvFetchDepartures(sign);
      renderDepartures(data);
      setStatus(`Showing departures for ${stationMap.get(sign) || sign}`);
    } catch (err) {
      console.error(err);
      renderDepartures([]);
      setStatus(err?.message || "Could not fetch departures", "error");
    } finally {
      setLoading(false);
    }
  }

  async function loadEvents() {
    try {
      const events = await api.tvFetchOperativeEvents();
      eventsList.innerHTML = "";
      if (
        window.FEATURES &&
        window.FEATURES.OPERATIVE_EVENTS_AVAILABLE === false
      ) {
        const li = document.createElement("li");
        li.className = "placeholder";
        li.textContent = "Operative events are not available for your API key.";
        eventsList.appendChild(li);
        return;
      }
      if (!events || events.length === 0) {
        const li = document.createElement("li");
        li.className = "placeholder";
        li.textContent = "No active events right now.";
        eventsList.appendChild(li);
        return;
      }
      for (const e of events.slice(0, 25)) {
        const li = document.createElement("li");
        li.className = "event-card";
        const type = e.EventType?.Description || "Event";
        const start = timeStr(e.StartDateTime);
        const sections = (e.EventSection || [])
          .map((sec) => {
            const parts = [
              sec.FromLocation?.Signature,
              sec.ViaLocation?.Signature,
              sec.ToLocation?.Signature,
            ].filter(Boolean);
            return parts.map((p) => stationMap.get(p) || p).join(" – ");
          })
          .filter(Boolean);
        li.innerHTML = `<b>${type}</b> • start ${start}${
          sections.length ? ` • ${sections.join("; ")}` : ""
        }`;
        eventsList.appendChild(li);
      }
    } catch (err) {
      console.warn("Could not load events:", err?.message || err);
      const li = document.createElement("li");
      li.className = "placeholder";
      li.textContent = "Could not load events.";
      eventsList.appendChild(li);
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    qs("#search-form").addEventListener("submit", onSearch);
    loadStations().then(loadEvents);
  });
})();
