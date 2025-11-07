(function () {
  const api = window.TrafikverketAPI;
  const qs = (sel, el = document) => el.querySelector(sel);
  const qsa = (sel, el = document) => [...el.querySelectorAll(sel)];
  const statusEl = qs("#status");
  const stationInput = null;
  const datalist = null;
  const menuEl = qs("#menu");
  const stationMap = new Map();

  function setStatus(msg, type = "") {
    statusEl.textContent = msg || "";
    statusEl.className = type || "";
  }

  function timeStr(iso) {
    const d = new Date(iso);
    if (Number.isNaN(+d)) return "";
    return d.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
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
    menuEl.innerHTML = "";
    if (!items || items.length === 0) {
      const empty = document.createElement("div");
      empty.className = "menu-item";
      empty.innerHTML = `<p class="menu-item__day">No departures</p><span class="menu-item__divider"></span><div class="menu-item__meals"><p class="menu-item__meals-item"><span class="icon">🛤️</span><span>No trains found</span></p></div>`;
      menuEl.appendChild(empty);
      return;
    }
    for (const it of items) {
      const timeIso = it.AdvertisedTimeAtLocation || it.EstimatedTimeAtLocation;
      const time = timeStr(timeIso);
      const to = resolveToNames(it.ToLocation).join(", ");
      const owner = it.InformationOwner || "";
      const track = it.TrackAtLocation || "";
      const item = document.createElement("div");
      item.className = "menu-item";
      item.innerHTML = `<p class="menu-item__day">${time}</p><span class="menu-item__divider"></span><div class="menu-item__meals"><p class="menu-item__meals-item"><span class="icon">🚆</span><span>${
        to || "Unknown destination"
      }</span></p><p class="menu-item__meals-item"><span class="icon">🛤️</span><span>${owner}${
        track ? ` • Track ${track}` : ""
      }</span></p></div>`;
      menuEl.appendChild(item);
      const hr = document.createElement("hr");
      hr.className = "menu__divider";
      menuEl.appendChild(hr);
    }
    if (menuEl.lastElementChild && menuEl.lastElementChild.tagName === "HR")
      menuEl.removeChild(menuEl.lastElementChild);
  }

  async function loadStations() {
    setStatus("Loading stations…");
    try {
      api.tvAssertApiKey();
      const stations = await api.tvFetchStations();
      for (const s of stations) stationMap.set(s.sign, s.name);
      setStatus("Ready", "success");
    } catch (err) {
      console.error(err);
      setStatus(err?.message || "Could not load stations", "error");
    }
  }

  function findSignatureForName(name) {
    const entry = [...stationMap.entries()].find(
      ([, n]) => n.toLowerCase() === name.toLowerCase()
    );
    return entry ? entry[0] : "";
  }

  async function loadDeparturesFor(name) {
    const sign = findSignatureForName(name);
    if (!sign) {
      setStatus(`Station not found: ${name}`, "error");
      renderDepartures([]);
      return;
    }
    setStatus(`Fetching departures for ${name}…`);
    try {
      const data = await api.tvFetchDepartures(sign);
      renderDepartures(data);
      setStatus(`Showing departures for ${name}`);
    } catch (err) {
      console.error(err);
      renderDepartures([]);
      setStatus(err?.message || "Could not fetch departures", "error");
    }
  }

  document.addEventListener("DOMContentLoaded", async () => {
    renderDepartures([]);
    const dateEl = qs("#header-date");
    if (dateEl) {
      function updateDateTime() {
        const d = new Date();
        const iso = d.toISOString().slice(0, 10);
        const time = d.toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        });
        dateEl.textContent = `${iso} • ${time}`;
      }
      updateDateTime();
      setInterval(updateDateTime, 30000);
    }
    await loadStations();
    await loadDeparturesFor("Västerås C");
    // Full page refresh every minute (reinitializes everything including API + clock)
    setInterval(() => window.location.reload(), 60000);
  });
})();
