import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";
import "leaflet/dist/leaflet.css";
import "./leafletFix";
import { FeedbackProvider } from "./components/ui/FeedbackProvider";

const rootElement = document.getElementById("root");
if (!rootElement) throw new Error("Elemento root não encontrado");

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <FeedbackProvider>
      <App />
    </FeedbackProvider>
  </React.StrictMode>
);