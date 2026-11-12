import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { isSupabaseConfigured } from './lib/supabase';
import './index.css';

function ConfigurationRequired() {
  return (
    <main className="min-h-screen bg-slate-50 px-5 py-12 flex items-center justify-center">
      <section className="w-full max-w-xl rounded-2xl border border-amber-200 bg-white p-7 shadow-sm">
        <div className="mb-4 inline-flex rounded-full bg-amber-50 px-3 py-1 text-sm font-semibold text-amber-800">
          Setup required
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          AttendEase is not connected to Supabase
        </h1>
        <p className="mt-3 text-slate-600">
          The demo dataset has been removed. No sample attendance, employee or payroll records will be shown.
          Configure the following build environment variables in Netlify, then trigger a new deploy.
        </p>
        <ul className="mt-5 list-disc space-y-2 pl-5 text-sm text-slate-800">
          <li><code>VITE_DEMO_MODE=false</code></li>
          <li><code>VITE_SUPABASE_URL</code> — your Supabase project URL</li>
          <li><code>VITE_SUPABASE_PUBLISHABLE_KEY</code> — your browser-safe publishable key (or legacy <code>VITE_SUPABASE_ANON_KEY</code>)</li>
        </ul>
        <p className="mt-5 rounded-lg bg-slate-50 p-3 text-sm text-slate-600">
          Do not add the Supabase <strong>service_role</strong> or secret key to Netlify frontend variables.
          Only use the publishable/anon key with the database Row-Level Security policies enabled.
        </p>
      </section>
    </main>
  );
}

createRoot(document.getElementById('root')!).render(
  isSupabaseConfigured ? <App /> : <ConfigurationRequired />,
);
