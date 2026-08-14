"use client";

import { useEffect, useRef } from "react";
import { getSession, wsUrl } from "./api";

type Handler = (event: string, data: unknown) => void;

export function useRealtime(onEvent: Handler, enabled = true) {
  const handlerRef = useRef(onEvent);
  handlerRef.current = onEvent;

  useEffect(() => {
    if (!enabled) return;
    const session = getSession();
    if (!session?.token || !session.tenantId) return;

    let ws: WebSocket | null = null;
    let closed = false;
    let retry = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const connect = () => {
      if (closed) return;
      ws = new WebSocket(wsUrl(session.token, session.tenantId));
      ws.onopen = () => {
        retry = 0;
      };
      ws.onmessage = (ev) => {
        try {
          const msg = JSON.parse(String(ev.data)) as {
            event: string;
            data: unknown;
          };
          handlerRef.current(msg.event, msg.data);
        } catch {
          /* ignore */
        }
      };
      ws.onclose = () => {
        if (closed) return;
        const delay = Math.min(1000 * 2 ** retry, 10000);
        retry += 1;
        timer = setTimeout(connect, delay);
      };
    };

    connect();
    return () => {
      closed = true;
      if (timer) clearTimeout(timer);
      ws?.close();
    };
  }, [enabled]);
}
