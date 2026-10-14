import { Link, Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { supabase } from "../lib/supabase";

export default function Layout() {
  const { session, loading, isAdmin } = useAuth();
  if (loading) return <div className="min-h-screen bg-zinc-50" />;
  if (!session) return <Navigate to="/login" replace />;
  return (
    <div className="min-h-screen bg-zinc-50 text-ink">
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
          <Link to="/" className="flex items-center gap-2 font-bold">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-ink text-white">
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
            </span>
            Video pages
            {isAdmin && <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-zinc-500">Agency</span>}
          </Link>
          <nav className="flex items-center gap-4 text-sm">
            <Link to="/account" className="text-zinc-600 hover:text-ink">Account</Link>
            <button onClick={() => supabase.auth.signOut()} className="text-zinc-600 hover:text-ink">Sign out</button>
          </nav>
        </div>
      </header>
      <div className="mx-auto max-w-6xl px-4 py-8">
        <Outlet />
      </div>
    </div>
  );
}
