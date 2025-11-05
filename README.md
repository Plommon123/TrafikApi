# Tåginfo (Trafikverket API)

En enkel webbapp i ren HTML/CSS/JS som visar tågavgångar och (valfritt) operativa händelser från Trafikverkets API.

## Konfiguration – API-nyckel

Koden läser din nyckel från en miljövariabel med namnet `API_KEY` men i webbläsaren via en liten shim `env.js` som sätter `window.ENV.API_KEY`.

Du har två alternativ:

# Train info (Trafikverket API)

A small HTML/CSS/JS app that shows train departures and (optionally) operative events from Trafikverket’s API.

## Configuration – API key

The app reads your key from `window.ENV.API_KEY` via `env.js`.

Two ways to set it:

1) Manual
- Copy `env.sample.js` to `env.js` and set your key:
  - `API_KEY: "your-key"`

2) From `.env`
- Create a `.env` with: `API_KEY=your-key`
- Generate `env.js` from `.env` (fish shell):

```fish
set -l API_KEY (string replace -r '.*API_KEY=([^\n\r]+).*' '$1' (cat .env))
printf 'window.ENV = { API_KEY: "%s" };\n' "$API_KEY" > env.js
```

Note: In a real build pipeline (e.g., Vite/Parcel) you would inject `API_KEY` at build time. This app is fully static and therefore uses an `env.js` shim.

### Disable operative events (if your key lacks access)

Some API keys/environments do not expose the `OperativeEvent` object. You can disable that request entirely to avoid 400s in the Network tab:

```js
window.ENV = {
  API_KEY: "...",
  DISABLE_OPERATIVE_EVENTS: true,
};
```

The app also auto-detects when `OperativeEvent` is unavailable and stops requesting it after the first attempt.

## Run locally

Serve the app over HTTP (not `file://`). For example with Python 3:

```bash
python3 -m http.server 5173
```

Or use VS Code “Live Server”. Then open http://localhost:5173

## Usage

- Pick a station in the search field (autocomplete). Click “Show” to load departures.
- The “Operative events” panel loads in the background (railway + road/railway, ongoing).

## Files

- `index.html` – markup
- `styles.css` – dark theme styles
- `api.js` – helpers for the API (XML POST, JSON response)
- `app.js` – UI logic (stations, search, rendering)
- `env.sample.js` – env shim example (create `env.js` from this or from your `.env`)

### API calls used

- TrainStation: `Prognosticated`, `AdvertisedLocationName`, `LocationSignature`
- TrainAnnouncement: upcoming departures in a time window
- OperativeEvent: ongoing events for railway (EventState=1, EventTrafficType=0 or 2) when available

### Error handling

- If `API_KEY` is missing you’ll see a clear status message. Add `env.js` as shown above.

## License

Example code, free to adapt.
- Om `API_KEY` saknas visas ett tydligt fel i statusfältet och i konsolen. Lägg till `env.js` enligt ovan.

## Licens

Denna kod är ett exempel, fri att anpassa för ditt projekt.
