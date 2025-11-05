const TV_API_URL = "https://api.trafikinfo.trafikverket.se/v2/data.json";
window.FEATURES = window.FEATURES || { OPERATIVE_EVENTS_AVAILABLE: true };

function tvGetApiKey() {
  return (window.ENV && window.ENV.API_KEY) || window.API_KEY || null;
}

function tvAssertApiKey() {
  const key = tvGetApiKey();
  if (!key) {
    const msg =
      "API key missing. Add .env with API_KEY and generate env.js (see README).";
    console.warn(msg);
  }
}

async function tvRequest(queryXml, opts = {}) {
  const key = tvGetApiKey();
  if (!key) throw new Error("API_KEY is missing – see README to set it.");

  const xml = `<?xml version="1.0" encoding="utf-8"?>\n<REQUEST>\n  <LOGIN authenticationkey='${key}'/>\n  ${queryXml}\n</REQUEST>`;

  const timeoutMs = typeof opts.timeoutMs === "number" ? opts.timeoutMs : 12000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let res;
  try {
    res = await fetch(TV_API_URL, {
      method: "POST",
      headers: { "Content-Type": "text/xml" },
      body: xml,
      signal: controller.signal,
    });
  } catch (e) {
    if (e && e.name === "AbortError") {
      throw new Error(
        "Request aborted (timeout). Check network or API status."
      );
    }
    throw e;
  } finally {
    clearTimeout(timer);
  }
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`API-fel ${res.status}: ${res.statusText}\n${text}`);
  }
  try {
    return await res.json();
  } catch (e) {
    const text = await res.text().catch(() => "");
    throw new Error(`Could not parse response as JSON.\n${text}`);
  }
}

function includes(fields = []) {
  return fields.map((f) => `<INCLUDE>${f}</INCLUDE>`).join("\n");
}

async function tvFetchStations() {
  const query = `
  <QUERY objecttype='TrainStation' schemaversion='1'>
    <FILTER/>
    ${includes([
      "Prognosticated",
      "AdvertisedLocationName",
      "LocationSignature",
    ])}
  </QUERY>`;
  const data = await tvRequest(query);
  const result = data?.RESPONSE?.RESULT?.[0]?.TrainStation || [];
  return result.map((s) => ({
    name: s.AdvertisedLocationName,
    sign: s.LocationSignature,
    prognosticated: !!s.Prognosticated,
  }));
}

async function tvFetchDepartures(sign) {
  const filter = `
  <FILTER>
    <AND>
      <OR>
        <AND>
          <GT name='AdvertisedTimeAtLocation' value='$dateadd(-00:15:00)'/>
          <LT name='AdvertisedTimeAtLocation' value='$dateadd(14:00:00)'/>
        </AND>
        <GT name='EstimatedTimeAtLocation' value='$now'/>
      </OR>
      <EQ name='LocationSignature' value='${sign}'/>
      <EQ name='ActivityType' value='Avgang'/>
    </AND>
  </FILTER>`;

  const query = `
  <QUERY objecttype='TrainAnnouncement' orderby='AdvertisedTimeAtLocation' schemaversion='1'>
    ${filter}
    ${includes([
      "InformationOwner",
      "AdvertisedTimeAtLocation",
      "TrackAtLocation",
      "FromLocation",
      "ToLocation",
      "EstimatedTimeAtLocation",
    ])}
  </QUERY>`;

  const data = await tvRequest(query);
  return data?.RESPONSE?.RESULT?.[0]?.TrainAnnouncement || [];
}

async function tvFetchOperativeEvents() {
  if (window.ENV && window.ENV.DISABLE_OPERATIVE_EVENTS === true) {
    window.FEATURES.OPERATIVE_EVENTS_AVAILABLE = false;
    return [];
  }
  if (window.FEATURES && window.FEATURES.OPERATIVE_EVENTS_AVAILABLE === false) {
    return [];
  }
  const filter = `
  <FILTER>
    <AND>
      <EQ name='EventState' value='1'/>
      <OR>
        <EQ name='EventTrafficType' value='0'/>
        <EQ name='EventTrafficType' value='2'/>
      </OR>
    </AND>
  </FILTER>`;
  const query = `
  <QUERY objecttype='OperativeEvent' schemaversion='1'>
    ${filter}
  </QUERY>`;
  try {
    const data = await tvRequest(query);
    const list = data?.RESPONSE?.RESULT?.[0]?.OperativeEvent || [];
    // Client-side sort: newest start first if available, otherwise leave order
    try {
      list.sort((a, b) => {
        const ta = Date.parse(a?.StartDateTime || a?.ModifiedDateTime || 0);
        const tb = Date.parse(b?.StartDateTime || b?.ModifiedDateTime || 0);
        return (tb || 0) - (ta || 0);
      });
    } catch {}
    return list;
  } catch (err) {
    const msg = String(err?.message || "");
    if (msg.includes("ObjectType 'OperativeEvent' does not exists")) {
      // This API key/environment lacks the OperativeEvent object type. Degrade gracefully.
      window.FEATURES.OPERATIVE_EVENTS_AVAILABLE = false;
      return [];
    }
    throw err;
  }
}

// Export helpers on window
window.TrafikverketAPI = {
  tvAssertApiKey,
  tvFetchStations,
  tvFetchDepartures,
  tvFetchOperativeEvents,
};
