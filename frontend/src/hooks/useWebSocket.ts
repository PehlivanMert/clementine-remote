import { useState, useEffect, useRef, useCallback } from 'react';

type MessageHandler = (event: string, data: any) => void;

export function useWebSocket(onMessage: MessageHandler) {
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [isReconnecting, setIsReconnecting] = useState<boolean>(false);
  const socketRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<number | null>(null);
  const backoffRef = useRef<number>(1000);
  const onMessageRef = useRef<MessageHandler>(onMessage);

  useEffect(() => {
    onMessageRef.current = onMessage;
  }, [onMessage]);

  const connect = useCallback(() => {
    if (socketRef.current && (socketRef.current.readyState === WebSocket.OPEN || socketRef.current.readyState === WebSocket.CONNECTING)) {
      return;
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

    const token = localStorage.getItem('clementine_token');
    const wsUrl = token
      ? `${wsBase}/ws?token=${encodeURIComponent(token)}`
      : `${wsBase}/ws`;

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

        // Auto reconnect with exponential backoff
        const timeout = backoffRef.current;
        backoffRef.current = Math.min(backoffRef.current * 1.5, 8000);
        reconnectTimeoutRef.current = window.setTimeout(() => {
          connect();
        }, timeout);
      };

      ws.onerror = () => {
        ws.close();
      };
    } catch (e) {
      setIsReconnecting(true);
    }
  }, []);

  useEffect(() => {
    connect();

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (socketRef.current) {
        socketRef.current.close();
      }
    };
  }, [connect]);

  return { isConnected, isReconnecting };
}
