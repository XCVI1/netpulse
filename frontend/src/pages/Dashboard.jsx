import React, { useEffect, useState } from 'react';
import { Server, Monitor, Router, Network, Wifi, Cpu, HardDrive, Clock } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

export default function Dashboard() {
  const [devices, setDevices] = useState([]);
  const [selectedDevice, setSelectedDevice] = useState(null);
  const [history, setHistory] = useState([]);

  const fetchDevices = async () => {
    try {
      const res = await fetch('/api/devices');
      if (!res.ok) return;
      const data = await res.json();
      setDevices(data);
      setSelectedDevice(prev => {
        if (!prev && data.length > 0) return data[0];
        return data.find(d => d.id === prev?.id) || data[0] || null;
      });
    } catch (err) {
      console.error('Ошибка загрузки устройств:', err);
    }
  };

  const fetchHistory = async (id) => {
    try {
      const res = await fetch(`/api/devices/${id}/history`);
      if (res.ok) {
        setHistory(await res.json());
      }
    } catch (err) {
      console.error('Ошибка загрузки истории:', err);
    }
  };

  useEffect(() => {
    fetchDevices();
    const interval = setInterval(fetchDevices, 10000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (selectedDevice) {
      fetchHistory(selectedDevice.id);
    }
  }, [selectedDevice]);

  const onlineCount = devices.filter(d => d.status === 'online').length;

  const renderDeviceIcon = (type) => {
    switch (type) {
      case 'linux': return <Server className="w-6 h-6 text-indigo-400" />;
      case 'windows': return <Monitor className="w-6 h-6 text-sky-400" />;
      case 'router': return <Router className="w-6 h-6 text-amber-400" />;
      default: return <Network className="w-6 h-6 text-teal-400" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Верхняя сводка */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
          <p className="text-slate-400 text-sm">Всего узлов в сети</p>
          <p className="text-3xl font-bold mt-1">{devices.length}</p>
        </div>
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
          <p className="text-slate-400 text-sm">Статус Online</p>
          <p className="text-3xl font-bold text-emerald-400 mt-1">{onlineCount}</p>
        </div>
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
          <p className="text-slate-400 text-sm">Недоступны / Ошибки</p>
          <p className="text-3xl font-bold text-rose-500 mt-1">{devices.length - onlineCount}</p>
        </div>
      </div>

      {/* Сетка устройств */}
      {devices.length === 0 ? (
        <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-10 text-center text-slate-400">
          Устройства пока не добавлены или загружаются...
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {devices.map(dev => (
            <div
              key={dev.id}
              onClick={() => setSelectedDevice(dev)}
              className={`cursor-pointer bg-slate-900 border p-5 rounded-xl transition ${
                selectedDevice?.id === dev.id ? 'border-emerald-500 ring-1 ring-emerald-500/50' : 'border-slate-800 hover:border-slate-700'
              }`}
            >
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-3">
                  {renderDeviceIcon(dev.device_type)}
                  <div>
                    <h3 className="font-semibold text-lg">{dev.name}</h3>
                    <p className="text-xs text-slate-400 font-mono">{dev.ip_address}</p>
                  </div>
                </div>
                <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                  dev.status === 'online'
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                    : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                }`}>
                  {dev.status.toUpperCase()}
                </span>
              </div>

              {/* Прогресс-бары метрик */}
              <div className="space-y-3 text-sm">
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-slate-400 flex items-center gap-1"><Cpu className="w-3.5 h-3.5"/> CPU</span>
                    <span>{dev.cpu_usage}%</span>
                  </div>
                  <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                    <div className="bg-indigo-500 h-full transition-all" style={{ width: `${Math.min(dev.cpu_usage, 100)}%` }} />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-slate-400">RAM</span>
                    <span>{dev.ram_usage}%</span>
                  </div>
                  <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                    <div className="bg-emerald-500 h-full transition-all" style={{ width: `${Math.min(dev.ram_usage, 100)}%` }} />
                  </div>
                </div>

                {(dev.device_type === 'linux' || dev.device_type === 'windows') && (
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-slate-400 flex items-center gap-1"><HardDrive className="w-3.5 h-3.5"/> Disk</span>
                      <span>{dev.disk_usage}%</span>
                    </div>
                    <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                      <div className="bg-amber-500 h-full transition-all" style={{ width: `${Math.min(dev.disk_usage, 100)}%` }} />
                    </div>
                  </div>
                )}

                <div className="pt-2 border-t border-slate-800/80 flex justify-between text-xs text-slate-400">
                  <span className="flex items-center gap-1"><Wifi className="w-3.5 h-3.5 text-emerald-400"/> {dev.last_ping_ms} ms</span>
                  <span className="flex items-center gap-1 truncate max-w-[160px]" title={dev.uptime_str}>
                    <Clock className="w-3.5 h-3.5 shrink-0"/> {dev.uptime_str}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* График выбранного сервера */}
      {selectedDevice && (
        <div className="bg-slate-900 border border-slate-800 p-6 rounded-xl">
          <h3 className="text-lg font-semibold mb-4">
            Динамика нагрузки: <span className="text-emerald-400">{selectedDevice.name}</span> ({selectedDevice.ip_address})
          </h3>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={history}>
                <XAxis dataKey="time" stroke="#64748b" fontSize={12} />
                <YAxis stroke="#64748b" fontSize={12} domain={[0, 100]} />
                <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b' }} />
                <Line type="monotone" dataKey="cpu" stroke="#6366f1" name="CPU %" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="ram" stroke="#10b981" name="RAM %" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}
