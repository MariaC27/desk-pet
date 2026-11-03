import { getCurrentWindow } from "@tauri-apps/api/window";
import React from "react";
import ReactDOM from "react-dom/client";
import { PetWindow } from "./pet/PetWindow";
import { TrackerWindow } from "./tracker/TrackerWindow";
import "./styles.css";

// One bundle, two windows: route on the Tauri window label.
const isPet = getCurrentWindow().label === "pet";
document.documentElement.classList.add(isPet ? "pet-root" : "tracker-root");
if (isPet) document.addEventListener("contextmenu", (e) => e.preventDefault());

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>{isPet ? <PetWindow /> : <TrackerWindow />}</React.StrictMode>,
);
