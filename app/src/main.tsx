import { getCurrentWindow } from "@tauri-apps/api/window";
import React from "react";
import ReactDOM from "react-dom/client";
import { Onboarding } from "./onboarding/Onboarding";
import { PetWindow } from "./pet/PetWindow";
import { TrackerWindow } from "./tracker/TrackerWindow";
import "./styles.css";

// One bundle, several windows: route on the Tauri window label.
const label = getCurrentWindow().label;
const isPet = label === "pet";
document.documentElement.classList.add(isPet ? "pet-root" : "tracker-root");
if (isPet) document.addEventListener("contextmenu", (e) => e.preventDefault());

const view = isPet ? <PetWindow /> : label === "onboarding" ? <Onboarding /> : <TrackerWindow />;
ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>{view}</React.StrictMode>,
);
