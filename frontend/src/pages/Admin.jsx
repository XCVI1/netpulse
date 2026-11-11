import React, { useState, useEffect } from 'react';
import { Trash2, PlusCircle, LogOut, Lock } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export default function Admin() {
  const [token, setToken] = useState(localStorage.getItem('netpulse_token') || '');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const [devices, setDevices] = useState([]);
  const [form, setForm] = useState({
    name: '',
    ip_address: '',
    device_type: 'ssh',
    ssh_port: 22,
    ssh_user: 'root',
    ssh_password: '',
    snmp_community: 'public',
    snmp_port: 161
  });

  const fetchDevices = async () => {
    const res = await fetch(`${API_URL}/api/devices`);
    setDevices(await res.json());
  };

  useEffect(() => {
    if (token) fetchDevices();
  }, [token]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    const res = await fetch(`${API_URL}/api/auth/login`, {
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
  };

  const handleAddDevice = async (e) => {
    e.preventDefault();
    const res = await fetch(`${API_URL}/api/admin/devices`, {
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
    await fetch(`${API_URL}/api/admin/devices/${id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    fetchDevices();
  };

  const handleLogout = () => {
    localStorage.removeItem('netpulse_token');
    setToken('');
  };

  // Экран авторизации
  if (!token) {
    return (
      <div className="max-w-md mx-auto mt-16 bg-slate-900 border border-slate-800 p-8 rounded-2xl">
        <div className="flex items-center gap-2 text-xl font-bold mb-6">
          <Lock className="w-6 h-6 text-amber-400" />
          <h2>Вход в панель администратора</h2>
        </div>
        {error && <p className="bg-rose-500/10 text-rose-400 p-3 rounded-lg text-sm mb-4">{error}</p>}
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="text-xs text-slate-400">Логин</label>
            <input
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
              className="w-full mt-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm"
              required
            />
          </div>
          <div>
            <label className="text-xs text-slate-400">Пароль</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full mt-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm"
              required
            />
          </div>
          <button className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-medium py-2 rounded-lg transition">
            Войти
          </button>
        </form>
      </div>
    );
  }

  // Экран управления узлами
  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Управление узлами сети</h1>
        <button onClick={handleLogout} className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-white">
          <LogOut className="w-4 h-4" /> Выйти
        </button>
      </div>

      {/* Форма добавления нового хоста */}
      <form onSubmit={handleAddDevice} className="bg-slate-900 border border-slate-800 p-6 rounded-xl space-y-4">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <PlusCircle className="w-5 h-5 text-emerald-400" /> Добавить сервер или маршрутизатор
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="text-xs text-slate-400">Название узла</label>
            <input
              placeholder="Напр: Proxmox-Main или Cisco-Core"
              value={form.name}
              onChange={e => setForm({ ...form, name: e.target.value })}
              className="w-full mt-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm"
              required
            />
          </div>
          <div>
            <label className="text-xs text-slate-400">IP-адрес / Хост</label>
            <input
              placeholder="192.168.1.10"
              value={form.ip_address}
              onChange={e => setForm({ ...form, ip_address: e.target.value })}
              className="w-full mt-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm"
              required
            />
          </div>
          <div>
            <label className="text-xs text-slate-400">Тип оборудования</label>
            <select
              value={form.device_type}
              onChange={e => setForm({ ...form, device_type: e.target.value })}
              className="w-full mt-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm"
            >
              <option value="ssh">Linux Сервер (SSH)</option>
              <option value="snmp">Маршрутизатор / Свитч (SNMP)</option>
            </select>
          </div>
        </div>

        {/* Динамические поля в зависимости от выбора SSH или SNMP */}
        {form.device_type === 'ssh' ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2 border-t border-slate-800">
            <div>
              <label className="text-xs text-slate-400">SSH Пользователь</label>
              <input
                value={form.ssh_user}
                onChange={e => setForm({ ...form, ssh_user: e.target.value })}
                className="w-full mt-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-slate-400">SSH Пароль</label>
              <input
                type="password"
                placeholder="Пароль от сервера"
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-slate-800">
            <div>
              <label className="text-xs text-slate-400">SNMP Community String</label>
              <input
                value={form.snmp_community}
                onChange={e => setForm({ ...form, snmp_community: e.target.value })}
                className="w-full mt-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-slate-400">SNMP Порт</label>
              <input
                type="number"
                value={form.snmp_port}
                onChange={e => setForm({ ...form, snmp_port: Number(e.target.value) })}
                className="w-full mt-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm"
              />
            </div>
          </div>
        )}

        <button className="bg-emerald-600 hover:bg-emerald-500 text-white font-medium px-5 py-2 rounded-lg text-sm transition">
          Подключить устройство
        </button>
      </form>

      {/* Таблица добавленных устройств */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-950 text-slate-400 border-b border-slate-800">
            <tr>
              <th className="p-4">Имя</th>
              <th className="p-4">IP-адрес</th>
              <th className="p-4">Протокол</th>
              <th className="p-4">Статус</th>
              <th className="p-4 text-right">Действия</th>
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
