import { createRoot } from "react-dom/client";
import { Provider } from "react-redux";
import { store } from "@/app/store";
import App from "./App.tsx";
import "./index.css";

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("/sw.js").catch(() => {});
}

createRoot(document.getElementById("root")!).render(
  <Provider store={store}>
    <App />
  </Provider>,
);
