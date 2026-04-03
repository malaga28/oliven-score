const map = L.map("map", {
  zoomAnimation: false,
  fadeAnimation: false,
  markerZoomAnimation: false
}).setView([37.4, -4.5], 7);

L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
  attribution: '&copy; OpenStreetMap-Mitwirkende &copy; CARTO',
  subdomains: 'abcd',
  maxZoom: 20
}).addTo(map);

map.createPane("rasterPane");
map.getPane("rasterPane").style.zIndex = 450;

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

async function loadRaster(url) {
  try {
    if (currentLayer) {
      map.removeLayer(currentLayer);
      currentLayer = null;
    }

    if (!url) {
      console.warn("Kein Raster für diese Auswahl gefunden.");
      return;
    }

    console.log("Lade Raster:", url);

    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`Datei konnte nicht geladen werden: ${url} (${response.status})`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const georaster = await parseGeoraster(arrayBuffer);

    currentLayer = new GeoRasterLayer({
      georaster,
      opacity: 0.55,
      resolution: 128,
      pane: "rasterPane",
      resampleMethod: "nearest",
      pixelValuesToColorFn: (values) => {
        const value = values[0];

        if (value === null || value === undefined || isNaN(value)) {
          return null;
        }

        return scoreToColor(Math.round(value));
      }
    });

    currentLayer.addTo(map);

    try {
      map.fitBounds(currentLayer.getBounds());
    } catch (e) {
      console.warn("Bounds konnten nicht gesetzt werden:", e);
    }
  } catch (error) {
    console.error("Fehler beim Laden des Rasters:", error);
  }
}

async function updateMap() {
  const period = periods[Number(periodSlider.value)];
  periodLabel.textContent = period;

  const isHistorical = period === "1951-1980" || period === "1981-2014";

  if (isHistorical) {
    scenarioSelect.disabled = true;
  } else {
    scenarioSelect.disabled = false;
  }

  const url = getRasterUrl();

  console.log("Aktuelle Auswahl:");
  console.log("Periode:", period);
  console.log("Szenario:", scenarioSelect.value);
  console.log("URL:", url);

  await loadRaster(url);
}

periodSlider.addEventListener("input", updateMap);
periodSlider.addEventListener("change", updateMap);
scenarioSelect.addEventListener("change", updateMap);

updateMap();
