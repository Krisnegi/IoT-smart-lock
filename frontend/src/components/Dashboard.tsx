import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useWebSocket } from '../context/WebSocketContext';
import { VisualLockKeypad } from './VisualLockKeypad';
import { 
  Shield, 
  LogOut, 
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
  const { logs, locks, wsConnected, refetchLocks } = useWebSocket();

  // Navigation / Modal States
  const [activeTab, setActiveTab] = useState<'monitor' | 'admin'>('monitor');
  const [viewingLogsLockId, setViewingLogsLockId] = useState<string | null>(null);
  const [historicalLogs, setHistoricalLogs] = useState<any[]>([]);
  const [logsLoading, setLogsLoading] = useState<boolean>(false);
  const [users, setUsers] = useState<any[]>([]);
  const [authorizedUsers, setAuthorizedUsers] = useState<any[]>([]);
  const [authorizedUsersForPin, setAuthorizedUsersForPin] = useState<any[]>([]);
  const [modalTab, setModalTab] = useState<'pins' | 'logs'>('pins');
  const [selectedKeypadLockId, setSelectedKeypadLockId] = useState<string>('');

  const lastSeenLogTimeRef = useRef<string | null>(null);

  // Listen to live events and show a temporary toast alert on ACCESS_DENIED (unauthorized/expired PIN entry)
  useEffect(() => {
    if (logs.length > 0) {
      const latestLog = logs[0];
      if (latestLog.type === 'ACCESS_DENIED') {
        if (lastSeenLogTimeRef.current !== latestLog.timestamp) {
          lastSeenLogTimeRef.current = latestLog.timestamp;
          
          // Check if event is fresh (less than 5 seconds old) to prevent historical toast display on mount
          const eventTime = new Date(latestLog.timestamp).getTime();
          const now = new Date().getTime();
          if (now - eventTime < 5000) {
            displayMessage('', latestLog.payload.message || 'Access denied: Invalid PIN typed');
          }
        }
      }
    }
  }, [logs]);

  // Fetch users list when token or role changes
  useEffect(() => {
    const fetchUsers = async () => {
      if (!token || user?.role === 'USER') return;
      try {
        const res = await fetch('/api/auth/users', {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          setUsers(data.users || []);
        }
      } catch (err) {
        console.error('Failed to fetch users:', err);
      }
    };
    fetchUsers();
  }, [token, user?.role]);

  // Auto-default select targets
  useEffect(() => {
    if (users.length > 0) {
      setPermUserId(prev => prev || users[0].id);
    }
  }, [users]);

  // Form inputs
  const [newLockId, setNewLockId] = useState('');
  const [newLockName, setNewLockName] = useState('');
  const [permUserId, setPermUserId] = useState('');
  const [permLockId, setPermLockId] = useState('');
  const [tempPinUserId, setTempPinUserId] = useState('');
  const [tempPinLockId, setTempPinLockId] = useState('');
  const [tempPinVal, setTempPinVal] = useState('');
  const [tempPinDuration, setTempPinDuration] = useState('30'); // default 30s

  // Load authorized users dynamically when the temporary PIN target lock is changed
  useEffect(() => {
    if (!tempPinLockId || !token) {
      setAuthorizedUsersForPin([]);
      setTempPinUserId('');
      return;
    }
    const fetchAuthorizedForPin = async () => {
      try {
        const res = await fetch(`/api/locks/${tempPinLockId}/logs`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          const authUsers = data.authorizedUsers || [];
          setAuthorizedUsersForPin(authUsers);
          if (authUsers.length > 0) {
            setTempPinUserId(authUsers[0].userId);
          } else {
            setTempPinUserId('');
          }
        }
      } catch (err) {
        console.error('Failed to fetch authorized users for PIN:', err);
      }
    };
    fetchAuthorizedForPin();
  }, [tempPinLockId, token]);

  // Status banners
  const [formSuccess, setFormSuccess] = useState<string>('');
  const [formError, setFormError] = useState<string>('');

  const displayMessage = (successMsg: string, errorMsg: string) => {
    if (successMsg) {
      setFormSuccess(successMsg);
      setTimeout(() => setFormSuccess(''), 3000);
    }
    if (errorMsg) {
      setFormError(errorMsg);
      setTimeout(() => setFormError(''), 3000);
    }
  };

  // 1. Remote Lock/Unlock Trigger
  const handleRemoteUnlock = async (lockId: string) => {
    const currentLock = locks.find(l => l.id === lockId);
    const action = currentLock?.status === 'UNLOCKED' ? 'lock' : 'unlock';

    if (action === 'unlock') {
      const confirmUnlock = window.confirm(`Are you sure you want to remotely unlock "${currentLock?.name || lockId}"?`);
      if (!confirmUnlock) return;
    }

    // Automatically focus keypad simulator on this lock
    setSelectedKeypadLockId(lockId);

    try {
      const res = await fetch(`/api/locks/${lockId}/unlock`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) {
        displayMessage('', data.error || `Remote ${action} failed`);
      } else {
        displayMessage(`Remote ${action} command sent successfully`, '');
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
    if (!tempPinLockId) {
      displayMessage('', 'Please select a target lock');
      return;
    }
    if (!tempPinUserId) {
      displayMessage('', 'Please select an authorized user');
      return;
    }
    if (!tempPinVal || tempPinVal.length !== 6) {
      displayMessage('', 'Please enter a valid 6-digit PIN');
      return;
    }
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

  // 5. Query Audit Logs & Permissions (Admin only)
  const handleViewLogs = async (lockId: string) => {
    setViewingLogsLockId(lockId);
    setLogsLoading(true);
    setHistoricalLogs([]);
    setAuthorizedUsers([]);
    setModalTab('pins');
    try {
      const res = await fetch(`/api/locks/${lockId}/logs`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) {
        setHistoricalLogs(data.logs || []);
        setAuthorizedUsers(data.authorizedUsers || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLogsLoading(false);
    }
  };

  const handleRevokePermission = async (targetUserId: string, lockId: string) => {
    if (!window.confirm("Are you sure you want to revoke this user's permission to this lock?")) return;
    try {
      const res = await fetch('/api/permissions/revoke', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ userId: targetUserId, lockId })
      });
      if (res.ok) {
        displayMessage('Permission revoked successfully', '');
        // Reload modal data live
        handleViewLogs(lockId);
      } else {
        const data = await res.json();
        displayMessage('', data.error || 'Failed to revoke permission');
      }
    } catch (err) {
      displayMessage('', 'Server error revoking permission');
    }
  };

  const getExpiryText = (expiresAtStr: string, isActive: boolean) => {
    const expiresAt = new Date(expiresAtStr);
    const now = new Date();
    if (!isActive || expiresAt <= now) {
      return <span className="text-rose-500 font-bold uppercase tracking-wider text-[10px]">Expired</span>;
    }
    return <span className="text-emerald-400 font-bold uppercase tracking-wider text-[10px]">Active</span>;
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

  const inspectedLock = locks.find(l => l.id === viewingLogsLockId);

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
      <main className="flex-grow p-6 grid grid-cols-1 lg:grid-cols-4 gap-6 max-w-7xl w-full mx-auto lg:h-[calc(100vh-120px)] lg:overflow-hidden min-h-0">
        
        {/* Left column: Lock registry list */}
        <div className="lg:col-span-1 h-full min-h-0 flex flex-col">
          {/* Registered Locks Panel */}
          <div className="bg-slate-900/20 border border-white/5 rounded-2xl p-5 backdrop-blur-xl flex flex-col h-full min-h-0">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 font-mono mb-4 flex items-center gap-2 flex-shrink-0">
              <Radio className="w-4 h-4 text-indigo-400" />
              Registered Devices
            </h4>
            <div className="space-y-3 overflow-y-auto flex-grow pr-1 min-h-0">
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
                          <span className="text-[9px] font-mono text-slate-500">{lock.id}</span>
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
                        {lock.status === 'UNLOCKED' ? 'Remote Lock' : 'Remote Unlock'}
                      </button>
                      {user?.role === 'ADMIN' && (
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
        <div className="lg:col-span-2 h-full min-h-0 flex flex-col space-y-6">
          {/* Navigation Tab Bar */}
          {user?.role !== 'USER' && (
            <div className="bg-slate-950/40 p-1 border border-white/5 rounded-xl flex flex-shrink-0">
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


          {/* ACTIVE VIEW TAB: SYSTEM MONITOR */}
          {activeTab === 'monitor' && (
            <div className="flex-grow min-h-0 flex flex-col">
              {/* Live WebSocket Event Console */}
              <div className="bg-slate-950/80 border border-white/5 rounded-2xl p-5 backdrop-blur-xl flex flex-col h-full min-h-0">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 font-mono mb-3.5 flex items-center gap-2 flex-shrink-0">
                  <ListOrdered className="w-4 h-4 text-indigo-400" />
                  Live Event Console (WebSockets stream)
                </h4>
                <div className="flex-grow rounded-xl bg-black/60 border border-white/5 p-4 overflow-y-auto font-mono text-xs text-slate-300 space-y-2.5 min-h-0">
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
          {activeTab === 'admin' && user?.role === 'ADMIN' && (
            <div className="space-y-6 overflow-y-auto flex-grow pr-1 min-h-0">
              
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
                      <select
                        required
                        value={permUserId}
                        onChange={(e) => setPermUserId(e.target.value)}
                        className="w-full bg-slate-950/80 border border-white/10 rounded-lg px-3 py-2 text-xs text-slate-200 outline-none focus:border-indigo-500/50 transition font-mono"
                      >
                        <option value="">Select User</option>
                        {users.map(u => (
                          <option key={u.id} value={u.id}>
                            {u.email} ({u.role})
                          </option>
                        ))}
                      </select>
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
                    <div>
                      <label className="block text-[10px] text-slate-400 uppercase tracking-wider mb-1 font-mono">Select User</label>
                      <select
                        required
                        value={tempPinUserId}
                        onChange={(e) => setTempPinUserId(e.target.value)}
                        disabled={!tempPinLockId || authorizedUsersForPin.length === 0}
                        className="w-full bg-slate-950/80 border border-white/10 rounded-lg px-3 py-2 text-xs text-slate-200 outline-none focus:border-indigo-500/50 transition font-mono disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {!tempPinLockId ? (
                          <option value="">Select target lock first</option>
                        ) : authorizedUsersForPin.length === 0 ? (
                          <option value="">No authorized users for this lock</option>
                        ) : (
                          <>
                            <option value="">Select User</option>
                            {authorizedUsersForPin.map(u => (
                              <option key={u.userId} value={u.userId}>
                                {u.email} ({u.role})
                              </option>
                            ))}
                          </>
                        )}
                      </select>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-[10px] text-slate-400 uppercase tracking-wider mb-1 font-mono">PIN Code (Digits Only)</label>
                      <input
                        type="text"
                        inputMode="numeric"
                        required
                        pattern="\d{6}"
                        maxLength={6}
                        value={tempPinVal}
                        onChange={(e) => setTempPinVal(e.target.value.replace(/\D/g, '').slice(0, 6))}
                        placeholder="e.g. 556677 (6 digits)"
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
                      disabled={!tempPinLockId || !tempPinUserId || !tempPinVal || tempPinVal.length !== 6 || authorizedUsersForPin.length === 0}
                      className="w-full py-2.5 bg-indigo-500 hover:bg-indigo-600 rounded-lg text-xs font-bold text-white transition active:scale-[0.97] disabled:opacity-50 disabled:cursor-not-allowed"
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
        <div className="lg:col-span-1 h-full min-h-0">
          <VisualLockKeypad selectedLockId={selectedKeypadLockId} setSelectedLockId={setSelectedKeypadLockId} />
        </div>

      </main>

      {/* HISTORICAL AUDIT LOGS MODAL */}
      {viewingLogsLockId && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50 backdrop-blur-sm animate-fade-in">
          <div className="bg-slate-900 border border-white/10 rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col p-4 sm:p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/5 pb-4 mb-4">
              <div>
                <h3 className="text-md font-bold font-mono text-slate-100 uppercase">Lock Inspection</h3>
                <div className="flex items-center gap-3.5 mt-1.5">
                  <span className="text-xs text-slate-400 font-mono tracking-wider">{viewingLogsLockId}</span>
                  {inspectedLock && (
                    <>
                      <span className={`flex items-center gap-1.5 text-[9px] font-mono font-bold px-2 py-0.5 rounded-full border ${
                        inspectedLock.isOnline 
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                          : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${inspectedLock.isOnline ? 'bg-emerald-500 shadow-[0_0_4px_#10b981]' : 'bg-rose-500'}`}></span>
                        {inspectedLock.isOnline ? 'ONLINE' : 'OFFLINE'}
                      </span>
                      <span className={`text-[9px] font-mono font-bold px-2.5 py-0.5 rounded-full border ${
                        inspectedLock.status === 'UNLOCKED' 
                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
                          : 'bg-slate-800 text-slate-400 border-white/5'
                      }`}>
                        {inspectedLock.status}
                      </span>
                    </>
                  )}
                </div>
              </div>
              <button
                onClick={() => setViewingLogsLockId(null)}
                className="text-slate-400 hover:text-slate-200 font-mono text-xs border border-white/5 px-3 py-1.5 rounded-lg bg-slate-950 hover:bg-slate-900 transition"
              >
                Close
              </button>
            </div>

            {/* Modal Tabs */}
            <div className="flex border-b border-white/5 mb-4 font-mono text-xs">
              <button
                onClick={() => setModalTab('pins')}
                className={`pb-2 px-4 font-bold uppercase border-b-2 transition ${
                  modalTab === 'pins' 
                    ? 'border-indigo-500 text-indigo-400 font-bold' 
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                Authorized Users
              </button>
              <button
                onClick={() => setModalTab('logs')}
                className={`pb-2 px-4 font-bold uppercase border-b-2 transition ${
                  modalTab === 'logs' 
                    ? 'border-indigo-500 text-indigo-400 font-bold' 
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                Access Audit Logs
              </button>
            </div>

            {/* Content Table wrapper */}
            <div className="flex-grow overflow-y-auto min-h-[250px]">
              {logsLoading ? (
                <div className="flex flex-col items-center justify-center py-20 text-slate-400 text-xs font-mono gap-2">
                  <Loader2 className="w-6 h-6 animate-spin text-indigo-400" />
                  Querying database...
                </div>
              ) : modalTab === 'pins' ? (
                authorizedUsers.length === 0 ? (
                  <div className="text-center py-20 text-slate-500 font-mono text-xs uppercase tracking-wider">
                    No users authorized for this device.
                  </div>
                ) : (
                  <div className="overflow-x-auto w-full border border-white/5 rounded-xl">
                    <table className="w-full text-left font-mono text-xs border-collapse min-w-[550px]">
                      <thead>
                        <tr className="border-b border-white/10 text-slate-400 uppercase tracking-wider bg-slate-950/40">
                          <th className="py-2.5 px-3 font-semibold text-[10px]">User Email</th>
                          <th className="py-2.5 px-3 font-semibold text-[10px]">PIN Code Status</th>
                          <th className="py-2.5 px-3 font-semibold text-[10px]">Expires At</th>
                          <th className="py-2.5 px-3 font-semibold text-[10px]">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5 text-slate-300">
                        {authorizedUsers.map((item) => (
                          <tr key={item.userId} className="hover:bg-white/5">
                            <td className="py-2.5 px-3 break-all font-semibold">
                              {item.email}
                            </td>
                            <td className="py-2.5 px-3">
                              {item.latestPin ? (
                                getExpiryText(item.latestPin.expiresAt, item.latestPin.isActive)
                              ) : (
                                <span className="text-slate-500 uppercase tracking-wider text-[10px]">Pin Not Issued</span>
                              )}
                            </td>
                            <td className="py-2.5 px-3 text-slate-400 text-[11px]">
                              {item.latestPin ? (
                                new Date(item.latestPin.expiresAt).toLocaleString()
                              ) : (
                                <span className="text-slate-600">-</span>
                              )}
                            </td>
                            <td className="py-2.5 px-3">
                              <button
                                onClick={() => handleRevokePermission(item.userId, viewingLogsLockId!)}
                                className="text-rose-400 hover:text-rose-300 font-bold uppercase tracking-wider text-[10px] hover:underline"
                              >
                                Revoke Access
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )
              ) : (
                historicalLogs.length === 0 ? (
                  <div className="text-center py-20 text-slate-500 font-mono text-xs uppercase tracking-wider">
                    No access records found in database for this device.
                  </div>
                ) : (
                  <div className="flex flex-col h-full">
                    {/* Access Audit Stats Overview */}
                    <div className="grid grid-cols-3 gap-3 mb-4 font-mono text-[9px] uppercase tracking-wider">
                      <div className="bg-slate-950/60 border border-white/5 rounded-xl p-3 flex flex-col gap-1 text-center">
                        <span className="text-slate-400">Total Attempts</span>
                        <span className="text-sm font-bold text-slate-100">{historicalLogs.length}</span>
                      </div>
                      <div className="bg-emerald-500/5 border border-emerald-500/10 rounded-xl p-3 flex flex-col gap-1 text-center">
                        <span className="text-emerald-500/80">Access Granted</span>
                        <span className="text-sm font-bold text-emerald-400">
                          {historicalLogs.filter(log => log.result === 'SUCCESS').length}
                        </span>
                      </div>
                      <div className="bg-rose-500/5 border border-rose-500/10 rounded-xl p-3 flex flex-col gap-1 text-center">
                        <span className="text-rose-500/80">Access Denied</span>
                        <span className="text-sm font-bold text-rose-400">
                          {historicalLogs.filter(log => log.result !== 'SUCCESS').length}
                        </span>
                      </div>
                    </div>

                    <div className="overflow-x-auto w-full border border-white/5 rounded-xl">
                      <table className="w-full text-left font-mono text-xs border-collapse min-w-[600px]">
                        <thead>
                          <tr className="border-b border-white/10 text-slate-400 uppercase tracking-wider bg-slate-950/40">
                            <th className="py-2.5 px-3 font-semibold text-[10px]">Timestamp</th>
                            <th className="py-2.5 px-3 font-semibold text-[10px]">Action Type</th>
                            <th className="py-2.5 px-3 font-semibold text-[10px]">Operator</th>
                            <th className="py-2.5 px-3 font-semibold text-[10px]">Outcome</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5 text-slate-300">
                          {historicalLogs.map((log) => (
                            <tr key={log.id} className="hover:bg-white/5">
                              <td className="py-2.5 px-3 whitespace-nowrap text-[11px] text-slate-400">
                                {new Date(log.timestamp).toLocaleString()}
                              </td>
                              <td className="py-2.5 px-3">
                                {log.method === 'API' ? (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded text-[9px] font-bold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 uppercase tracking-wider">
                                    Remote Cmd
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded text-[9px] font-bold bg-amber-500/10 text-amber-300 border border-amber-500/20 uppercase tracking-wider">
                                    Keypad PIN
                                  </span>
                                )}
                              </td>
                              <td className="py-2.5 px-3 break-all">
                                {log.user?.email || (log.method === 'PIN' ? 'Unknown' : 'System')}
                              </td>
                              <td className="py-2.5 px-3 font-semibold">
                                {(() => {
                                  switch (log.result) {
                                    case 'SUCCESS':
                                      return (
                                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[9px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                          <span className="w-1 h-1 rounded-full bg-emerald-400 shadow-[0_0_4px_#34d399]"></span>
                                          ACCESS GRANTED
                                        </span>
                                      );
                                    case 'FAILED_UNAUTHORIZED':
                                      return (
                                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[9px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20">
                                          <span className="w-1 h-1 rounded-full bg-rose-400"></span>
                                          DENIED: INVALID PIN
                                        </span>
                                      );
                                    case 'FAILED_EXPIRED_PIN':
                                      return (
                                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[9px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                                          <span className="w-1 h-1 rounded-full bg-amber-400"></span>
                                          DENIED: EXPIRED PIN
                                        </span>
                                      );
                                    case 'FAILED_OFFLINE':
                                      return (
                                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[9px] font-bold bg-slate-800 text-slate-400 border border-white/5">
                                          <span className="w-1 h-1 rounded-full bg-slate-500"></span>
                                          FAILED: OFFLINE
                                        </span>
                                      );
                                    case 'FAILED_DEVICE_ERROR':
                                    default:
                                      return (
                                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[9px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20">
                                          <span className="w-1 h-1 rounded-full bg-rose-400"></span>
                                          FAILED: DEVICE ERROR
                                        </span>
                                      );
                                  }
                                })()}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )
              )}
            </div>
          </div>
        </div>
      )}

      {/* Floating Toast Notification Overlay */}
      {(formSuccess || formError) && (
        <div className="fixed top-4 left-4 right-4 md:top-6 md:right-6 md:left-auto z-[9999] md:w-full md:max-w-sm animate-fade-in pointer-events-auto">
          <div className={`p-4 rounded-xl border backdrop-blur-xl shadow-2xl flex items-center gap-3 font-mono text-xs ${
            formSuccess 
              ? 'bg-slate-950/90 border-emerald-500/30 text-emerald-400 shadow-emerald-500/5' 
              : 'bg-slate-950/90 border-rose-500/30 text-rose-400 shadow-rose-500/5'
          }`}>
            <span className="flex-grow">{formSuccess || formError}</span>
            <button 
              onClick={() => {
                setFormSuccess('');
                setFormError('');
              }}
              className="text-[10px] hover:text-white transition opacity-60 hover:opacity-100"
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
