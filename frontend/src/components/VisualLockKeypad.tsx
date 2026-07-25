import React, { useState, useEffect } from 'react';
import { useWebSocket } from '../context/WebSocketContext';
import { Keyboard, Shield, Unlock, Lock, AlertCircle } from 'lucide-react';

export const VisualLockKeypad: React.FC = () => {
  const { locks } = useWebSocket();
  const [selectedLockId, setSelectedLockId] = useState<string>('');
  const [pin, setPin] = useState<string>('');
  const [status, setStatus] = useState<'idle' | 'submitting' | 'granted' | 'denied'>('idle');
  const [shake, setShake] = useState<boolean>(false);

  // Set default selected lock when locks list updates
  useEffect(() => {
    if (locks.length > 0 && !selectedLockId) {
      // Find default lock or pick first
      const defaultLock = locks.find(l => l.id === 'front-gate-01') || locks[0];
      setSelectedLockId(defaultLock.id);
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
    if (!selectedLockId || pin.length === 0) return;

    setStatus('submitting');

    try {
      const res = await fetch('/api/simulator/keypad', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lockId: selectedLockId, pin }),
      });

      if (res.ok) {
        // Validation query published successfully.
        // We now wait for the MQTT validating loop and WebSocket response!
        // For visual feedback, we clear PIN.
        setPin('');
      } else {
        triggerDenial();
      }
    } catch (err) {
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

  // Watch locks state to auto-update UI feedback if we receive a lock status change
  useEffect(() => {
    if (!activeLock) return;

    if (activeLock.status === 'UNLOCKED') {
      setStatus('granted');
      const timer = setTimeout(() => {
        setStatus('idle');
      }, 5000); // Reset back to idle after auto-relock window (5s)
      return () => clearTimeout(timer);
    }
  }, [activeLock?.status]);

  return (
    <div className="bg-slate-900/40 border border-white/5 rounded-2xl p-6 backdrop-blur-xl shadow-xl flex flex-col items-center w-full max-w-sm mx-auto">
      <div className="flex items-center gap-2 mb-6 self-start">
        <Keyboard className="w-5 h-5 text-indigo-400" />
        <h3 className="font-semibold text-slate-200 font-mono">Visual Lock Hardware</h3>
      </div>

      {/* Lock Selector */}
      <div className="w-full mb-6">
        <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2 font-mono">
          Select Lock Hardware
        </label>
        <select
          value={selectedLockId}
          onChange={(e) => {
            setSelectedLockId(e.target.value);
            setStatus('idle');
            setPin('');
          }}
          className="w-full bg-slate-950/80 border border-white/10 rounded-xl px-4 py-3 text-sm text-slate-200 outline-none focus:border-indigo-500/50 transition"
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
      <div className="relative w-36 h-36 rounded-full flex items-center justify-center border-4 border-slate-950 bg-slate-900/60 shadow-inner mb-6">
        {/* Status ring ring */}
        <div className={`absolute inset-0 rounded-full border-4 transition-all duration-500 ${
          !activeLock?.isOnline 
            ? 'border-slate-700 shadow-[0_0_15px_rgba(100,116,139,0.3)]'
            : activeLock.status === 'UNLOCKED' || status === 'granted'
              ? 'border-emerald-500 shadow-[0_0_20px_rgba(16,185,129,0.5)]'
              : status === 'denied'
                ? 'border-rose-500 shadow-[0_0_20px_rgba(239,68,68,0.5)]'
                : 'border-indigo-500 shadow-[0_0_15px_rgba(99,102,241,0.3)]'
        }`}></div>

        {/* Lock Icon */}
        <div className="flex flex-col items-center gap-1 z-10">
          {!activeLock?.isOnline ? (
            <>
              <Shield className="w-8 h-8 text-slate-500" />
              <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500">Offline</span>
            </>
          ) : activeLock.status === 'UNLOCKED' || status === 'granted' ? (
            <>
              <Unlock className="w-8 h-8 text-emerald-400 animate-bounce" />
              <span className="text-[10px] uppercase font-bold tracking-wider text-emerald-400">Open</span>
            </>
          ) : status === 'denied' ? (
            <>
              <AlertCircle className="w-8 h-8 text-rose-400" />
              <span className="text-[10px] uppercase font-bold tracking-wider text-rose-400">Refused</span>
            </>
          ) : (
            <>
              <Lock className="w-8 h-8 text-indigo-400" />
              <span className="text-[10px] uppercase font-bold tracking-wider text-indigo-400">Locked</span>
            </>
          )}
        </div>
      </div>

      {/* Screen Display */}
      <div className={`w-full bg-slate-950 border border-white/10 rounded-xl py-3 px-4 flex justify-between items-center mb-6 h-12 transition-all font-mono ${
        shake ? 'animate-pulse border-rose-500/50 bg-rose-950/20' : ''
      }`}>
        <span className="text-xs text-slate-500 tracking-wider">PIN:</span>
        <span className="text-lg font-bold tracking-[0.25em] text-slate-200">
          {pin ? '*'.repeat(pin.length) : '------'}
        </span>
      </div>

      {/* Keypad Grid */}
      <div className="grid grid-cols-3 gap-3 w-full max-w-[280px]">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(num => (
          <button
            key={num}
            onClick={() => handleKeyPress(num)}
            className="h-12 rounded-xl bg-slate-950/50 border border-white/5 text-lg font-semibold text-slate-300 hover:bg-white/5 active:scale-95 transition flex items-center justify-center font-mono"
          >
            {num}
          </button>
        ))}
        <button
          onClick={handleClear}
          className="h-12 rounded-xl bg-rose-950/20 border border-rose-500/20 text-xs font-bold text-rose-400 hover:bg-rose-950/40 active:scale-95 transition flex items-center justify-center font-mono"
        >
          CLR
        </button>
        <button
          onClick={() => handleKeyPress('0')}
          className="h-12 rounded-xl bg-slate-950/50 border border-white/5 text-lg font-semibold text-slate-300 hover:bg-white/5 active:scale-95 transition flex items-center justify-center font-mono"
        >
          0
        </button>
        <button
          onClick={handleSubmit}
          className="h-12 rounded-xl bg-indigo-500/20 border border-indigo-500/40 text-xs font-bold text-indigo-400 hover:bg-indigo-500/30 active:scale-95 transition flex items-center justify-center font-mono"
        >
          ENT
        </button>
      </div>
    </div>
  );
};
