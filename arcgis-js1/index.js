import { SAGE3Plugin } from "https://unpkg.com/@sage3/sageplugin@0.0.15/src/lib/sageplugin.js";

import WebScene from "https://js.arcgis.com/4.28/@arcgis/core/WebScene.js";
import SceneView from "https://js.arcgis.com/4.28/@arcgis/core/views/SceneView.js";
import * as reactiveUtils from "https://js.arcgis.com/4.28/@arcgis/core/core/reactiveUtils.js";

// Intialize the SAGE3Plugin.
// Only intalize once. Utilize it as a singleton throughout your app.
const s3api = new SAGE3Plugin();

const webscene = new WebScene({
  portalItem: {
    id: "8ede93ea9d8d48bc8cdcbea775936a13",
  },
});

const view = new SceneView({
  container: "viewDiv",
  map: webscene,
  qualityProfile: "high",
  camera: {
    position: [13.39416389, 52.51696216, 122.38133],
    heading: 81.8,
    tilt: 79.95,
  },
});
// view.ui.components = (["attribution", "compass", "zoom"]);
view.ui.components = ["attribution"];

function Update() {
  const latitude = view.camera.position.latitude;
  const longitude = view.camera.position.longitude;
  const z = view.camera.position.z;
  const heading = view.camera.heading;
  const tilt = view.camera.tilt;
  s3api.update({ state: { latitude, longitude, z, heading, tilt } });
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
  let latitude, longitude, z, heading, tilt;
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
