import React, { useState, useEffect } from 'react';
import { Trash2, PlusCircle, LogOut, Lock, Server, Monitor, Router, Network } from 'lucide-react';

export default function Admin() {
  const [token, setToken] = useState(localStorage.getItem('netpulse_token') || '');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const [devices, setDevices] = useState([]);
  const [form, setForm] = useState({
    name: '',
    ip_address: '',
    device_type: 'linux', // 'linux', 'windows', 'router', 'switch'
    ssh_port: 22,
    ssh_user: 'root',
    ssh_password: '',
    snmp_community: 'public',
    snmp_port: 161
  });

  const fetchDevices = async () => {
    try {
      const res = await fetch('/api/devices');
      if (res.ok) setDevices(await res.json());
    } catch (err) {
      console.error('Ошибка загрузки устройств:', err);
    }
  };

  useEffect(() => {
    if (token) fetchDevices();
  }, [token]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      if (res.ok) {
        const data = await res.json();
        localStorage.setItem('netpulse_token', data.access_token);
        setToken(data.access_token);
      } else {
        setError('Неверный логин или пароль');
      }
    } catch (err) {
      setError('Сервер бэкенда недоступен. Проверьте контейнер netpulse_backend.');
    } finally {
      setLoading(false);
    }
  };

  const handleTypeChange = (type) => {
    setForm({
      ...form,
      device_type: type,
      ssh_user: type === 'windows' ? 'Administrator' : 'root',
      ssh_port: 22
    });
  };

  const handleAddDevice = async (e) => {
    e.preventDefault();
    const res = await fetch('/api/admin/devices', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(form)
    });
    if (res.ok) {
      setForm({ ...form, name: '', ip_address: '', ssh_password: '' });
      fetchDevices();
    } else if (res.status === 401) {
      handleLogout();
    }
  };

  const handleDelete = async (id) => {
    await fetch(`/api/admin/devices/${id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    fetchDevices();
  };

  const handleLogout = () => {
    localStorage.removeItem('netpulse_token');
    setToken('');
  };

  if (!token) {
    return (
      <div className="max-w-md mx-auto mt-16 bg-slate-900 border border-slate-800 p-8 rounded-2xl">
        <div className="flex items-center gap-2 text-xl font-bold mb-6">
          <Lock className="w-6 h-6 text-amber-400" />
          <h2>Вход в панель администратора</h2>
        </div>
        {error && <p className="bg-rose-500/10 border border-rose-500/30 text-rose-400 p-3 rounded-lg text-sm mb-4">{error}</p>}
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="text-xs text-slate-400">Логин</label>
            <input
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
              className="w-full mt-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm focus:border-emerald-500 outline-none"
              required
            />
          </div>
          <div>
            <label className="text-xs text-slate-400">Пароль</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full mt-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm focus:border-emerald-500 outline-none"
              required
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-medium py-2 rounded-lg transition"
          >
            {loading ? 'Проверка...' : 'Войти'}
          </button>
        </form>
      </div>
    );
  }

  const isServer = form.device_type === 'linux' || form.device_type === 'windows';

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Управление инфраструктурой</h1>
        <button onClick={handleLogout} className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-white">
          <LogOut className="w-4 h-4" /> Выйти
        </button>
      </div>

      <form onSubmit={handleAddDevice} className="bg-slate-900 border border-slate-800 p-6 rounded-xl space-y-5">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <PlusCircle className="w-5 h-5 text-emerald-400" /> Добавить новое устройство
        </h2>

        {/* Плитки выбора типа оборудования */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { id: 'linux', label: 'Сервер Linux', sub: 'Debian / Ubuntu / Proxmox', icon: Server },
            { id: 'windows', label: 'Сервер Windows', sub: 'WinServer / RDP / SSH', icon: Monitor },
            { id: 'router', label: 'Маршрутизатор', sub: 'Cisco / MikroTik (SNMP)', icon: Router },
            { id: 'switch', label: 'Коммутатор', sub: 'D-Link / L2-L3 Switch', icon: Network },
          ].map(item => {
            const Icon = item.icon;
            const active = form.device_type === item.id;
            return (
              <button
                type="button"
                key={item.id}
                onClick={() => handleTypeChange(item.id)}
                className={`p-3 rounded-xl border text-left transition flex flex-col gap-1 ${
                  active
                    ? 'bg-emerald-500/10 border-emerald-500 text-white'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center gap-2 font-medium text-sm">
                  <Icon className={`w-4 h-4 ${active ? 'text-emerald-400' : 'text-slate-400'}`} />
                  {item.label}
                </div>
                <span className="text-[11px] text-slate-500">{item.sub}</span>
              </button>
            );
          })}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-slate-400">Название узла</label>
            <input
              placeholder="Напр: WDS-Server, Proxmox-01 или Cisco-2911"
              value={form.name}
              onChange={e => setForm({ ...form, name: e.target.value })}
              className="w-full mt-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm"
              required
            />
          </div>
          <div>
            <label className="text-xs text-slate-400">IP-адрес или Домен</label>
            <input
              placeholder="192.168.1.10"
              value={form.ip_address}
              onChange={e => setForm({ ...form, ip_address: e.target.value })}
              className="w-full mt-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm"
              required
            />
          </div>
        </div>

        {isServer ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-3 border-t border-slate-800">
            <div>
              <label className="text-xs text-slate-400">
                {form.device_type === 'windows' ? 'Пользователь Windows (OpenSSH)' : 'SSH Пользователь'}
              </label>
              <input
                value={form.ssh_user}
                onChange={e => setForm({ ...form, ssh_user: e.target.value })}
                className="w-full mt-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-slate-400">
                Пароль {form.device_type === 'windows' && '(необязательно для RDP-пинга)'}
              </label>
              <input
                type="password"
                placeholder="Пароль учетной записи"
                value={form.ssh_password}
                onChange={e => setForm({ ...form, ssh_password: e.target.value })}
                className="w-full mt-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-slate-400">SSH Порт</label>
              <input
                type="number"
                value={form.ssh_port}
                onChange={e => setForm({ ...form, ssh_port: Number(e.target.value) })}
                className="w-full mt-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm"
              />
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-3 border-t border-slate-800">
            <div>
              <label className="text-xs text-slate-400">SNMP Community (Read-Only)</label>
              <input
                value={form.snmp_community}
                onChange={e => setForm({ ...form, snmp_community: e.target.value })}
                className="w-full mt-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-slate-400">SNMP UDP Порт</label>
              <input
                type="number"
                value={form.snmp_port}
                onChange={e => setForm({ ...form, snmp_port: Number(e.target.value) })}
                className="w-full mt-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm"
              />
            </div>
          </div>
        )}

        <button type="submit" className="bg-emerald-600 hover:bg-emerald-500 text-white font-medium px-5 py-2.5 rounded-lg text-sm transition">
          Добавить в мониторинг
        </button>
      </form>

      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-950 text-slate-400 border-b border-slate-800">
            <tr>
              <th className="p-4">Устройство</th>
              <th className="p-4">IP-адрес</th>
              <th className="p-4">Категория</th>
              <th className="p-4">Статус</th>
              <th className="p-4 text-right">Удалить</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {devices.map(d => (
              <tr key={d.id} className="hover:bg-slate-800/40">
                <td className="p-4 font-medium">{d.name}</td>
                <td className="p-4 font-mono text-slate-400">{d.ip_address}</td>
                <td className="p-4 uppercase text-xs font-semibold text-indigo-400">{d.device_type}</td>
                <td className="p-4">{d.status}</td>
                <td className="p-4 text-right">
                  <button onClick={() => handleDelete(d.id)} className="text-rose-400 hover:text-rose-300">
                    <Trash2 className="w-4 h-4 inline" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
