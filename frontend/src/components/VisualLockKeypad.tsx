import React, { useState, useEffect } from 'react';
import { useWebSocket } from '../context/WebSocketContext';
import { Keyboard, Shield, Unlock, Lock, AlertCircle } from 'lucide-react';

interface VisualLockKeypadProps {
  selectedLockId: string;
  setSelectedLockId: (id: string) => void;
}

export const VisualLockKeypad: React.FC<VisualLockKeypadProps> = ({ selectedLockId, setSelectedLockId }) => {
  const { locks, logs } = useWebSocket();
  const [pin, setPin] = useState<string>('');
  const [status, setStatus] = useState<'idle' | 'submitting' | 'granted' | 'denied'>('idle');
  const [shake, setShake] = useState<boolean>(false);
  const [submitTime, setSubmitTime] = useState<number>(0);

  // Set default selected lock when locks list updates
  useEffect(() => {
    if (locks.length > 0 && !selectedLockId) {
      setSelectedLockId(locks[0].id);
    }
  }, [locks, selectedLockId]);

  const activeLock = locks.find(l => l.id === selectedLockId);

  const handleKeyPress = (num: string) => {
    if (status === 'submitting' || status === 'granted') return;
    setStatus('idle');
    if (pin.length < 6) {
      setPin(prev => prev + num);
    }
  };

  const handleClear = () => {
    setPin('');
    setStatus('idle');
  };

  const handleSubmit = async () => {
    if (!selectedLockId || pin.length !== 6) return;

    setStatus('submitting');
    setSubmitTime(Date.now());

    // Safety fallback timeout to reset keypad if response is lost/delayed
    const timeoutId = setTimeout(() => {
      setStatus(current => {
        if (current === 'submitting') {
          triggerDenial();
        }
        return current;
      });
    }, 3000);

    try {
      const res = await fetch('/api/simulator/keypad', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lockId: selectedLockId, pin }),
      });

      if (res.ok) {
        setPin('');
      } else {
        clearTimeout(timeoutId);
        triggerDenial();
      }
    } catch (err) {
      clearTimeout(timeoutId);
      triggerDenial();
    }
  };

  const triggerDenial = () => {
    setStatus('denied');
    setShake(true);
    setPin('');
    setTimeout(() => {
      setShake(false);
      setStatus('idle');
    }, 1500);
  };

  // Watch WebSocket logs to instantly trigger denial on failure
  useEffect(() => {
    if (status === 'submitting' && logs.length > 0) {
      const latest = logs[0];
      if (latest.type === 'ACCESS_DENIED' && latest.payload.lockId === selectedLockId) {
        const eventTime = new Date(latest.timestamp).getTime();
        if (eventTime >= submitTime) {
          triggerDenial();
        }
      }
    }
  }, [logs, status, selectedLockId, submitTime]);

  // Watch locks state to auto-update UI feedback if we receive a lock status change
  useEffect(() => {
    if (!activeLock) return;

    if (activeLock.status === 'UNLOCKED') {
      setStatus('granted');
    } else if (activeLock.status === 'LOCKED') {
      setStatus('idle');
    }
  }, [activeLock?.status]);

  return (
    <div className="bg-slate-900/40 border border-white/5 rounded-2xl p-5 backdrop-blur-xl shadow-xl flex flex-col items-center w-full max-w-sm mx-auto h-full min-h-0 overflow-y-auto">
      <div className="flex items-center gap-2 mb-4 self-start flex-shrink-0">
        <Keyboard className="w-4 h-4 text-indigo-400" />
        <h3 className="text-sm font-semibold text-slate-200 font-mono">Visual Lock Hardware</h3>
      </div>

      {/* Lock Selector */}
      <div className="w-full mb-4 flex-shrink-0">
        <label className="block text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5 font-mono">
          Select Lock Hardware
        </label>
        <select
          value={selectedLockId}
          onChange={(e) => {
            setSelectedLockId(e.target.value);
            setStatus('idle');
            setPin('');
          }}
          className="w-full bg-slate-950/80 border border-white/10 rounded-xl px-3 py-2 text-xs text-slate-200 outline-none focus:border-indigo-500/50 transition font-mono"
        >
          {locks.length === 0 ? (
            <option value="">No locks available</option>
          ) : (
            locks.map(lock => (
              <option key={lock.id} value={lock.id}>
                {lock.name} ({lock.id})
              </option>
            ))
          )}
        </select>
      </div>

      {/* Mock LED status dial */}
      <div className="relative w-28 h-28 rounded-full flex items-center justify-center border-4 border-slate-950 bg-slate-900/60 shadow-inner mb-4 flex-shrink-0">
        {/* Status ring ring */}
        <div className={`absolute inset-0 rounded-full border-4 transition-all duration-500 ${
          !activeLock?.isOnline 
            ? 'border-slate-700 shadow-[0_0_12px_rgba(100,116,139,0.25)]'
            : activeLock.status === 'UNLOCKED' || status === 'granted'
              ? 'border-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.4)]'
              : status === 'denied'
                ? 'border-rose-500 shadow-[0_0_15px_rgba(239,68,68,0.4)]'
                : 'border-indigo-500 shadow-[0_0_12px_rgba(99,102,241,0.25)]'
        }`}></div>

        {/* Lock Icon */}
        <div className="flex flex-col items-center gap-0.5 z-10">
          {!activeLock?.isOnline ? (
            <>
              <Shield className="w-6 h-6 text-slate-500" />
              <span className="text-[9px] uppercase font-bold tracking-wider text-slate-500 font-mono">Offline</span>
            </>
          ) : activeLock.status === 'UNLOCKED' || status === 'granted' ? (
            <>
              <Unlock className="w-6 h-6 text-emerald-400 animate-bounce" />
              <span className="text-[9px] uppercase font-bold tracking-wider text-emerald-400 font-mono">Open</span>
            </>
          ) : status === 'denied' ? (
            <>
              <AlertCircle className="w-6 h-6 text-rose-400" />
              <span className="text-[9px] uppercase font-bold tracking-wider text-rose-400 font-mono">Refused</span>
            </>
          ) : (
            <>
              <Lock className="w-6 h-6 text-indigo-400" />
              <span className="text-[9px] uppercase font-bold tracking-wider text-indigo-400 font-mono">Locked</span>
            </>
          )}
        </div>
      </div>

      {/* Screen Display */}
      <div className={`w-full bg-slate-950 border border-white/10 rounded-xl py-2 px-3 flex justify-between items-center mb-4 h-10 transition-all font-mono flex-shrink-0 ${
        shake ? 'animate-pulse border-rose-500/50 bg-rose-950/20' : ''
      }`}>
        <span className="text-[10px] text-slate-500 tracking-wider">PIN:</span>
        <span className="text-base font-bold tracking-[0.25em] text-slate-200">
          {pin ? '*'.repeat(pin.length) : '------'}
        </span>
      </div>

      {/* Keypad Grid */}
      <div className="grid grid-cols-3 gap-2 w-full max-w-[240px] flex-shrink-0 pb-1">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(num => (
          <button
            key={num}
            onClick={() => handleKeyPress(num)}
            className="h-10 rounded-xl bg-slate-950/50 border border-white/5 text-base font-semibold text-slate-300 hover:bg-white/5 active:scale-95 transition flex items-center justify-center font-mono"
          >
            {num}
          </button>
        ))}
        <button
          onClick={handleClear}
          className="h-10 rounded-xl bg-rose-950/20 border border-rose-500/20 text-[10px] font-bold text-rose-400 hover:bg-rose-950/40 active:scale-95 transition flex items-center justify-center font-mono"
        >
          CLR
        </button>
        <button
          onClick={() => handleKeyPress('0')}
          className="h-10 rounded-xl bg-slate-950/50 border border-white/5 text-base font-semibold text-slate-300 hover:bg-white/5 active:scale-95 transition flex items-center justify-center font-mono"
        >
          0
        </button>
        <button
          onClick={handleSubmit}
          className="h-10 rounded-xl bg-indigo-500/20 border border-indigo-500/40 text-[10px] font-bold text-indigo-400 hover:bg-indigo-500/30 active:scale-95 transition flex items-center justify-center font-mono"
        >
          ENT
        </button>
      </div>
    </div>
  );
};
