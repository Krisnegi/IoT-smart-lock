import React, { createContext, useState, useEffect, useContext, useRef } from 'react';
import { useAuth } from './AuthContext';

export interface LogEntry {
  type: string;
  payload: any;
  timestamp: string;
}

export interface LockState {
  id: string;
  name: string;
  status: 'LOCKED' | 'UNLOCKED';
  isOnline: boolean;
}

interface WebSocketContextType {
  logs: LogEntry[];
  stats: {
    success: number;
    denied: number;
    failed: number;
  };
  locks: LockState[];
  wsConnected: boolean;
  refetchLocks: () => Promise<void>;
}

const WebSocketContext = createContext<WebSocketContextType | undefined>(undefined);

export const WebSocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { token, user } = useAuth();
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [locks, setLocks] = useState<LockState[]>([]);
  const [wsConnected, setWsConnected] = useState<boolean>(false);
  const [stats, setStats] = useState({ success: 0, denied: 0, failed: 0 });
  const socketRef = useRef<WebSocket | null>(null);

  // Fetch initial locks list from the REST API
  const refetchLocks = async () => {
    if (!token) return;

    try {
      // Admins and Managers query all locks. Standard users query only their allowed locks.
      const endpoint = user?.role === 'USER' ? '/api/permissions/my-locks' : '/api/locks';
      const res = await fetch(endpoint, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        const data = await res.json();
        const formatted = Array.isArray(data) ? data : (data.locks || []);
        setLocks(formatted);
      }
    } catch (err) {
      console.error('Failed to load locks:', err);
    }
  };

  // Refetch locks when token or role changes
  useEffect(() => {
    refetchLocks();
  }, [token, user?.role]);

  // Connect to WebSockets
  useEffect(() => {
    if (!token) {
      // Close socket if user logged out
      if (socketRef.current) {
        socketRef.current.close();
      }
      return;
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    // Connect to WebSockets sharing the same domain/port
    const socket = new WebSocket(`${protocol}//${host}/ws`);
    socketRef.current = socket;

    socket.onopen = () => {
      console.log('✅ Connected to WebSockets Live Stream');
      setWsConnected(true);
    };

    socket.onclose = () => {
      console.log('🛑 Disconnected from WebSockets Live Stream');
      setWsConnected(false);
    };

    socket.onmessage = (event) => {
      const message = JSON.parse(event.data);
      handleMessage(message);
    };

    return () => {
      socket.close();
    };
  }, [token]);

  const handleMessage = (msg: LogEntry) => {
    // 1. Append to logs feed
    setLogs((prev) => [msg, ...prev.slice(0, 49)]);

    const { type, payload } = msg;

    // 2. Increment stats
    if (type === 'LOCK_UNLOCKED') {
      setStats((prev) => ({ ...prev, success: prev.success + 1 }));
    } else if (type === 'ACCESS_DENIED') {
      setStats((prev) => ({ ...prev, denied: prev.denied + 1 }));
    } else if (type === 'UNLOCK_FAILED') {
      setStats((prev) => ({ ...prev, failed: prev.failed + 1 }));
    }

    // 3. Update active lock connection/status indicators
    const lockId = payload.lockId;
    if (lockId) {
      setLocks((prevLocks) => {
        const index = prevLocks.findIndex((l) => l.id === lockId);
        
        let targetLock: LockState;
        if (index > -1) {
          targetLock = { ...prevLocks[index] };
        } else {
          // If lock is not currently in client state, create mock info
          targetLock = { id: lockId, name: lockId, status: 'LOCKED', isOnline: true };
        }

        if (type === 'LOCK_OFFLINE') {
          targetLock.isOnline = false;
        } else if (type === 'LOCK_ONLINE') {
          targetLock.isOnline = true;
        } else if (type === 'LOCK_UNLOCKED') {
          targetLock.status = 'UNLOCKED';
        } else if (type === 'LOCK_STATUS_CHANGED') {
          targetLock.status = payload.status === 'UNLOCKED' ? 'UNLOCKED' : 'LOCKED';
        }

        const newLocks = [...prevLocks];
        if (index > -1) {
          newLocks[index] = targetLock;
        } else {
          newLocks.push(targetLock);
        }
        return newLocks;
      });
    }
  };

  return (
    <WebSocketContext.Provider value={{ logs, stats, locks, wsConnected, refetchLocks }}>
      {children}
    </WebSocketContext.Provider>
  );
};

export const useWebSocket = () => {
  const context = useContext(WebSocketContext);
  if (!context) {
    throw new Error('useWebSocket must be used within a WebSocketProvider');
  }
  return context;
};
