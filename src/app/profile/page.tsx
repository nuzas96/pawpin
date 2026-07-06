import { requireUser } from "@/lib/auth/guards";
import { ROLE_LABELS } from "@/lib/auth/roles";
import { Card, Badge } from "@/components/ui";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Profile — PawPin" };

function toLabel(value: string | undefined | null) {
  if (!value) return "—";
  return value.charAt(0).toUpperCase() + value.slice(1).replace(/_/g, " ");
}

export default async function ProfilePage({
  searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  const user = await requireUser();
  const supabase = createClient();
  const tabParam = searchParams?.tab;
  const tab = typeof tabParam === "string" ? tabParam : "overview";

  const [
    { data: follows, count: followsCount },
    { data: bookmarks, count: bookmarksCount },
    { data: notifications, count: notificationsCount },
    { data: sightings, count: sightingsCount },
  ] = await Promise.all([
    supabase.from("follows").select("cat_id, created_at", { count: "exact" }).eq("user_id", user.id).order("created_at", { ascending: false }).limit(20),
    supabase.from("bookmarks").select("cat_id, created_at", { count: "exact" }).eq("user_id", user.id).order("created_at", { ascending: false }).limit(20),
    supabase.from("notifications").select("id, type, payload, created_at, read_at", { count: "exact" }).eq("user_id", user.id).order("created_at", { ascending: false }).limit(20),
    supabase.from("sightings").select("id, cat_id, urgency, created_at", { count: "exact" }).eq("reporter_id", user.id).order("created_at", { ascending: false }).limit(20)
  ]);

  const catIds = [...new Set([
    ...(follows ?? []).map((f) => f.cat_id),
    ...(bookmarks ?? []).map((b) => b.cat_id),
    ...(sightings ?? []).map((s) => s.cat_id).filter(Boolean)
  ])] as string[];

  const { data: cats } = catIds.length > 0
    ? await supabase.from("cats").select("id, status, coat_color, fur_pattern, last_seen_at").in("id", catIds)
    : { data: [] };

  const catsMap = new Map((cats ?? []).map((c) => [c.id, c]));

  const renderCat = (catId: string | null) => {
    if (!catId) return <span className="text-gray-400">Unassigned to a specific cat</span>;
    const cat = catsMap.get(catId);
    if (!cat) return <span className="text-gray-400">Cat data not available</span>;
    
    return (
      <div className="mt-1 flex flex-col">
        <Link href={`/cats/${catId}`} className="font-medium text-brand-700 hover:underline">
          {toLabel(cat.coat_color)} {toLabel(cat.fur_pattern)} Cat
        </Link>
        <span className="mt-1 flex items-center gap-2 text-xs text-gray-500">
          <Badge>{toLabel(cat.status)}</Badge>
          <span>Seen {new Date(cat.last_seen_at).toLocaleDateString()}</span>
        </span>
      </div>
    );
  };

  const tabs = [
    { id: "overview", label: "Overview" },
    { id: "followed", label: "Followed Cats" },
    { id: "bookmarked", label: "Bookmarked Cats" },
    { id: "reports", label: "My Reports" },
    { id: "notifications", label: "Notifications" },
  ];

  const renderNotificationsList = (items: typeof notifications) => (
    <>
      {items && items.length > 0 ? (
        <ul className="space-y-4">
          {items.map((n) => {
            let message = toLabel(n.type);
            if (n.payload && typeof n.payload === "object" && "message" in n.payload) {
              message = String((n.payload as any).message);
            }
            
            return (
              <li key={n.id} className={`flex flex-col border-b border-brand-50 pb-3 last:border-0 last:pb-0 ${!n.read_at ? "font-medium text-gray-900" : "text-gray-600"}`}>
                <span className="text-sm">{message}</span>
                <div className="mt-1 flex items-center justify-between">
                  <span className="text-xs text-gray-400">
                    {new Date(n.created_at).toLocaleString()}
                  </span>
                  {!n.read_at && <span className="rounded-full bg-brand-100 px-1.5 py-0.5 text-[10px] text-brand-700">New</span>}
                </div>
              </li>
            )
          })}
        </ul>
      ) : (
        <p className="mt-2 text-sm text-gray-500">No notifications yet.</p>
      )}
    </>
  );

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-brand-800">Your Profile</h1>

      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-6 overflow-x-auto scrollbar-hide" aria-label="Tabs">
          {tabs.map((t) => (
            <Link
              key={t.id}
              href={`/profile?tab=${t.id}`}
              className={`whitespace-nowrap border-b-2 px-1 py-4 text-sm font-medium ${
                tab === t.id
                  ? "border-brand-500 text-brand-600"
                  : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700"
              }`}
            >
              {t.label}
            </Link>
          ))}
        </nav>
      </div>

      {tab === "overview" && (
        <div className="space-y-6">
          <Card className="max-w-xl">
            <dl className="space-y-3 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-gray-500">Display name</dt>
                <dd className="font-medium text-gray-900">{user.displayName || "—"}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-gray-500">Email</dt>
                <dd className="font-medium text-gray-900">{user.email}</dd>
              </div>
              <div className="flex items-center justify-between gap-4">
                <dt className="text-gray-500">Role</dt>
                <dd><Badge>{ROLE_LABELS[user.role]}</Badge></dd>
              </div>
              {user.role !== "user" && (
                <div className="flex items-center justify-between gap-4">
                  <dt className="text-gray-500">Status</dt>
                  <dd>
                    {user.isApproved ? (
                      <Badge>Approved</Badge>
                    ) : (
                      <Badge>Pending Approval</Badge>
                    )}
                  </dd>
                </div>
              )}
            </dl>
          </Card>

          <div className="flex max-w-xl flex-wrap gap-4">
            <Card className="flex flex-1 min-w-[120px] flex-col items-center justify-center p-4">
              <span className="text-2xl font-bold text-brand-800">{followsCount || 0}</span>
              <span className="mt-1 text-center text-xs tracking-wide text-gray-500 uppercase">Followed</span>
            </Card>
            <Card className="flex flex-1 min-w-[120px] flex-col items-center justify-center p-4">
              <span className="text-2xl font-bold text-brand-800">{bookmarksCount || 0}</span>
              <span className="mt-1 text-center text-xs tracking-wide text-gray-500 uppercase">Bookmarked</span>
            </Card>
            <Card className="flex flex-1 min-w-[120px] flex-col items-center justify-center p-4">
              <span className="text-2xl font-bold text-brand-800">{sightingsCount || 0}</span>
              <span className="mt-1 text-center text-xs tracking-wide text-gray-500 uppercase">Reports</span>
            </Card>
            <Card className="flex flex-1 min-w-[120px] flex-col items-center justify-center p-4">
              <span className="text-2xl font-bold text-brand-800">{notificationsCount || 0}</span>
              <span className="mt-1 text-center text-xs tracking-wide text-gray-500 uppercase">Notifications</span>
            </Card>
          </div>

          <div className="grid max-w-5xl grid-cols-1 gap-6 lg:grid-cols-2">
            {/* Row 1, Col 1: Followed Cats */}
            <Card className="flex flex-col h-full">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-medium text-brand-800">My Followed Cats</h2>
                <Link href="/profile?tab=followed" className="text-xs font-medium text-brand-600 hover:underline">View all</Link>
              </div>
              {follows && follows.length > 0 ? (
                <>
                  <ul className="space-y-4">
                    {follows.slice(0, 3).map((f) => (
                      <li key={f.cat_id} className="border-b border-brand-50 pb-3 last:border-0 last:pb-0">
                        {renderCat(f.cat_id)}
                      </li>
                    ))}
                  </ul>
                </>
              ) : (
                <p className="mt-2 text-sm text-gray-500">You haven&apos;t followed any cats yet.</p>
              )}
            </Card>

            {/* Row 1, Col 2: Reported Sightings */}
            <Card className="flex flex-col h-full">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-medium text-brand-800">My Reports</h2>
                <Link href="/profile?tab=reports" className="text-xs font-medium text-brand-600 hover:underline">View all</Link>
              </div>
              {sightings && sightings.length > 0 ? (
                <>
                  <ul className="space-y-4">
                    {sightings.slice(0, 3).map((s) => (
                      <li key={s.id} className="border-b border-brand-50 pb-3 last:border-0 last:pb-0">
                        <div className="flex flex-col">
                          <span className="text-sm font-medium text-gray-900">
                            {toLabel(s.urgency)} Priority Sighting
                          </span>
                          <span className="mb-1 text-xs text-gray-500">
                            {new Date(s.created_at).toLocaleString()}
                          </span>
                          {renderCat(s.cat_id)}
                        </div>
                      </li>
                    ))}
                  </ul>
                </>
              ) : (
                <p className="mt-2 text-sm text-gray-500">You haven&apos;t reported any sightings yet.</p>
              )}
            </Card>

            {/* Row 2, Col 1: Bookmarked Cats */}
            <Card className="flex flex-col h-full">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-medium text-brand-800">My Bookmarked Cats</h2>
                <Link href="/profile?tab=bookmarked" className="text-xs font-medium text-brand-600 hover:underline">View all</Link>
              </div>
              {bookmarks && bookmarks.length > 0 ? (
                <>
                  <ul className="space-y-4">
                    {bookmarks.slice(0, 3).map((b) => (
                      <li key={b.cat_id} className="border-b border-brand-50 pb-3 last:border-0 last:pb-0">
                        {renderCat(b.cat_id)}
                      </li>
                    ))}
                  </ul>
                </>
              ) : (
                <p className="mt-2 text-sm text-gray-500">You haven&apos;t bookmarked any cats yet.</p>
              )}
            </Card>

            {/* Row 2, Col 2: Recent Notifications */}
            <Card className="flex flex-col h-full">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-medium text-brand-800">Recent Notifications</h2>
                <Link href="/profile?tab=notifications" className="text-xs font-medium text-brand-600 hover:underline">View all</Link>
              </div>
              {notifications && notifications.length > 0 ? (
                <ul className="space-y-4">
                  {notifications.slice(0, 5).map((n) => {
                    let message = toLabel(n.type);
                    if (n.payload && typeof n.payload === "object" && "message" in n.payload) {
                      message = String((n.payload as any).message);
                    }
                    
                    return (
                      <li key={n.id} className={`flex flex-col border-b border-brand-50 pb-3 last:border-0 last:pb-0 ${!n.read_at ? "font-medium text-gray-900" : "text-gray-600"}`}>
                        <span className="text-sm">{message}</span>
                        <div className="mt-1 flex items-center justify-between">
                          <span className="text-xs text-gray-400">
                            {new Date(n.created_at).toLocaleString()}
                          </span>
                          {!n.read_at && <span className="rounded-full bg-brand-100 px-1.5 py-0.5 text-[10px] text-brand-700">New</span>}
                        </div>
                      </li>
                    )
                  })}
                </ul>
              ) : (
                <p className="mt-2 text-sm text-gray-500">No new notifications.</p>
              )}
            </Card>
          </div>
        </div>
      )}

      {tab === "followed" && (
        <div className="max-w-3xl space-y-4">
          <h2 className="text-xl font-bold text-brand-800">Followed Cats</h2>
          <Card>
            {follows && follows.length > 0 ? (
              <>
                <p className="mb-4 text-xs text-gray-500">Showing latest {follows.length}</p>
                <ul className="space-y-4">
                  {follows.map((f) => (
                    <li key={f.cat_id} className="border-b border-brand-50 pb-3 last:border-0 last:pb-0">
                      {renderCat(f.cat_id)}
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <p className="text-sm text-gray-500">You haven&apos;t followed any cats yet.</p>
            )}
          </Card>
        </div>
      )}

      {tab === "bookmarked" && (
        <div className="max-w-3xl space-y-4">
          <h2 className="text-xl font-bold text-brand-800">Bookmarked Cats</h2>
          <Card>
            {bookmarks && bookmarks.length > 0 ? (
              <>
                <p className="mb-4 text-xs text-gray-500">Showing latest {bookmarks.length}</p>
                <ul className="space-y-4">
                  {bookmarks.map((b) => (
                    <li key={b.cat_id} className="border-b border-brand-50 pb-3 last:border-0 last:pb-0">
                      {renderCat(b.cat_id)}
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <p className="text-sm text-gray-500">You haven&apos;t bookmarked any cats yet.</p>
            )}
          </Card>
        </div>
      )}

      {tab === "reports" && (
        <div className="max-w-3xl space-y-4">
          <h2 className="text-xl font-bold text-brand-800">My Reports</h2>
          <Card>
            {sightings && sightings.length > 0 ? (
              <>
                <p className="mb-4 text-xs text-gray-500">Showing latest {sightings.length}</p>
                <ul className="space-y-4">
                  {sightings.map((s) => (
                    <li key={s.id} className="border-b border-brand-50 pb-3 last:border-0 last:pb-0">
                      <div className="flex flex-col">
                        <span className="text-sm font-medium text-gray-900">
                          {toLabel(s.urgency)} Priority Sighting
                        </span>
                        <span className="mb-1 text-xs text-gray-500">
                          {new Date(s.created_at).toLocaleString()}
                        </span>
                        {renderCat(s.cat_id)}
                      </div>
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <p className="text-sm text-gray-500">You haven&apos;t reported any sightings yet.</p>
            )}
          </Card>
        </div>
      )}

      {tab === "notifications" && (
        <div className="max-w-3xl space-y-4">
          <h2 className="text-xl font-bold text-brand-800">Notifications</h2>
          <Card>
            {notifications && notifications.length > 0 && <p className="mb-4 text-xs text-gray-500">Showing latest {notifications.length}</p>}
            {renderNotificationsList(notifications)}
          </Card>
        </div>
      )}

    </div>
  );
}
