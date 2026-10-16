import { useEffect, useRef, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { api, beacon } from "../lib/supabase";
import { BrandedPage, PrivacyNote, StateMessage, VideoPageContent, type Brand, type PageContent, type TrackFn } from "../components/BrandedPage";

type WatchResponse = {
  state: "live" | "not_live" | "expired" | "processing" | "not_found" | "unavailable";
  brand?: Brand & {
    not_live_title: string; not_live_message: string;
    expired_title: string; expired_message: string;
  };
  page?: PageContent & { title: string; live_from: string | null };
  view_id?: string | null;
  vid?: string;
  player?: { iframe: string; poster: string; duration: number | null; captions?: boolean };
};

const OPT_OUT = "ev_optout";
function isOptedOut() {
  try { return localStorage.getItem(OPT_OUT) === "1"; } catch { return false; }
}

function viewerId() {
  if (isOptedOut()) return undefined;
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
  const [optedOut, setOptedOut] = useState(isOptedOut);
  const optOut = () => {
    try { localStorage.setItem(OPT_OUT, "1"); localStorage.removeItem("ev_viewer"); } catch { /* private mode: nothing stored anyway */ }
    setOptedOut(true);
  };

  useEffect(() => {
    api<WatchResponse>("watch", { org, video, viewer_id: viewerId(), device: device(), preview, no_track: isOptedOut() })
      .then((d) => {
        setData(d);
        document.title = d.page?.headline || d.brand?.name || "Video";
      })
      .catch(() => setErr(true));
  }, [org, video, preview]);

  if (err) return <Plain title="Something went wrong" message="Please try again in a moment." />;
  if (!data) return <div className="min-h-screen bg-neutral-950" />;
  if (!data.brand) return <Plain title="Video not found" message="This link isn't valid." />;

  const b = data.brand;

  if (data.state === "not_found") return <BrandedPage brand={b}><StateMessage title="Video not found" message="This link isn't valid." /></BrandedPage>;
  if (data.state === "expired") return <BrandedPage brand={b}><StateMessage title={b.expired_title} message={b.expired_message} /></BrandedPage>;
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
  if (data.state === "unavailable") return <BrandedPage brand={b}><StateMessage title="Not available right now" message="This video can't be shown at the moment. Please try again later." /></BrandedPage>;
  if (data.state === "processing") return <BrandedPage brand={b}><StateMessage title="Almost ready" message="This video is still being prepared. Try again in a few minutes." /></BrandedPage>;

  const p = data.page!;
  const track: TrackFn | undefined = data.view_id && data.vid && !optedOut
    ? (kind, label, url) => beacon("click", { vid: data.vid, view_id: data.view_id, kind, label, url })
    : undefined; // previews aren't tracked
  return (
    <BrandedPage brand={b}>
      {preview && <div className="mb-4 inline-block rounded-full bg-black/40 px-3 py-1 text-xs font-semibold text-white">Preview – not counted in stats</div>}
      <VideoPageContent
        brand={b}
        content={{ ...p, buttons: p.buttons ?? [] }}
        onTrack={track}
        video={<Player src={data.player!.iframe} poster={data.player!.poster} captions={!!data.player!.captions} viewId={optedOut ? null : data.view_id ?? null} />}
      />
      {!preview && <PrivacyNote brand={b} optedOut={optedOut} onOptOut={optOut} />}
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
function Player({ src, poster, viewId, captions }: { src: string; poster: string; viewId: string | null; captions: boolean }) {
  const ref = useRef<HTMLIFrameElement>(null);
  const url = `${src}?poster=${encodeURIComponent(poster)}&preload=auto&letterboxColor=transparent${captions ? "&defaultTextTrack=en" : ""}`;

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
