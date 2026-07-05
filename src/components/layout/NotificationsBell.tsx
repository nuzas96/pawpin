"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

type NotificationRow = {
  id: string;
  type: string;
  payload: Record<string, unknown>;
  read_at: string | null;
  created_at: string;
};

function messageFor(n: NotificationRow): string {
  const payloadMessage = n.payload && typeof n.payload.message === "string" ? n.payload.message : null;
  return payloadMessage ?? "You have a new notification.";
}

function linkFor(n: NotificationRow): string | null {
  const catId = n.payload && typeof n.payload.cat_id === "string" ? n.payload.cat_id : null;
  return catId ? `/cats/${catId}` : null;
}

export function NotificationsBell({ userId }: { userId: string }) {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const supabase = createClient();
      const { data } = await supabase
        .from("notifications")
        .select("id, type, payload, read_at, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(10);
      if (!cancelled) {
        setNotifications((data ?? []) as NotificationRow[]);
        setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  async function markAllRead() {
    const unreadIds = notifications.filter((n) => !n.read_at).map((n) => n.id);
    if (unreadIds.length === 0) return;
    const supabase = createClient();
    await supabase.from("notifications").update({ read_at: new Date().toISOString() }).in("id", unreadIds);
    setNotifications((prev) => prev.map((n) => ({ ...n, read_at: n.read_at ?? new Date().toISOString() })));
  }

  const unreadCount = notifications.filter((n) => !n.read_at).length;

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => {
          setOpen((v) => !v);
          if (!open) markAllRead();
        }}
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ""}`}
        className="relative rounded-lg p-2 text-gray-600 hover:bg-brand-50 hover:text-brand-700"
      >
        <span aria-hidden>🔔</span>
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-40 mt-2 w-80 rounded-xl border border-brand-100 bg-white p-2 shadow-lg">
          <p className="px-2 py-1 text-xs font-semibold uppercase tracking-wide text-gray-500">
            Notifications
          </p>
          {loading ? (
            <p className="px-2 py-3 text-sm text-gray-500">Loading…</p>
          ) : notifications.length === 0 ? (
            <p className="px-2 py-3 text-sm text-gray-500">No notifications yet.</p>
          ) : (
            <ul className="max-h-80 space-y-1 overflow-y-auto">
              {notifications.map((n) => {
                const href = linkFor(n);
                const content = (
                  <div className="rounded-lg px-2 py-2 text-sm hover:bg-brand-50">
                    <p className={n.read_at ? "text-gray-600" : "font-medium text-gray-900"}>
                      {messageFor(n)}
                    </p>
                    <p className="text-xs text-gray-400">{new Date(n.created_at).toLocaleString()}</p>
                  </div>
                );
                return (
                  <li key={n.id}>
                    {href ? <Link href={href}>{content}</Link> : content}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
