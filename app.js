const map = L.map("map").setView([37.4, -4.5], 7);

L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  attribution: "&copy; OpenStreetMap-Mitwirkende"
}).addTo(map);

const periods = ["hist1", "hist2", "future1", "future2"];

const periodSlider = document.getElementById("periodSlider");
const periodLabel = document.getElementById("periodLabel");
const scenarioSelect = document.getElementById("scenarioSelect");

let currentLayer = null;

function getRasterUrl() {
  const periodKey = periods[parseInt(periodSlider.value, 10)];
  const scenario = scenarioSelect.value;

  if (periodKey.startsWith("hist")) {
    return layersConfig.historical[periodKey];
  }

  return layersConfig.future[scenario]?.[periodKey] || null;
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
  return colors[score] || "#cccccc";
}

async function loadRaster(url) {
  if (currentLayer) {
    map.removeLayer(currentLayer);
    currentLayer = null;
  }

  if (!url) return;

  const response = await fetch(url);
  const arrayBuffer = await response.arrayBuffer();
  const georaster = await parseGeoraster(arrayBuffer);

  currentLayer = new GeoRasterLayer({
    georaster,
    opacity: 0.8,
    resolution: 256,
    pixelValuesToColorFn: (values) => {
      const value = values[0];
      if (value === null || value === undefined || isNaN(value)) return null;
      return scoreToColor(Math.round(value));
    }
  });

  currentLayer.addTo(map);

  try {
    map.fitBounds(currentLayer.getBounds());
  } catch (e) {
    console.warn("Konnte Bounds nicht setzen", e);
  }
}

async function updateMap() {
  const periodKey = periods[parseInt(periodSlider.value, 10)];
  periodLabel.textContent = periodKey;

  if (periodKey.startsWith("hist")) {
    scenarioSelect.value = "historical";
    scenarioSelect.disabled = true;
  } else {
    scenarioSelect.disabled = false;
    if (scenarioSelect.value === "historical") {
      scenarioSelect.value = "ssp126";
    }
  }

  const url = getRasterUrl();
  await loadRaster(url);
}

periodSlider.addEventListener("input", updateMap);
scenarioSelect.addEventListener("change", updateMap);

updateMap();
