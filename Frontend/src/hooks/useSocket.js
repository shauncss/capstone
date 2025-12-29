import { useEffect, useState } from 'react';
import { io } from 'socket.io-client';

const DEFAULT_SOCKET_URL = 'http://localhost:5000';
const DEV_SOCKET_PORT = import.meta.env.VITE_SOCKET_PORT || '5000';

function shouldUseEnvSocketUrl(url) {
  if (!url) return false;
  try {
    const parsed = new URL(url, typeof window !== 'undefined' ? window.location.href : undefined);
    const hostIsLoopback = ['localhost', '127.0.0.1', '0.0.0.0'].includes(parsed.hostname);
    if (typeof window === 'undefined') {
      return true;
    }
    const runtimeHostIsLoopback = ['localhost', '127.0.0.1'].includes(window.location.hostname);
    if (hostIsLoopback && !runtimeHostIsLoopback) {
      return false;
    }
    return true;
  } catch (err) {
    return false;
  }
}

function resolveSocketUrl() {
  if (shouldUseEnvSocketUrl(import.meta.env.VITE_SOCKET_URL)) {
    return import.meta.env.VITE_SOCKET_URL;
  }
  if (typeof window === 'undefined') {
    return DEFAULT_SOCKET_URL;
  }

  const { protocol, hostname, port } = window.location;
  const normalizedProtocol = protocol === 'https:' ? 'https:' : 'http:';
  const sameOrigin = `${normalizedProtocol}//${hostname}${port ? `:${port}` : ''}`;

  if (!port || port === '80' || port === '443' || port === DEV_SOCKET_PORT) {
    return sameOrigin;
  }

  return `${normalizedProtocol}//${hostname}:${DEV_SOCKET_PORT}`;
}

export default function useSocket() {
  const [socket, setSocket] = useState(null);

  useEffect(() => {
    const socketInstance = io(resolveSocketUrl(), { transports: ['websocket'] });
    setSocket(socketInstance);

    return () => {
      socketInstance.disconnect();
    };
  }, []);

  return socket;
}
