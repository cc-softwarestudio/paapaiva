# Pääpäivä

An interactive event map for Pääpäivä, a multi-venue event taking place across Helsinki. The page shows all event locations on a map, lets you filter by time of day and event type, and displays details for each location. The interface is available in Finnish and English.

## Run locally

**Requirements:** Node.js 18+

```bash
# Install dependencies
npm install

# Generate location coordinates (fetches from OpenStreetMap, takes ~30 seconds)
npm run prepare-data

# Start dev server
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

> `prepare-data` only needs to be run once, or again after editing `src/data/locations.json`.
