import { SAGE3Plugin } from "https://unpkg.com/@sage3/sageplugin@0.0.15/src/lib/sageplugin.js";

import Map from "https://js.arcgis.com/4.28/@arcgis/core/Map.js";
import Basemap from "https://js.arcgis.com/4.28/@arcgis/core/Basemap.js";
import GeoJSONLayer from "https://js.arcgis.com/4.28/@arcgis/core/layers/GeoJSONLayer.js";
import Legend from "https://js.arcgis.com/4.28/@arcgis/core/widgets/Legend.js";
import TileLayer from "https://js.arcgis.com/4.28/@arcgis/core/layers/TileLayer.js";
import SceneView from "https://js.arcgis.com/4.28/@arcgis/core/views/SceneView.js";
import histogram from "https://js.arcgis.com/4.28/@arcgis/core/smartMapping/statistics/histogram.js";
import HistogramRangeSlider from "https://js.arcgis.com/4.28/@arcgis/core/widgets/HistogramRangeSlider.js";
import * as promiseUtils from "https://js.arcgis.com/4.28/@arcgis/core/core/promiseUtils.js";

// Intialize the SAGE3Plugin.
// Only intalize once. Utilize it as a singleton throughout your app.
const s3api = new SAGE3Plugin();

const map = new Map({
  basemap: new Basemap({
    baseLayers: [
      new TileLayer({
        url: "https://tiles.arcgis.com/tiles/nGt4QxSblgDfeJn9/arcgis/rest/services/VintageShadedRelief/MapServer",
        opacity: 0.7,
        minScale: 0,
      }),
    ],
  }),
  ground: {
    surfaceColor: [255, 255, 255],
  },
});

const view = new SceneView({
  container: "viewDiv",
  camera: {
    position: [-96.22, 15.26, 20000000],
    heading: 0,
    tilt: 0,
  },
  qualityProfile: "high",
  map: map,
  alphaCompositingEnabled: true,
  environment: {
    background: {
      type: "color",
      color: [0, 0, 0, 0],
    },
    lighting: {
      date: "Sun Jul 15 2018 21:04:41 GMT+0200 (Central European Summer Time)",
    },
    starsEnabled: false,
    atmosphereEnabled: false,
  },
  highlightOptions: {
    fillOpacity: 0,
    color: "#ffffff",
  },
  constraints: {
    altitude: {
      min: 400000,
    },
  },
});

function Update(exaggerated) {
  const latitude = view.camera.position.latitude;
  const longitude = view.camera.position.longitude;
  const z = view.camera.position.z;
  const heading = view.camera.heading;
  const tilt = view.camera.tilt;

  s3api.update({
    state: { latitude, longitude, z, heading, tilt, exaggerated },
  });
}

view.on("drag", function (event) {
  if (event.action === "end") {
    Update();
  }
});

view.on("mouse-wheel", function (event) {
  Update();
});

view.on("key-up", function (event) {
  Update();
});

/*****************************************
 * Create GeoJSONLayer
 * from the USGS earthquake feed
 *****************************************/

const url =
  "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_month.geojson";

const earthquakesLayer = new GeoJSONLayer({
  url: url,
  copyright: "USGS Earthquakes",
  screenSizePerspectiveEnabled: false,
  title: "Earthquakes in the last 30 days",
  popupTemplate: {
    title: "Earthquake Info",
    content:
      "Magnitude <b>{mag}</b> {type} hit <b>{place}</b> on <b>{time}</b>",
    fieldInfos: [
      {
        fieldName: "time",
        format: {
          dateFormat: "short-date-short-time",
        },
      },
    ],
  },
});

map.add(earthquakesLayer);

// the number of earthquakes in each class is displayed in the legend

const statDefinitions = [
  {
    onStatisticField: "CASE WHEN mag < 5.0 THEN 1 ELSE 0 END",
    outStatisticFieldName: "minor",
    statisticType: "sum",
  },
  {
    onStatisticField: "CASE WHEN mag < 7.0 AND mag >= 5.0 THEN 1 ELSE 0 END",
    outStatisticFieldName: "medium",
    statisticType: "sum",
  },
  {
    onStatisticField: "CASE WHEN mag >= 7.0 THEN 1 ELSE 0 END",
    outStatisticFieldName: "major",
    statisticType: "sum",
  },
  {
    onStatisticField: "mag",
    outStatisticFieldName: "total",
    statisticType: "count",
  },
];

// the symbol for each earthquake class is composed of multiple symbol layers

const baseSymbolLayer = {
  type: "icon",
  resource: { primitive: "circle" },
  material: { color: [245, 116, 73, 0.9] },
  size: 3,
};

const secondSymbolLayer = {
  type: "icon",
  resource: { primitive: "circle" },
  material: { color: [245, 116, 73, 0] },
  outline: { color: [245, 116, 73, 0.7], size: 1 },
  size: 20,
};

