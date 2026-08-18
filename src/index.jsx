import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./design-system.css";
import App from "./App";

const LEGACY_PUBLIC_WEB_PRECHECK_URL = "https://qxbstimgqkzqzzezwijw.supabase.co/functions/v1/datascout-public-web-precheck";
const nativeFetch = window.fetch.bind(window);
window.fetch = (input, init) => {
  const url = typeof input === "string" ? input : input?.url;
  if (url === LEGACY_PUBLIC_WEB_PRECHECK_URL) {
    return nativeFetch("/api/public-web-precheck", init);
  }
  return nativeFetch(input, init);
};

const rootElement = document.getElementById("root");
const root = createRoot(rootElement);

root.render(
  <StrictMode>
    <App />
  </StrictMode>
);
