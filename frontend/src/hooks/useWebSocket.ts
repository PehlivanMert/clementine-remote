import { useState, useEffect, useRef, useCallback } from 'react';

type MessageHandler = (event: string, data: any) => void;

export function useWebSocket(onMessage: MessageHandler, isAuthenticated: boolean = true) {
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [isReconnecting, setIsReconnecting] = useState<boolean>(false);
  const socketRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<number | null>(null);
  const backoffRef = useRef<number>(1000);
  const onMessageRef = useRef<MessageHandler>(onMessage);

  useEffect(() => {
    onMessageRef.current = onMessage;
  }, [onMessage]);

  const connect = useCallback((force = false) => {
    // If not authenticated, do not attempt WS connection to prevent 403 handshake rejection
    const token = localStorage.getItem('clementine_token');
    if (!token) {
      setIsConnected(false);
      return;
    }

    if (!force && socketRef.current && (socketRef.current.readyState === WebSocket.OPEN || socketRef.current.readyState === WebSocket.CONNECTING)) {
      return;
    }

    if (socketRef.current) {
      try {
        socketRef.current.close();
      } catch {
        // ignore
      }
      socketRef.current = null;
    }

    const host = window.location.host;
    const activeServer = localStorage.getItem('clementine_server_url') || '';
    let wsBase: string;
    if (activeServer && (host.includes('github.io') || window.location.protocol.startsWith('file'))) {
      try {
        const cleanUrl = activeServer.replace(/\/+$/, '');
        const urlObj = new URL(cleanUrl);
        const wsProto = urlObj.protocol === 'https:' ? 'wss:' : 'ws:';
        wsBase = `${wsProto}//${urlObj.host}`;
      } catch {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        wsBase = `${protocol}//${host}`;
      }
    } else {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      wsBase = `${protocol}//${host}`;
    }

    const wsUrl = `${wsBase}/ws?token=${encodeURIComponent(token)}`;

    try {
      const ws = new WebSocket(wsUrl);
      socketRef.current = ws;

      ws.onopen = () => {
        setIsConnected(true);
        setIsReconnecting(false);
        backoffRef.current = 1000;
      };

      ws.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          if (payload.event && payload.event !== 'ping' && payload.event !== 'pong') {
            onMessageRef.current(payload.event, payload.data);
          }
        } catch (e) {
          console.error("WS parse error", e);
        }
      };

      ws.onclose = () => {
        setIsConnected(false);
        setIsReconnecting(true);
        socketRef.current = null;

        // Auto reconnect with exponential backoff if authenticated
        if (localStorage.getItem('clementine_token')) {
          const timeout = backoffRef.current;
          backoffRef.current = Math.min(backoffRef.current * 1.5, 6000);
          reconnectTimeoutRef.current = window.setTimeout(() => {
            connect();
          }, timeout);
        }
      };

      ws.onerror = () => {
        ws.close();
      };
    } catch (e) {
      setIsReconnecting(true);
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      connect(true);
    } else {
      if (socketRef.current) {
        socketRef.current.close();
        socketRef.current = null;
      }
      setIsConnected(false);
    }

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (socketRef.current) {
        socketRef.current.close();
      }
    };
  }, [connect, isAuthenticated]);

  const reconnect = useCallback(() => {
    connect(true);
  }, [connect]);

  return { isConnected, isReconnecting, reconnect };
}
