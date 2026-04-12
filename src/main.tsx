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

const supabaseUrl = String(import.meta.env.VITE_SUPABASE_URL || '').trim();
const supabaseAnon = String(import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim();
const supabasePub = String(import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || '').trim();

if (!supabaseUrl || (!supabaseAnon && !supabasePub)) {
  if (rootEl) {
    showFatalError(
      'Configuration required',
      'Missing Supabase environment variables. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your deployment environment (Vercel → Project Settings → Environment Variables), then redeploy.'
    );
  }
} else {
  createRoot(rootEl!).render(<App />);
}
