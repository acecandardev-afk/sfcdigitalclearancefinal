import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

const rootEl = document.getElementById("root");

function showFatalError(title: string, message: string) {
  if (!rootEl) return;
  rootEl.innerHTML = `
    <div style="font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto; padding: 24px; max-width: 900px; margin: 0 auto;">
      <h1 style="font-size: 20px; font-weight: 700; margin: 0 0 12px;">${title}</h1>
      <p style="margin: 0 0 12px; color: rgba(0,0,0,0.7);">The app failed to start. Open DevTools → Console for details.</p>
      <pre style="background: rgba(0,0,0,0.05); padding: 12px; border-radius: 8px; overflow: auto; white-space: pre-wrap;">${message}</pre>
    </div>
  `;
}

window.addEventListener('error', (e) => {
  try {
    showFatalError('Runtime error', String(e.error?.stack || e.message || 'Unknown error'));
  } catch {
    /* ignore */
  }
});

window.addEventListener('unhandledrejection', (e) => {
  try {
    const reason = (e as PromiseRejectionEvent).reason;
    showFatalError('Unhandled promise rejection', String(reason?.stack || reason || 'Unknown rejection'));
  } catch {
    /* ignore */
  }
});

createRoot(rootEl!).render(<App />);
