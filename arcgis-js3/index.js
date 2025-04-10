import { SAGE3Plugin } from "https://unpkg.com/@sage3/sageplugin@0.0.15/src/lib/sageplugin.js";

import Map from "https://js.arcgis.com/4.32/@arcgis/core/Map.js";
import GeoJSONLayer from "https://js.arcgis.com/4.32/@arcgis/core/layers/GeoJSONLayer.js";
import MapView from "https://js.arcgis.com/4.32/@arcgis/core/views/MapView.js";
import * as reactiveUtils from "https://js.arcgis.com/4.32/@arcgis/core/core/reactiveUtils.js";

// Intialize the SAGE3Plugin.
// Only intalize once. Utilize it as a singleton throughout your app.
const s3api = new SAGE3Plugin();

// Past 30 days, all
// const url = "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_month.geojson";
// Past 30 days, mag 2.5+
// const url =
//   "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_month.geojson";
// Past 30 days, mag 4.5+
// const url = "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/4.5_month.geojson";
// Past hour, all
// const url = "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_hour.geojson";
// Past day, all
// const url = "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_day.geojson";

// this year 2025, over mag > 5.8
const url =
  "https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&starttime=2025-01-01&endtime=2025-12-31&minmagnitude=5.6";

const template = {
  title: "Earthquake Info",
  content: "Magnitude {mag} {type} hit {place} on {time}",
  fieldInfos: [
    {
      fieldName: "time",
      format: {
        dateFormat: "short-date-short-time",
      },
    },
  ],
};

const renderer = {
  type: "simple",
  field: "mag",
  symbol: {
    type: "simple-marker",
    color: "orange",
    outline: {
      color: "white",
    },
  },
  visualVariables: [
    {
      type: "size",
      field: "mag",
      stops: [
        {
          value: 2.5,
          size: "4px",
        },
        {
          value: 8,
          size: "40px",
        },
      ],
    },
  ],
};

const geojsonLayer = new GeoJSONLayer({
  url: url,
  copyright: "USGS Earthquakes",
  popupTemplate: template,
  renderer: renderer,
  orderBy: {
    field: "mag",
  },
});

const map = new Map({
  basemap: "topo-vector",
  layers: [geojsonLayer],
});

const view = new MapView({
  container: "viewDiv",
  center: [-168, 46],
  zoom: 2,
  map: map,
});

// view.ui.components = (["attribution", "compass", "zoom"]);
view.ui.components = ["attribution"];

function Update() {
  // console.log("Update", view.center.latitude, view.center.longitude, view.zoom, view.scale, view.viewpoint.rotation);
  const rotation = view.viewpoint.rotation;
  const x = view.center.latitude;
  const y = view.center.longitude;
  const zoom = view.zoom;
  const scale = view.scale;
  s3api.update({ state: { rotation, x, y, zoom, scale } });
}

view.on("drag", function (event) {
  if (event.action === "end") {
    Update();
  }
});

view.on("mouse-wheel", function (event) {
  Update();
});

view.on("key-up", async function (event) {
  // reset
  if (event.key === "r") {
    view.viewpoint.rotation = 0;
    await view.goTo(
      {
        center: [-168, 46],
        zoom: 2,
      },
      { animate: false }
    );
  }
  Update();
});

// disable double-click zoom, annoying to handle
view.on("double-click", function (event) {
  event.stopPropagation();
});

view.when(function () {
  // The local variable we are syncing
  let rotation, x, y, zoom, scale;
  let moving = false;

  async function frame() {
    if (!view.interacting) {
      await view.goTo(
        {
          center: [y, x],
          zoom: zoom,
          rotation: rotation,
        },
        { animate: false }
      );
    }
  }

  // Subscribe to updates from the SAGE3 server when other clients update the state.
  s3api.subscribeToUpdates((state) => {
    if (state.data.state.pluginName && state.data.state.zoom !== undefined) {
      // Save the state locally
      x = state.data.state.x;
      y = state.data.state.y;
      rotation = state.data.state.rotation;
      zoom = state.data.state.zoom;
      scale = state.data.state.scale;
      requestAnimationFrame(frame);
    }
  });

  reactiveUtils.watch(
    () => view.animation,
    (response) => {
      if (response?.state === "running") moving = true;
      else moving = false;
    }
  );
});

const sidePanelInfo = document.getElementById("sidePanelInfo");
view.ui.add(sidePanelInfo, "top-right");
