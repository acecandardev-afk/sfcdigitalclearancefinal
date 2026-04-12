import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

const rootEl = document.getElementById("root");

const supabaseUrl = String(import.meta.env.VITE_SUPABASE_URL || '').trim();
const supabaseAnon = String(import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim();
const supabasePub = String(import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || '').trim();

if (!supabaseUrl || (!supabaseAnon && !supabasePub)) {
  if (rootEl) {
    rootEl.innerHTML = `
      <div style="font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto; padding: 24px; max-width: 720px; margin: 0 auto;">
        <h1 style="font-size: 20px; font-weight: 700; margin: 0 0 12px;">Configuration required</h1>
        <p style="margin: 0 0 12px;">This app is missing Supabase environment variables.</p>
        <p style="margin: 0 0 12px;">Set these in your deployment environment (e.g. Vercel → Project Settings → Environment Variables) then redeploy:</p>
        <pre style="background: rgba(0,0,0,0.05); padding: 12px; border-radius: 8px; overflow: auto;">VITE_SUPABASE_URL=...\nVITE_SUPABASE_ANON_KEY=...</pre>
      </div>
    `;
  }
} else {
  createRoot(rootEl!).render(<App />);
}
