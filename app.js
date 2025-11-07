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
      empty.innerHTML = `<p class="menu-item__day">Inga avgångar</p><span class="menu-item__divider"></span><div class="menu-item__meals"><p class="menu-item__meals-item"><span class="icon"><img src="assets/images/info.svg" alt="info"/></span><span>Inga tåg hittades</span></p></div>`;
      menuEl.appendChild(empty);
      return;
    }
    for (const it of items) {
      const planned = it.AdvertisedTimeAtLocation;
      const estimated = it.EstimatedTimeAtLocation;
      const plannedStr = timeStr(planned);
      const estStr = estimated ? timeStr(estimated) : "";
      const delayMin =
        estimated && planned
          ? Math.round((new Date(estimated) - new Date(planned)) / 60000)
          : 0;
      const to = resolveToNames(it.ToLocation).join(", ");
      const owner = it.InformationOwner || "";
      const track = it.TrackAtLocation || it.AdvertisedTrack || "";
      const train = it.AdvertisedTrainIdent || "";
      const canceled = it.Canceled ? "Inställt" : "";
      const deviationText = (it.Deviation || [])
        .map((d) => (typeof d === "string" ? d : d.Description))
        .filter(Boolean)
        .join("; ");
      const trackChange =
        it.AdvertisedTrack &&
        it.TrackAtLocation &&
        it.AdvertisedTrack !== it.TrackAtLocation
          ? `Byte från spår ${it.AdvertisedTrack} till ${it.TrackAtLocation}`
          : "";
      const status =
        canceled ||
        deviationText ||
        trackChange ||
        (delayMin > 0 ? `Försenad ${delayMin} min` : "");

      const item = document.createElement("div");
      item.className = "menu-item";
      item.innerHTML = `
        <p class="menu-item__day">${plannedStr}${
        delayMin > 0
          ? ` <span style="color:#ff5252;">(+${delayMin} → ${estStr})</span>`
          : ""
      }</p>
        <span class="menu-item__divider"></span>
        <div class="menu-item__meals">
          <p class="menu-item__meals-item"><span class="icon"><img src="assets/images/train.svg" alt="train"/></span><span>${
            to || "Okänt resmål"
          }${track ? ` • Spår ${track}` : ""}</span></p>
          <p class="menu-item__meals-item"><span class="icon"><img src="assets/images/info.svg" alt="info"/></span><span>${
            train ? `${train} • ` : ""
          }${owner}</span></p>
              ${
                status
                  ? `<p class="menu-item__meals-item"><span class="icon"><img src="assets/images/caution.svg" alt="caution"/></span><span>${status}</span></p>`
                  : ""
              }
        </div>`;
      menuEl.appendChild(item);
      const hr = document.createElement("hr");
      hr.className = "menu__divider";
      menuEl.appendChild(hr);
    }
    if (menuEl.lastElementChild && menuEl.lastElementChild.tagName === "HR") {
      menuEl.removeChild(menuEl.lastElementChild);
    }
  }

  async function loadStations() {
    setStatus("Hämtar stationer…");
    try {
      api.tvAssertApiKey();
      const stations = await api.tvFetchStations();
      for (const s of stations) stationMap.set(s.sign, s.name);
      setStatus("Klar", "success");
    } catch (err) {
      console.error(err);
      setStatus(err?.message || "Kunde inte hämta stationer", "error");
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
      setStatus(`Station hittades inte: ${name}`, "error");
      renderDepartures([]);
      return;
    }
    setStatus(`Hämtar avgångar för ${name}…`);
    try {
      const data = await api.tvFetchDepartures(sign);
      // Remove trains that already departed (both advertised and estimated before now - small buffer)
      const bufferMs = 5 * 60 * 1000; // 5 minutes grace
      const nowMs = Date.now();
      const filtered = (data || []).filter((it) => {
        const adv = it.AdvertisedTimeAtLocation
          ? Date.parse(it.AdvertisedTimeAtLocation)
          : NaN;
        const est = it.EstimatedTimeAtLocation
          ? Date.parse(it.EstimatedTimeAtLocation)
          : NaN;
        const latest = Math.max(isNaN(adv) ? 0 : adv, isNaN(est) ? 0 : est);
        // If we have no time info, keep the item; otherwise require latest >= now - buffer
        if (latest === 0) return true;
        return latest >= nowMs - bufferMs;
      });
      renderDepartures(filtered);
      setStatus(`Visar avgångar för ${name}`);
    } catch (err) {
      console.error(err);
      renderDepartures([]);
      setStatus(err?.message || "Kunde inte hämta avgångar", "error");
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
    // Full page refresh every two minutes (reinitializes everything including API + clock)
    setInterval(() => window.location.reload(), 120000);
  });
})();
