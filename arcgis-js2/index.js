import { SAGE3Plugin } from "https://unpkg.com/@sage3/sageplugin@0.0.15/src/lib/sageplugin.js";

// import esriConfig from "https://js.arcgis.com/4.28/@arcgis/core/config.js";
import Map from "https://js.arcgis.com/4.28/@arcgis/core/Map.js";
import Basemap from "https://js.arcgis.com/4.28/@arcgis/core/Basemap.js";
import ElevationLayer from "https://js.arcgis.com/4.28/@arcgis/core/layers/ElevationLayer.js";
import BaseElevationLayer from "https://js.arcgis.com/4.28/@arcgis/core/layers/BaseElevationLayer.js";
import TileLayer from "https://js.arcgis.com/4.28/@arcgis/core/layers/TileLayer.js";
import SceneView from "https://js.arcgis.com/4.28/@arcgis/core/views/SceneView.js";
import * as reactiveUtils from "https://js.arcgis.com/4.28/@arcgis/core/core/reactiveUtils.js";
import Search from "https://js.arcgis.com/4.28/@arcgis/core/widgets/Search.js";

// Intialize the SAGE3Plugin.
// Only intalize once. Utilize it as a singleton throughout your app.
const s3api = new SAGE3Plugin();

// esriConfig.apiKey = "AAPK0a92ffa904cf4c5590fdc92ed36021a61ir1l3msQkeNiyfVkzAub3sBpuGbGUJ0IuTQY6hVF5WcoXkJM3g_izCcjTsa5XDe";

const ExaggeratedElevationLayer = BaseElevationLayer.createSubclass({
  // Add an exaggeration property whose value will be used
  // to multiply the elevations at each tile by a specified
  // factor. In this case terrain will render 100x the actual elevation.

  properties: {
    exaggeration: 70,
  },

  // The load() method is called when the layer is added to the map
  // prior to it being rendered in the view.
  load: function () {
    // TopoBathy3D contains elevation values for both land and ocean ground
    this._elevation = new ElevationLayer({
      url: "https://elevation3d.arcgis.com/arcgis/rest/services/WorldElevation3D/TopoBathy3D/ImageServer",
    });

    // wait for the elevation layer to load before resolving load()
    this.addResolvingPromise(
      this._elevation.load().then(() => {
        // get tileInfo, spatialReference and fullExtent from the elevation service
        // this is required for elevation services with a custom spatialReference
        this.tileInfo = this._elevation.tileInfo;
        this.spatialReference = this._elevation.spatialReference;
        this.fullExtent = this._elevation.fullExtent;
      })
    );

    return this;
  },

  // Fetches the tile(s) visible in the view
  fetchTile: function (level, row, col, options) {
    // calls fetchTile() on the elevationlayer for the tiles
    // visible in the view
    return this._elevation.fetchTile(level, row, col, options).then(
      function (data) {
        const exaggeration = this.exaggeration;
        // `data` is an object that contains the
        // the width and the height of the tile in pixels,
        // and the values of each pixel
        for (let i = 0; i < data.values.length; i++) {
          // Multiply the given pixel value
          // by the exaggeration value
          data.values[i] = data.values[i] * exaggeration;
        }

        return data;
      }.bind(this)
    );
  },
});

const basemap = new Basemap({
  baseLayers: [
    new TileLayer({
      url: "https://tiles.arcgis.com/tiles/nGt4QxSblgDfeJn9/arcgis/rest/services/terrain_with_heavy_bathymetry/MapServer",
      copyright:
        'Bathymetry, topography and satellite imagery from <a href="https://visibleearth.nasa.gov/view_cat.php?categoryID=1484" target="_blank">NASA Visible Earth</a> | <a href="http://www.aag.org/global_ecosystems" target="_blank">World Ecological Land Units, AAG</a> | Oceans, glaciers and water bodies from <a href="https://www.naturalearthdata.com/" target="_blank">Natural Earth</a>',
    }),
  ],
});

const elevationLayer = new ExaggeratedElevationLayer();

// Add the exaggerated elevation layer to the map's ground
// in place of the default world elevation service
const map = new Map({
  basemap: basemap,
  ground: {
    layers: [elevationLayer],
  },
});

const view = new SceneView({
  container: "viewDiv",
  map: map,
  alphaCompositingEnabled: true,
  qualityProfile: "high",
  camera: {
    position: [-55.039, 14.948, 19921223.3],
    heading: 2.03,
    tilt: 0.13,
  },
  environment: {
    background: {
      type: "color",
      color: [255, 252, 244, 0],
    },
    starsEnabled: true,
    atmosphereEnabled: true,
    lighting: {
      type: "virtual",
    },
  },
  constraints: {
    altitude: {
      min: 3000000,
    },
  },
  popup: {
    dockEnabled: true,
    dockOptions: {
      position: "top-right",
      breakpoint: false,
      buttonEnabled: false,
    },
    collapseEnabled: false,
  },
  highlightOptions: {
    color: [255, 255, 255],
    haloOpacity: 0.5,
  },
});

// view.ui.components = (["attribution", "compass", "zoom"]);
view.ui.components = ["attribution"];

// places the search widget in the top right corner of the view
const search = new Search({
  view: view,
});
search.on("select-result", function (event) {
  console.log(event);
  const lat = event.result.feature.geometry.latitude;
  const lng = event.result.feature.geometry.longitude;
  s3api.update({
    state: {
      latitude: lat,
      longitude: lng,
      z: view.camera.position.z,
      heading: view.camera.heading,
      tilt: view.camera.tilt,
      exaggerated,
    },
  });
});
view.ui.add(search, "top-right");

let exaggerated = true;

document.getElementById("exaggerate").addEventListener("click", (event) => {
  if (exaggerated) {
    map.ground = "world-elevation";
    event.target.innerHTML = "Enable exaggeration";
    exaggerated = false;
  } else {
    map.ground = {
      layers: [elevationLayer],
    };
    event.target.innerHTML = "Disable exaggeration";
    exaggerated = true;
  }
  Update(exaggerated);
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

view.when(function () {
  // The local variable we are syncing
  let latitude, longitude, z, heading, tilt, ex;
  view.environment.lighting.date =
    "Wed May 15 2019 14:50:00 GMT+0200 (Central European Summer Time)";
  let moving = false;

  function frame() {
    if (!view.interacting) {
      const camera = view.camera.clone();
      camera.position.latitude = latitude;
      camera.position.longitude = longitude;
      camera.position.z = z;
      camera.tilt = tilt;
      camera.heading = heading;
      view.goTo(camera, { animate: false });

      if (ex !== exaggerated) {
        const element = document.getElementById("exaggerate");
        if (ex) {
          map.ground = {
            layers: [elevationLayer],
          };
          element.innerHTML = "Disable exaggeration";
        } else {
          map.ground = "world-elevation";
          element.innerHTML = "Enable exaggeration";
        }
        exaggerated = ex;
      }
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
      ex = state.data.state.exaggerated;
      requestAnimationFrame(frame);
    }
  });

  // Watch the change on view.camera
  // reactiveUtils.watch(
  //   () => view.camera,
  //   (camera) => {
  //     const x = camera.position.x;
  //     const y = camera.position.y;
  //     const z = camera.position.z;
  //     const heading = camera.heading;
  //     const tilt = camera.tilt;
  //     // s3api.update({ state: { x, y, z, heading, tilt } });
  //   }
  // );

  reactiveUtils.watch(
    () => view.animation,
    (response) => {
      if (response?.state === "running") moving = true;
      else moving = false;
    }
  );
});
