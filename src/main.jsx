import React from "react";
import { createRoot } from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import "@fontsource/dm-sans/400.css";
import "@fontsource/dm-sans/500.css";
import "@fontsource/dm-sans/600.css";
import "@fontsource/lora/400.css";
import "./style.css";
import App from "./App";
import { initialize } from "./db";
const applyUpdate = registerSW({
  onNeedRefresh() {
    if (document.getElementById('app-update')) return;
    const notice = document.createElement('div');
    notice.id = 'app-update'; notice.className = 'notice update-notice';
    const message = document.createElement('span');
    message.textContent = 'MediMate has an update. Save your edits before reloading.';
    const button = document.createElement('button'); button.textContent = 'Update MediMate';
    button.onclick = () => applyUpdate(true);
    notice.append(message, button); document.body.append(notice);
  },
  onRegisteredSW(_url, registration) {
    window.addEventListener('focus', () => {if(navigator.onLine) registration?.update().catch(()=>{});});
  },
  onOfflineReady() {
    window.dispatchEvent(new Event("medimate-offline-ready"));
  },
});
class Boundary extends React.Component {
  state = { error: null };
  static getDerivedStateFromError(error) {
    return { error };
  }
  render() {
    return this.state.error ? (
      <main>
        <h1>MediMate couldn’t open.</h1>
        <p>{this.state.error.message}</p>
        <p>
          Check that browser storage is enabled, then reload. Your saved library
          has not been cleared.
        </p>
        <button onClick={() => location.reload()}>Reload</button>
      </main>
    ) : (
      this.props.children
    );
  }
}
initialize()
  .then(() =>
    createRoot(document.getElementById("root")).render(
      <Boundary>
        <App />
      </Boundary>,
    ),
  )
  .catch((e) => {
    document.getElementById("root").textContent =
      `Could not open local storage: ${e.message}. Enable browser storage and reload.`;
  });