const thirdSymbolLayer = {
  type: "icon",
  resource: { primitive: "circle" },
  material: { color: [245, 116, 73, 0] },
  outline: { color: [245, 116, 73, 0.5], size: 1 },
  size: 40,
};

earthquakesLayer
  .queryFeatures({ where: "1=1", outStatistics: statDefinitions })
  .then(function (result) {
    let statResults = result.features[0].attributes;
    const renderer = {
      type: "class-breaks",
      field: "mag",
      legendOptions: {
        title: "Legend",
      },
      classBreakInfos: [
        {
          minValue: -2,
          maxValue: 5,
          symbol: {
            type: "point-3d",
            symbolLayers: [baseSymbolLayer],
          },
          label:
            annotate(statResults.minor) +
            " lower than 5. They don't cause any significant damage.",
        },
        {
          minValue: 5,
          maxValue: 7,
          symbol: {
            type: "point-3d",
            symbolLayers: [baseSymbolLayer, secondSymbolLayer],
          },
          label:
            annotate(statResults.medium) +
            " between 5 and 7. They can damage buildings and other structures in populated areas.",
        },
        {
          minValue: 7,
          maxValue: 10,
          symbol: {
            type: "point-3d",
            symbolLayers: [
              baseSymbolLayer,
              secondSymbolLayer,
              thirdSymbolLayer,
            ],
          },
          label:
            annotate(statResults.major) +
            " larger than 7. These earthquakes are likely to cause damage even to earthquake resistant structures.",
        },
      ],
    };
    earthquakesLayer.renderer = renderer;
  });

function annotate(no) {
  if (no && no !== 0) {
    if (no === 1) {
      return "1 earthquake";
    }
    return no.toString() + " earthquakes";
  }
  return "0 earthquakes";
}

/*****************************************
 * Create a histogram with a range slider
 * to filter earthquakes based on magnitude
 *****************************************/

view.whenLayerView(earthquakesLayer).then(function (lyrView) {
  const min = -2;
  const max = 10;
  histogram({
    layer: earthquakesLayer,
    field: "mag",
    numBins: 30,
    minValue: min,
    maxValue: max,
  })
    .then(function (histogramResponse) {
      const slider = new HistogramRangeSlider({
        bins: histogramResponse.bins,
        min: min,
        max: max,
        values: [min, max],
        includedBarColor: [245, 116, 73],
        excludedBarColor: [200, 200, 200],
        rangeType: "between",
        container: document.getElementById("histogram"),
      });

      slider.on(["thumb-change", "thumb-drag", "segment-drag"], function () {
        filterByHistogramRange().catch(function (error) {
          if (error.name !== "AbortError") {
            console.error(error);
          }
        });
      });

      const filterByHistogramRange = promiseUtils.debounce(function () {
        const filterClause = slider.generateWhereClause("mag");
        lyrView.filter = {
          where: filterClause,
        };
        return updateHistogramCount(filterClause, slider.values);
      });

      updateHistogramCount("1=1", [min, max]);
    })
    .catch(console.error);

  // The local variable we are syncing
  let latitude, longitude, z, heading, tilt;

  function frame() {
    if (!view.interacting) {
      const camera = view.camera.clone();
      camera.position.latitude = latitude;
      camera.position.longitude = longitude;
      camera.position.z = z;
      camera.tilt = tilt;
      camera.heading = heading;
      view.goTo(camera, { animate: false });
    }
  }

  // Subscribe to updates from the SAGE3 server when other clients update the state.
  s3api.subscribeToUpdates((state) => {
    if (state.data.state.pluginName && state.data.state.heading !== undefined) {
      // Save the state locally
      tilt = state.data.state.tilt;
      heading = state.data.state.heading;
      latitude = state.data.state.latitude;
      longitude = state.data.state.longitude;
      z = state.data.state.z;
      console.log("latitude", latitude, longitude, z, heading, tilt);
      requestAnimationFrame(frame);
    }
  });
});

function updateHistogramCount(clause, values) {
  const query = earthquakesLayer.createQuery();
  query.where = clause;
  query.outStatistics = statDefinitions;
  return earthquakesLayer.queryFeatures(query).then(function (result) {
    document.getElementById("histCount").innerHTML =
      annotate(result.features[0].attributes.total) +
      " with magnitude between " +
      transform(values[0]) +
      " and " +
      transform(values[1]);
  });
}

function transform(number) {
  return (Math.round(number * 100) / 100).toString();
}

/*****************************************
 * Add side panel with legend and histogram
 * to the view
 *****************************************/

const sidePanelInfo = document.getElementById("sidePanelInfo");
view.ui.add(sidePanelInfo, "top-right");

new Legend({
  view: view,
  container: document.getElementById("legend"),
});
