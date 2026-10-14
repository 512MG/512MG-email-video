import { useEffect, useRef, useState } from "react";
import { api, loadFont, supabase, type Org, type Video } from "../lib/supabase";
import { readableOn } from "./BrandedPage";

const W = 1200, H = 675;

/** Builds the "click to watch" image for emails: a frame from the video (or your own image), a play button and optional text. */
export default function EmailImage({ org, video, onSaved }: { org: Org; video: Video; onSaved: (url: string) => void }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [bg, setBg] = useState<HTMLImageElement | null>(null);
  const [time, setTime] = useState(1);
  const [text, setText] = useState("");
  const [loadingFrame, setLoadingFrame] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  const fetchFrame = async (t: number) => {
    setLoadingFrame(true); setErr("");
    try {
      const blob = await api<Blob>("thumbnail", { video_id: video.id, time: t });
      const img = new Image();
      img.src = URL.createObjectURL(blob);
      await img.decode();
      setBg(img);
    } catch (e: any) { setErr(e.message); } finally { setLoadingFrame(false); }
  };

  useEffect(() => { if (video.status === "ready") fetchFrame(1); }, [video.id, video.status]);

  useEffect(() => {
    const c = canvas.current;
    if (!c) return;
    const ctx = c.getContext("2d")!;
    let cancelled = false;
    (async () => {
      loadFont(org.font);
      try { await document.fonts.load(`700 52px '${org.font}'`); } catch { /* fallback font */ }
      if (cancelled) return;
      ctx.fillStyle = org.bg_color;
      ctx.fillRect(0, 0, W, H);
      if (bg) {
        const s = Math.max(W / bg.width, H / bg.height);
        const w = bg.width * s, h = bg.height * s;
        ctx.drawImage(bg, (W - w) / 2, (H - h) / 2, w, h);
      }
      // gentle darkening so the play button stands out
      ctx.fillStyle = "rgba(0,0,0,0.18)";
      ctx.fillRect(0, 0, W, H);
      const cy = text ? H / 2 - 40 : H / 2;
      if (text) {
        const g = ctx.createLinearGradient(0, H - 230, 0, H);
        g.addColorStop(0, "rgba(0,0,0,0)");
        g.addColorStop(1, "rgba(0,0,0,0.75)");
        ctx.fillStyle = g;
        ctx.fillRect(0, H - 230, W, 230);
        ctx.fillStyle = "#ffffff";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        let size = 56;
        do { ctx.font = `700 ${size}px '${org.font}', sans-serif`; size -= 2; } while (ctx.measureText(text).width > W - 120 && size > 24);
        ctx.fillText(text, W / 2, H - 80);
      }
      // play button
      ctx.beginPath();
      ctx.arc(W / 2, cy, 70, 0, Math.PI * 2);
      ctx.fillStyle = org.accent_color;
      ctx.shadowColor = "rgba(0,0,0,0.35)";
      ctx.shadowBlur = 30;
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.beginPath();
      ctx.moveTo(W / 2 - 22, cy - 36);
      ctx.lineTo(W / 2 - 22, cy + 36);
      ctx.lineTo(W / 2 + 38, cy);
      ctx.closePath();
      ctx.fillStyle = readableOn(org.accent_color);
      ctx.fill();
    })();
    return () => { cancelled = true; };
  }, [bg, text, org.font, org.accent_color, org.bg_color]);

  const useOwn = async (file: File) => {
    const img = new Image();
    img.src = URL.createObjectURL(file);
    await img.decode();
    setBg(img);
  };

  const save = async () => {
    const c = canvas.current;
    if (!c) return;
    setSaving(true); setErr("");
    const blob: Blob | null = await new Promise((r) => c.toBlob(r, "image/jpeg", 0.85));
    if (!blob) { setSaving(false); return; }
    const path = `${org.id}/${video.id}-${Date.now()}.jpg`;
    const { error } = await supabase.storage.from("email-images").upload(path, blob, { contentType: "image/jpeg" });
    if (error) { setErr(error.message); setSaving(false); return; }
    const url = supabase.storage.from("email-images").getPublicUrl(path).data.publicUrl;
    await supabase.from("videos").update({ email_image_url: url }).eq("id", video.id);
    setSaving(false);
    onSaved(url);
  };

  return (
    <div className="space-y-3">
      <canvas ref={canvas} width={W} height={H} className="w-full rounded-lg border border-zinc-200" />
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label">Frame from the video {loadingFrame && "· loading…"}</label>
          <input type="range" min={0} max={Math.max(1, Math.floor(video.duration ?? 10))} step={0.5} value={time}
            onChange={(e) => setTime(Number(e.target.value))} onMouseUp={() => fetchFrame(time)} onTouchEnd={() => fetchFrame(time)}
            className="w-full" disabled={video.status !== "ready"} />
        </div>
        <div>
          <label className="label">Text on the image (optional)</label>
          <input className="input" value={text} onChange={(e) => setText(e.target.value)} placeholder="🎉 You've got a birthday message!" />
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button className="btn-primary" onClick={save} disabled={saving}>{saving ? "Saving…" : "Save email image"}</button>
        <label className="btn-ghost cursor-pointer">Use my own image instead<input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && useOwn(e.target.files[0])} /></label>
        {err && <span className="text-sm text-red-600">{err}</span>}
      </div>
    </div>
  );
}
