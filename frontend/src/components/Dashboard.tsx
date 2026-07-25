import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useWebSocket } from '../context/WebSocketContext';
import { VisualLockKeypad } from './VisualLockKeypad';
import { 
  Shield, 
  LogOut, 
  Activity, 
  Radio, 
  PlusCircle, 
  UserPlus, 
  Clock, 
  ListOrdered,
  Eye,
  Loader2,
  Trash2
} from 'lucide-react';

export const Dashboard: React.FC = () => {
  const { user, token, logout } = useAuth();
  const { logs, stats, locks, wsConnected, refetchLocks } = useWebSocket();

  // Navigation / Modal States
  const [activeTab, setActiveTab] = useState<'monitor' | 'admin'>('monitor');
  const [viewingLogsLockId, setViewingLogsLockId] = useState<string | null>(null);
  const [historicalLogs, setHistoricalLogs] = useState<any[]>([]);
  const [logsLoading, setLogsLoading] = useState<boolean>(false);

  // Form inputs
  const [newLockId, setNewLockId] = useState('');
  const [newLockName, setNewLockName] = useState('');
  const [permUserId, setPermUserId] = useState('');
  const [permLockId, setPermLockId] = useState('');
  const [tempPinUserId, setTempPinUserId] = useState('');
  const [tempPinLockId, setTempPinLockId] = useState('');
  const [tempPinVal, setTempPinVal] = useState('');
  const [tempPinDuration, setTempPinDuration] = useState('30'); // default 30s

  // Status banners
  const [formSuccess, setFormSuccess] = useState<string>('');
  const [formError, setFormError] = useState<string>('');

  const displayMessage = (successMsg: string, errorMsg: string) => {
    if (successMsg) {
      setFormSuccess(successMsg);
      setTimeout(() => setFormSuccess(''), 4000);
    }
    if (errorMsg) {
      setFormError(errorMsg);
      setTimeout(() => setFormError(''), 4000);
    }
  };

  // 1. Remote Unlock Trigger
  const handleRemoteUnlock = async (lockId: string) => {
    try {
      const res = await fetch(`/api/locks/${lockId}/unlock`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) {
        displayMessage('', data.error || 'Remote unlock failed');
      } else {
        displayMessage('Remote unlock command sent successfully', '');
      }
    } catch (err) {
      displayMessage('', 'Communication error');
    }
  };

  // 2. CRUD: Register Lock (Admin only)
  const handleRegisterLock = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/locks', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}` 
        },
        body: JSON.stringify({ id: newLockId, name: newLockName }),
      });
      const data = await res.json();
      if (res.ok) {
        displayMessage(`Lock ${newLockId} registered successfully`, '');
        setNewLockId('');
        setNewLockName('');
        refetchLocks();
      } else {
        displayMessage('', data.error || 'Failed to register lock');
      }
    } catch (err) {
      displayMessage('', 'Server error registering lock');
    }
  };

  // 3. Permission: Grant Access
  const handleGrantPermission = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/permissions/grant', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}` 
        },
        body: JSON.stringify({ userId: permUserId, lockId: permLockId }),
      });
      const data = await res.json();
      if (res.ok) {
        displayMessage('Permission granted successfully', '');
        setPermUserId('');
        setPermLockId('');
      } else {
        displayMessage('', data.error || 'Failed to grant permission');
      }
    } catch (err) {
      displayMessage('', 'Server error granting permission');
    }
  };

  // 4. Temporary PIN Schedule (Admin/Manager)
  const handleCreateTempPin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch(`/api/locks/${tempPinLockId}/temp-pin`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}` 
        },
        body: JSON.stringify({ 
          userId: tempPinUserId, 
          pin: tempPinVal, 
          durationSeconds: parseInt(tempPinDuration) 
        }),
      });
      const data = await res.json();
      if (res.ok) {
        displayMessage(`Temporary PIN created and scheduled for auto-expiration in ${tempPinDuration}s`, '');
        setTempPinUserId('');
        setTempPinLockId('');
        setTempPinVal('');
      } else {
        displayMessage('', data.error || 'Failed to create PIN');
      }
    } catch (err) {
      displayMessage('', 'Server error creating PIN');
    }
  };

  // 5. Query Audit Logs (Admin/Manager)
  const handleViewLogs = async (lockId: string) => {
    setViewingLogsLockId(lockId);
    setLogsLoading(true);
    setHistoricalLogs([]);
    try {
      const res = await fetch(`/api/locks/${lockId}/logs`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) {
        setHistoricalLogs(data.logs || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLogsLoading(false);
    }
  };

  // 6. Delete Lock (Admin only)
  const handleDeleteLock = async (lockId: string) => {
    if (!window.confirm(`Are you sure you want to unregister lock ${lockId}?`)) return;
    try {
      const res = await fetch(`/api/locks/${lockId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        displayMessage(`Lock ${lockId} deleted successfully`, '');
        refetchLocks();
      } else {
        const data = await res.json();
        displayMessage('', data.error || 'Delete failed');
      }
    } catch (err) {
      displayMessage('', 'Server error');
    }
  };

  return (
    <div className="min-h-screen flex flex-col font-sans">
      {/* Header bar */}
      <header className="bg-slate-950/60 border-b border-white/5 px-6 py-4 flex items-center justify-between sticky top-0 backdrop-blur-xl z-20">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center">
            <Shield className="w-6 h-6 text-indigo-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold font-mono text-slate-100 tracking-wide m-0 leading-none">
              SMART ACCESS CONSOLE
            </h1>
            <div className="flex items-center gap-1.5 mt-1">
              <span className={`w-2 h-2 rounded-full ${wsConnected ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`}></span>
              <span className="text-[10px] text-slate-400 font-mono tracking-widest uppercase">
                {wsConnected ? 'Telemetry Online' : 'Telemetry Offline'}
              </span>
            </div>
          </div>
        </div>

        {/* User context & log out */}
        <div className="flex items-center gap-4">
          <div className="text-right hidden md:block">
            <p className="text-xs font-semibold text-slate-300 font-mono">{user?.email}</p>
            <p className="text-[10px] text-slate-500 tracking-wider uppercase font-bold">{user?.role} Access</p>
          </div>
          <button
            onClick={logout}
            className="w-9 h-9 rounded-lg border border-white/5 bg-slate-900/60 hover:bg-rose-950/40 hover:border-rose-500/30 flex items-center justify-center transition active:scale-95 text-slate-400 hover:text-rose-400"
            title="Log Out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Main Layout Grid */}
      <main className="flex-grow p-6 grid grid-cols-1 lg:grid-cols-4 gap-6 max-w-7xl w-full mx-auto">
        
        {/* Left column: Stats card & Lock registry list */}
        <div className="lg:col-span-1 space-y-6">
          {/* Stats Widget */}
          <div className="bg-slate-900/20 border border-white/5 rounded-2xl p-5 backdrop-blur-xl">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 font-mono mb-4 flex items-center gap-2">
              <Activity className="w-4 h-4 text-indigo-400" />
              Live Telemetry Counters
            </h4>
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-slate-950/60 border border-white/5 rounded-xl p-3 text-center">
                <span className="text-xs font-mono text-slate-500 block mb-1">SUCCESS</span>
                <span className="text-xl font-bold font-mono text-emerald-400">{stats.success}</span>
              </div>
              <div className="bg-slate-950/60 border border-white/5 rounded-xl p-3 text-center">
                <span className="text-xs font-mono text-slate-500 block mb-1">DENIED</span>
                <span className="text-xl font-bold font-mono text-rose-400">{stats.denied}</span>
              </div>
              <div className="bg-slate-950/60 border border-white/5 rounded-xl p-3 text-center">
                <span className="text-xs font-mono text-slate-500 block mb-1">FAIL</span>
                <span className="text-xl font-bold font-mono text-amber-500">{stats.failed}</span>
              </div>
            </div>
          </div>

          {/* User ID quick copy (Important for Demo) */}
          <div className="bg-slate-900/20 border border-indigo-500/10 rounded-2xl p-4 backdrop-blur-xl font-mono text-[11px] space-y-2">
            <span className="text-indigo-400 font-semibold tracking-wider block">YOUR USER ID (FOR DEMO):</span>
            <div className="bg-slate-950/80 border border-white/5 p-2 rounded-lg text-slate-300 break-all select-all select-text cursor-pointer" title="Double click to select all">
              {user?.id}
            </div>
            <span className="text-[10px] text-slate-500 leading-relaxed block">
              Double click and copy this ID to create guest PINs or assign permissions.
            </span>
          </div>

          {/* Registered Locks Panel */}
          <div className="bg-slate-900/20 border border-white/5 rounded-2xl p-5 backdrop-blur-xl flex flex-col min-h-[300px]">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 font-mono mb-4 flex items-center gap-2">
              <Radio className="w-4 h-4 text-indigo-400" />
              Registered Devices
            </h4>
            <div className="space-y-3 overflow-y-auto max-h-[400px]">
              {locks.length === 0 ? (
                <div className="text-center text-xs text-slate-500 py-8 font-mono">
                  No registered devices.
                </div>
              ) : (
                locks.map(lock => (
                  <div key={lock.id} className="bg-slate-950/40 border border-white/5 rounded-xl p-3 flex flex-col gap-2.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${lock.isOnline ? 'bg-emerald-500 shadow-[0_0_8px_#10b981]' : 'bg-rose-500'}`}></span>
                        <div>
                          <p className="text-xs font-bold text-slate-200 font-mono leading-none">{lock.name}</p>
                          <span className="text-[9px] font-mono text-slate-500 uppercase">{lock.id}</span>
                        </div>
                      </div>
                      <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full ${
                        lock.status === 'UNLOCKED' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-slate-800 text-slate-400'
                      }`}>
                        {lock.status}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => handleRemoteUnlock(lock.id)}
                        disabled={!lock.isOnline}
                        className="flex-grow py-1 px-2 rounded-lg bg-indigo-500/10 border border-indigo-500/20 hover:bg-indigo-500/20 text-[10px] font-bold text-indigo-400 transition disabled:opacity-40"
                      >
                        Remote Unlock
                      </button>
                      {(user?.role === 'ADMIN' || user?.role === 'MANAGER') && (
                        <button
                          onClick={() => handleViewLogs(lock.id)}
                          className="p-1 rounded-lg bg-slate-850 hover:bg-slate-800 border border-white/5 text-[10px] font-bold text-slate-300 transition"
                          title="View Audit Logs"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                      )}
                      {user?.role === 'ADMIN' && (
                        <button
                          onClick={() => handleDeleteLock(lock.id)}
                          className="p-1 rounded-lg bg-rose-950/10 hover:bg-rose-950/30 border border-rose-500/10 text-[10px] font-bold text-rose-400 transition"
                          title="Unregister Lock"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Center column: Dashboard Tabs (Monitor/Admin) & visual logs feed / admin forms */}
        <div className="lg:col-span-2 space-y-6">
          {/* Navigation Tab Bar */}
          {user?.role !== 'USER' && (
            <div className="bg-slate-950/40 p-1 border border-white/5 rounded-xl flex">
              <button
                onClick={() => setActiveTab('monitor')}
                className={`flex-grow py-2 rounded-lg text-xs font-mono font-bold tracking-wider uppercase transition ${
                  activeTab === 'monitor' ? 'bg-indigo-500 text-white shadow-md shadow-indigo-500/10' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                System Monitor
              </button>
              <button
                onClick={() => setActiveTab('admin')}
                className={`flex-grow py-2 rounded-lg text-xs font-mono font-bold tracking-wider uppercase transition ${
                  activeTab === 'admin' ? 'bg-indigo-500 text-white shadow-md shadow-indigo-500/10' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Admin Controller
              </button>
            </div>
          )}

          {/* Form success / error banners */}
          {(formSuccess || formError) && (
            <div className={`px-4 py-3 rounded-xl text-center text-xs font-medium border transition duration-300 ${
              formSuccess ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-rose-500/10 border-rose-500/20 text-rose-400'
            }`}>
              {formSuccess || formError}
            </div>
          )}

          {/* ACTIVE VIEW TAB: SYSTEM MONITOR */}
          {activeTab === 'monitor' && (
            <div className="space-y-6">
              {/* Live WebSocket Event Console */}
              <div className="bg-slate-950/80 border border-white/5 rounded-2xl p-5 backdrop-blur-xl flex flex-col">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 font-mono mb-3.5 flex items-center gap-2">
                  <ListOrdered className="w-4 h-4 text-indigo-400" />
                  Live Event Console (WebSockets stream)
                </h4>
                <div className="h-[430px] rounded-xl bg-black/60 border border-white/5 p-4 overflow-y-auto font-mono text-xs text-slate-300 space-y-2.5">
                  {logs.length === 0 ? (
                    <div className="text-slate-500 text-center py-20 uppercase tracking-widest text-[10px]">
                      Waiting for incoming MQTT/WebSocket signals...
                    </div>
                  ) : (
                    logs.map((log, i) => (
                      <div key={i} className="border-b border-white/5 pb-2 last:border-b-0">
                        <div className="flex justify-between items-center mb-1">
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                            log.type.includes('ONLINE') || log.type.includes('UNLOCKED') 
                              ? 'bg-emerald-500/10 text-emerald-400'
                              : log.type.includes('DENIED') || log.type.includes('OFFLINE')
                                ? 'bg-rose-500/10 text-rose-400'
                                : 'bg-slate-800 text-slate-400'
                          }`}>
                            {log.type}
                          </span>
                          <span className="text-[9px] text-slate-500">
                            {new Date(log.timestamp).toLocaleTimeString()}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-300 leading-tight">
                          {log.payload.message || JSON.stringify(log.payload)}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ACTIVE VIEW TAB: ADMIN CONTROLS */}
          {activeTab === 'admin' && (user?.role === 'ADMIN' || user?.role === 'MANAGER') && (
            <div className="space-y-6">
              
              {/* Row 1: Register Lock (ADMIN only) & Grant Permissions */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* 1. Register Lock */}
                {user?.role === 'ADMIN' && (
                  <div className="bg-slate-900/20 border border-white/5 rounded-2xl p-5 backdrop-blur-xl">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 font-mono mb-4 flex items-center gap-1.5">
                      <PlusCircle className="w-4 h-4 text-indigo-400" />
                      Register Device
                    </h4>
                    <form onSubmit={handleRegisterLock} className="space-y-3.5">
                      <div>
                        <input
                          type="text"
                          required
                          value={newLockId}
                          onChange={(e) => setNewLockId(e.target.value)}
                          placeholder="device-id (e.g. gate-01)"
                          className="w-full bg-slate-950/80 border border-white/10 rounded-lg px-3 py-2 text-xs text-slate-200 outline-none focus:border-indigo-500/50 transition font-mono"
                        />
                      </div>
                      <div>
                        <input
                          type="text"
                          required
                          value={newLockName}
                          onChange={(e) => setNewLockName(e.target.value)}
                          placeholder="Device Name (e.g. Front Gate)"
                          className="w-full bg-slate-950/80 border border-white/10 rounded-lg px-3 py-2 text-xs text-slate-200 outline-none focus:border-indigo-500/50 transition"
                        />
                      </div>
                      <button
                        type="submit"
                        className="w-full py-2 bg-indigo-500 hover:bg-indigo-600 rounded-lg text-xs font-bold text-white transition active:scale-[0.97]"
                      >
                        Register Lock
                      </button>
                    </form>
                  </div>
                )}

                {/* 2. Grant Permission */}
                <div className="bg-slate-900/20 border border-white/5 rounded-2xl p-5 backdrop-blur-xl">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 font-mono mb-4 flex items-center gap-1.5">
                    <UserPlus className="w-4 h-4 text-indigo-400" />
                    Authorize Access
                  </h4>
                  <form onSubmit={handleGrantPermission} className="space-y-3.5">
                    <div>
                      <input
                        type="text"
                        required
                        value={permUserId}
                        onChange={(e) => setPermUserId(e.target.value)}
                        placeholder="User UUID (copy yours from sidebar)"
                        className="w-full bg-slate-950/80 border border-white/10 rounded-lg px-3 py-2 text-xs text-slate-200 outline-none focus:border-indigo-500/50 transition font-mono"
                      />
                    </div>
                    <div>
                      <select
                        required
                        value={permLockId}
                        onChange={(e) => setPermLockId(e.target.value)}
                        className="w-full bg-slate-950/80 border border-white/10 rounded-lg px-3 py-2 text-xs text-slate-200 outline-none focus:border-indigo-500/50 transition"
                      >
                        <option value="">Select Target Lock</option>
                        {locks.map(l => (
                          <option key={l.id} value={l.id}>{l.name} ({l.id})</option>
                        ))}
                      </select>
                    </div>
                    <button
                      type="submit"
                      className="w-full py-2 bg-indigo-500 hover:bg-indigo-600 rounded-lg text-xs font-bold text-white transition active:scale-[0.97]"
                    >
                      Authorize User
                    </button>
                  </form>
                </div>
              </div>

              {/* Row 2: Create Temp PIN */}
              <div className="bg-slate-900/20 border border-white/5 rounded-2xl p-5 backdrop-blur-xl">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 font-mono mb-4 flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-indigo-400" />
                  Issue Temporary Guest PIN (BullMQ expiry scheduler)
                </h4>
                <form onSubmit={handleCreateTempPin} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-3">
                    <div>
                      <label className="block text-[10px] text-slate-400 uppercase tracking-wider mb-1 font-mono">User UUID</label>
                      <input
                        type="text"
                        required
                        value={tempPinUserId}
                        onChange={(e) => setTempPinUserId(e.target.value)}
                        placeholder="User UUID"
                        className="w-full bg-slate-950/80 border border-white/10 rounded-lg px-3 py-2 text-xs text-slate-200 outline-none focus:border-indigo-500/50 transition font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-slate-400 uppercase tracking-wider mb-1 font-mono">Target Lock</label>
                      <select
                        required
                        value={tempPinLockId}
                        onChange={(e) => setTempPinLockId(e.target.value)}
                        className="w-full bg-slate-950/80 border border-white/10 rounded-lg px-3 py-2 text-xs text-slate-200 outline-none focus:border-indigo-500/50 transition"
                      >
                        <option value="">Select Lock</option>
                        {locks.map(l => (
                          <option key={l.id} value={l.id}>{l.name} ({l.id})</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-[10px] text-slate-400 uppercase tracking-wider mb-1 font-mono">PIN Code (Digits Only)</label>
                      <input
                        type="text"
                        required
                        pattern="\d+"
                        value={tempPinVal}
                        onChange={(e) => setTempPinVal(e.target.value)}
                        placeholder="e.g. 19485"
                        className="w-full bg-slate-950/80 border border-white/10 rounded-lg px-3 py-2 text-xs text-slate-200 outline-none focus:border-indigo-500/50 transition font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-slate-400 uppercase tracking-wider mb-1 font-mono">Duration (Seconds before expiry)</label>
                      <select
                        value={tempPinDuration}
                        onChange={(e) => setTempPinDuration(e.target.value)}
                        className="w-full bg-slate-950/80 border border-white/10 rounded-lg px-3 py-2 text-xs text-slate-200 outline-none focus:border-indigo-500/50 transition font-mono"
                      >
                        <option value="15">15 Seconds</option>
                        <option value="30">30 Seconds</option>
                        <option value="60">60 Seconds (1 Min)</option>
                        <option value="300">300 Seconds (5 Min)</option>
                      </select>
                    </div>
                  </div>
                  <div className="md:col-span-2 pt-2">
                    <button
                      type="submit"
                      className="w-full py-2.5 bg-indigo-500 hover:bg-indigo-600 rounded-lg text-xs font-bold text-white transition active:scale-[0.97]"
                    >
                      Issue Temporary Access PIN
                    </button>
                  </div>
                </form>
              </div>

            </div>
          )}
        </div>

        {/* Right column: Interactive Visual Keypad Simulator overlay */}
        <div className="lg:col-span-1">
          <VisualLockKeypad />
        </div>

      </main>

      {/* HISTORICAL AUDIT LOGS MODAL */}
      {viewingLogsLockId && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50 backdrop-blur-sm animate-fade-in">
          <div className="bg-slate-900 border border-white/10 rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/5 pb-4 mb-4">
              <div>
                <h3 className="text-md font-bold font-mono text-slate-100 uppercase">Device Audit Logs</h3>
                <p className="text-xs text-slate-400 font-mono tracking-wider">{viewingLogsLockId}</p>
              </div>
              <button
                onClick={() => setViewingLogsLockId(null)}
                className="text-slate-400 hover:text-slate-200 font-mono text-xs border border-white/5 px-3 py-1.5 rounded-lg bg-slate-950 hover:bg-slate-900 transition"
              >
                Close
              </button>
            </div>

            {/* Logs Table wrapper */}
            <div className="flex-grow overflow-y-auto min-h-[250px]">
              {logsLoading ? (
                <div className="flex flex-col items-center justify-center py-20 text-slate-400 text-xs font-mono gap-2">
                  <Loader2 className="w-6 h-6 animate-spin text-indigo-400" />
                  Querying database access log...
                </div>
              ) : historicalLogs.length === 0 ? (
                <div className="text-center py-20 text-slate-500 font-mono text-xs uppercase tracking-wider">
                  No access records found in database for this device.
                </div>
              ) : (
                <table className="w-full text-left font-mono text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-white/10 text-slate-400 uppercase tracking-wider">
                      <th className="py-2.5 px-3 font-semibold text-[10px]">Timestamp</th>
                      <th className="py-2.5 px-3 font-semibold text-[10px]">Method</th>
                      <th className="py-2.5 px-3 font-semibold text-[10px]">User Email</th>
                      <th className="py-2.5 px-3 font-semibold text-[10px]">Result</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 text-slate-300">
                    {historicalLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-white/5">
                        <td className="py-2.5 px-3 whitespace-nowrap text-[11px] text-slate-400">
                          {new Date(log.timestamp).toLocaleString()}
                        </td>
                        <td className="py-2.5 px-3">
                          <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                            log.method === 'API' ? 'bg-indigo-500/10 text-indigo-400' : 'bg-amber-500/10 text-amber-300'
                          }`}>
                            {log.method}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 break-all">
                          {log.user?.email || 'Guest User'}
                        </td>
                        <td className="py-2.5 px-3 font-semibold">
                          <span className={log.result === 'SUCCESS' ? 'text-emerald-400' : 'text-rose-400'}>
                            {log.result}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
