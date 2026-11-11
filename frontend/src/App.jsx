import React from 'react';
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import Admin from './pages/Admin';
import { Activity, ShieldAlert } from 'lucide-react';

export default function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen flex flex-col">
        <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur px-6 py-4 flex justify-between items-center">
          <Link to="/" className="flex items-center gap-2 text-xl font-bold text-emerald-400">
            <Activity className="w-6 h-6" />
            <span>NetPulse</span>
          </Link>
          <nav className="flex gap-4">
            <Link to="/" className="text-sm text-slate-300 hover:text-white px-3 py-1.5 rounded-lg hover:bg-slate-800">
              Дашборд
            </Link>
            <Link to="/admin" className="flex items-center gap-1.5 text-sm bg-slate-800 hover:bg-slate-700 text-slate-200 px-3 py-1.5 rounded-lg border border-slate-700">
              <ShieldAlert className="w-4 h-4 text-amber-400" />
              Админка
            </Link>
          </nav>
        </header>

        <main className="flex-1 p-6 max-w-7xl w-full mx-auto">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/admin" element={<Admin />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}
