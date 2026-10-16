import { useEffect, useRef } from "react";
import { TURNSTILE_SITE_KEY } from "../product";

declare global {
  interface Window {
    turnstile?: {
      render: (el: HTMLElement, opts: Record<string, unknown>) => string;
      reset: (id?: string) => void;
      remove: (id: string) => void;
    };
  }
}

let loading: Promise<void> | null = null;
function loadScript() {
  if (window.turnstile) return Promise.resolve();
  loading ??= new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => { loading = null; reject(new Error("Couldn't load the security check.")); };
    document.head.appendChild(s);
  });
  return loading;
}

export const turnstileEnabled = !!TURNSTILE_SITE_KEY;

/**
 * Cloudflare's privacy-friendly "are you human" check. Renders nothing until a site key is set.
 * `resetKey` changes force a fresh token (tokens are single-use).
 */
export function Turnstile({ onToken, resetKey }: { onToken: (t: string | null) => void; resetKey?: number }) {
  const box = useRef<HTMLDivElement>(null);
  const widget = useRef<string | null>(null);

  useEffect(() => {
    if (!turnstileEnabled) return;
    let cancelled = false;
    loadScript().then(() => {
      if (cancelled || !box.current || !window.turnstile) return;
      widget.current = window.turnstile.render(box.current, {
        sitekey: TURNSTILE_SITE_KEY,
        theme: "light",
        size: "flexible",
        callback: (t: string) => onToken(t),
        "expired-callback": () => onToken(null),
        "error-callback": () => onToken(null),
      });
    }).catch(() => onToken(null));
    return () => {
      cancelled = true;
      if (widget.current && window.turnstile) window.turnstile.remove(widget.current);
      widget.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (resetKey && widget.current && window.turnstile) { window.turnstile.reset(widget.current); onToken(null); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey]);

  if (!turnstileEnabled) return null;
  return <div ref={box} className="min-h-[65px]" />;
}
