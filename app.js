const map = L.map("map", {
  zoomAnimation: false,
  fadeAnimation: false,
  markerZoomAnimation: false
}).setView([37.4, -4.5], 7);

L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
  attribution: '&copy; OpenStreetMap-Mitwirkende &copy; CARTO',
  subdomains: "abcd",
  maxZoom: 20
}).addTo(map);

const periods = [
  "1951-1980",
  "1981-2014",
  "2015-2040",
  "2041-2070",
  "2071-2100"
];

const periodSlider = document.getElementById("periodSlider");
const periodLabel = document.getElementById("periodLabel");
const scenarioSelect = document.getElementById("scenarioSelect");

let currentLayer = null;
let activeRequestId = 0;
let activePaneName = null;

function getRasterUrl() {
  const period = periods[Number(periodSlider.value)];
  const scenario = scenarioSelect.value;

  if (period === "1951-1980" || period === "1981-2014") {
    return layersConfig.historical[period] || null;
  }

  return layersConfig.future[scenario]?.[period] || null;
}

function scoreToColor(score) {
  const colors = {
    0: "#8b0000",
    1: "#b22222",
    2: "#d95f0e",
    3: "#f16913",
    4: "#fdae6b",
    5: "#fee08b",
    6: "#d9ef8b",
    7: "#a6d96a",
    8: "#66bd63",
    9: "#1a9850",
    10: "#006837"
  };
  return colors[score] ?? null;
}

function removeOldRaster() {
  if (currentLayer) {
    try {
      map.removeLayer(currentLayer);
    } catch (e) {
      console.warn("Alter Layer konnte nicht entfernt werden:", e);
    }
    currentLayer = null;
  }

  if (activePaneName) {
    const pane = map.getPane(activePaneName);
    if (pane && pane.parentNode) {
      pane.parentNode.removeChild(pane);
    }
    activePaneName = null;
  }
}

function createFreshRasterPane(requestId) {
  const paneName = `rasterPane_${requestId}`;
  map.createPane(paneName);
  const pane = map.getPane(paneName);
  pane.style.zIndex = 450;
  pane.style.pointerEvents = "none";
  return paneName;
}

function forceRasterRefresh() {
  const center = map.getCenter();
  const zoom = map.getZoom();

  setTimeout(() => {
    map.setView(center, zoom, { animate: false });
    map.invalidateSize(false);
  }, 0);

  setTimeout(() => {
    map.setView(center, zoom, { animate: false });
    map.invalidateSize(false);
  }, 80);
}

async function loadRaster(url, requestId) {
  try {
    removeOldRaster();

    if (!url) {
      console.warn("Kein Raster für diese Auswahl gefunden.");
      return;
    }

    console.log("Lade Raster:", url, "requestId:", requestId);

    // Cache-Busting
    const fetchUrl = `${url}?v=${requestId}`;

    const response = await fetch(fetchUrl, { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`Datei konnte nicht geladen werden: ${fetchUrl} (${response.status})`);
    }

    const arrayBuffer = await response.arrayBuffer();

    if (requestId !== activeRequestId) {
      console.log("Veralteter Request verworfen:", requestId);
      return;
    }

    const georaster = await parseGeoraster(arrayBuffer);

    if (requestId !== activeRequestId) {
      console.log("Veralteter Request nach parse verworfen:", requestId);
      return;
    }

    const paneName = createFreshRasterPane(requestId);
    activePaneName = paneName;

    const layer = new GeoRasterLayer({
      georaster,
      opacity: 0.55,
      resolution: 64,
      pane: paneName,
      resampleMethod: "nearest",
      pixelValuesToColorFn: (values) => {
        const value = values[0];

        if (value === null || value === undefined || isNaN(value)) {
          return null;
        }

        return scoreToColor(Math.round(value));
      }
    });

    if (requestId !== activeRequestId) {
      console.log("Veralteter Layer vor addTo verworfen:", requestId);
      return;
    }

    currentLayer = layer;
    currentLayer.addTo(map);
    currentLayer.redraw();

    setTimeout(() => {
      if (currentLayer === layer && requestId === activeRequestId) {
        currentLayer.redraw();
        forceRasterRefresh();
      }
    }, 50);

    setTimeout(() => {
      if (currentLayer === layer && requestId === activeRequestId) {
        currentLayer.redraw();
        forceRasterRefresh();
      }
    }, 200);

  } catch (error) {
    console.error("Fehler beim Laden des Rasters:", error);
  }
}

async function updateMap() {
  const period = periods[Number(periodSlider.value)];
  periodLabel.textContent = period;

  const isHistorical = period === "1951-1980" || period === "1981-2014";
  scenarioSelect.disabled = isHistorical;

  const url = getRasterUrl();

  activeRequestId += 1;
  const requestId = activeRequestId;

  console.log("Aktuelle Auswahl:");
  console.log("Periode:", period);
  console.log("Szenario:", scenarioSelect.value);
  console.log("URL:", url);
  console.log("Neue requestId:", requestId);

  await loadRaster(url, requestId);
}

// WICHTIG: nur EIN Event pro Steuerung
periodSlider.addEventListener("input", updateMap);
scenarioSelect.addEventListener("change", updateMap);

updateMap();
