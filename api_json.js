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

async function tvRequest(query, opts = {}) {
  const key = tvGetApiKey();
  if (!key) throw new Error("API_KEY is missing – see README to set it.");

  const jsonPayload = {
    request: {
      login: {
        authenticationkey: key
      },
      ...query
    }
  };

  const timeoutMs = typeof opts.timeoutMs === "number" ? opts.timeoutMs : 12000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let res;
  try {
    res = await fetch(TV_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(jsonPayload),
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

async function tvFetchStations() {
  const query = {
    query: [{
      objecttype: "TrainStation",
      schemaversion: "1",
      filter: {},
      include: [
        "Prognosticated",
        "AdvertisedLocationName",
        "LocationSignature"
      ]
    }]
  };
  
  const data = await tvRequest(query);
  // Log the response structure to debug
  console.log('API Response:', JSON.stringify(data, null, 2));
  const result = data?.RESPONSE?.RESULT?.[0]?.TrainStation || [];
  console.log('Stations loaded:', result.length);  // Debug log
  return result.map((s) => ({
    name: s.AdvertisedLocationName,
    sign: s.LocationSignature,
    prognosticated: !!s.Prognosticated,
  }));
}

async function tvFetchDepartures(sign) { 
  const query = {
    query: [{
      objecttype: "TrainAnnouncement",
      orderby: "AdvertisedTimeAtLocation",
      schemaversion: "1",
      filter: {
        AND: [
          {
            OR: [
              {
                AND: [
                  { GT: [ { name: "AdvertisedTimeAtLocation", value: "$dateadd(-00:15:00)" } ] },
                  { LT: [ { name: "AdvertisedTimeAtLocation", value: "$dateadd(02:00:00)" } ] }
                ]
              },
              { GT: [ { name: "EstimatedTimeAtLocation", value: "$now" } ] }
            ]
          },
          { EQ: [ { name: "LocationSignature", value: sign } ] },
          { EQ: [ { name: "ActivityType", value: "Ankomst" } ] }
        ]
      },
      INCLUDE: [
        "InformationOwner",
        "AdvertisedTimeAtLocation",
        "TrackAtLocation",
        "FromLocation",
        "ToLocation",
        "EstimatedTimeAtLocation"
      ]
    }]
  };

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

  const query = {
    query: [{
      objecttype: "OperativeEvent",
      schemaversion: "1",
      filter: {
        AND: [
          { EQ: { name: "EventState", value: "1" } },
          {
            OR: [
              { EQ: { name: "EventTrafficType", value: "0" } },
              { EQ: { name: "EventTrafficType", value: "2" } }
            ]
          }
        ]
      }
    }]
  };

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
