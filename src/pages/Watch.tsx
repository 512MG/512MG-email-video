import { useEffect, useRef, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { api } from "../lib/supabase";
import { BrandedPage, StateMessage, type Brand } from "../components/BrandedPage";

type WatchResponse = {
  state: "live" | "not_live" | "expired" | "processing" | "not_found";
  brand?: Brand & {
    not_live_title: string; not_live_message: string;
    expired_title: string; expired_message: string;
  };
  page?: { title: string; headline: string; message: string; button_text: string | null; button_url: string | null; live_from: string | null };
  view_id?: string | null;
  player?: { iframe: string; poster: string; duration: number | null };
};

function viewerId() {
  try {
    let id = localStorage.getItem("ev_viewer");
    if (!id) { id = crypto.randomUUID(); localStorage.setItem("ev_viewer", id); }
    return id;
  } catch { return crypto.randomUUID(); }
}

const device = () => (/Mobi|Android|iPhone/i.test(navigator.userAgent) ? "mobile" : /iPad|Tablet/i.test(navigator.userAgent) ? "tablet" : "desktop");

export default function Watch() {
  const { org = "", video = "" } = useParams();
  const [search] = useSearchParams();
  const preview = search.get("preview") === "1";
  const [data, setData] = useState<WatchResponse | null>(null);
  const [err, setErr] = useState(false);

  useEffect(() => {
    api<WatchResponse>("watch", { org, video, viewer_id: viewerId(), device: device(), preview })
      .then((d) => {
        setData(d);
        if (d.page?.headline) document.title = d.page.headline;
      })
      .catch(() => setErr(true));
  }, [org, video, preview]);

  if (err) return <Plain title="Something went wrong" message="Please try again in a moment." />;
  if (!data) return <div className="min-h-screen bg-neutral-950" />;
  if (!data.brand) return <Plain title="Video not found" message="This link isn't valid." />;

  const b = data.brand;
  const button = { text: data.page?.button_text ?? null, url: data.page?.button_url ?? null };

  if (data.state === "not_found") return <BrandedPage brand={b}><StateMessage title="Video not found" message="This link isn't valid." /></BrandedPage>;
  if (data.state === "expired") return <BrandedPage brand={b} button={button}><StateMessage title={b.expired_title} message={b.expired_message} /></BrandedPage>;
  if (data.state === "not_live")
    return (
      <BrandedPage brand={b}>
        <StateMessage title={b.not_live_title} message={b.not_live_message} />
        {data.page?.live_from && (
          <p className="text-sm opacity-60">
            Available from {new Date(data.page.live_from).toLocaleString("en-GB", { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" })}
          </p>
        )}
      </BrandedPage>
    );
  if (data.state === "processing") return <BrandedPage brand={b}><StateMessage title="Almost ready" message="This video is still being prepared. Try again in a few minutes." /></BrandedPage>;

  return (
    <BrandedPage brand={b} button={button}>
      {preview && <div className="mb-4 inline-block rounded-full bg-black/40 px-3 py-1 text-xs font-semibold text-white">Preview – not counted in stats</div>}
      {data.page?.headline && <h1 className="text-3xl font-bold leading-tight sm:text-4xl">{data.page.headline}</h1>}
      {data.page?.message && <p className="mx-auto mt-3 max-w-xl whitespace-pre-line text-lg opacity-80">{data.page.message}</p>}
      <div className="mt-6 overflow-hidden rounded-2xl shadow-2xl ring-1 ring-black/10">
        <Player src={data.player!.iframe} poster={data.player!.poster} viewId={data.view_id ?? null} />
      </div>
    </BrandedPage>
  );
}

function Plain({ title, message }: { title: string; message: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-950 px-6 text-center text-white">
      <div><h1 className="text-2xl font-bold">{title}</h1><p className="mt-2 opacity-70">{message}</p></div>
    </div>
  );
}

declare global { interface Window { Stream?: (el: HTMLIFrameElement) => any } }

function loadSdk(): Promise<void> {
  if (window.Stream) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://embed.cloudflarestream.com/embed/sdk.latest.js";
    s.onload = () => resolve();
    s.onerror = reject;
    document.head.appendChild(s);
  });
}

/** Cloudflare Stream player; reports watch progress for the dashboard stats. */
function Player({ src, poster, viewId }: { src: string; poster: string; viewId: string | null }) {
  const ref = useRef<HTMLIFrameElement>(null);
  const url = `${src}?poster=${encodeURIComponent(poster)}&preload=auto&letterboxColor=transparent`;

  useEffect(() => {
    if (!viewId || !ref.current) return;
    let player: any;
    let lastTime = 0;
    let pending = 0;
    let ended = false;
    let timer: number | undefined;

    const flush = () => {
      if (pending <= 0 && !ended) return;
      const delta = pending;
      pending = 0;
      api("progress", { view_id: viewId, position: lastTime, watched_delta: delta, ended }).catch(() => {});
    };

    loadSdk().then(() => {
      if (!window.Stream || !ref.current) return;
      player = window.Stream(ref.current);
      player.addEventListener("timeupdate", () => {
        const t = Number(player.currentTime) || 0;
        const d = t - lastTime;
        if (d > 0 && d < 2.5) pending += d; // ignore seeks
        lastTime = t;
      });
      player.addEventListener("ended", () => { ended = true; flush(); });
      timer = window.setInterval(flush, 10000);
    }).catch(() => {});

    const onHide = () => { if (document.visibilityState === "hidden") flush(); };
    document.addEventListener("visibilitychange", onHide);
    return () => {
      if (timer) clearInterval(timer);
      document.removeEventListener("visibilitychange", onHide);
      flush();
    };
  }, [viewId]);

  return (
    <div className="relative w-full" style={{ paddingTop: "56.25%" }}>
      <iframe
        ref={ref}
        src={url}
        className="absolute inset-0 h-full w-full border-0"
        allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture; fullscreen"
        allowFullScreen
        title="Video"
      />
    </div>
  );
}
