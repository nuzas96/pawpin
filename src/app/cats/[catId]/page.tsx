import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/auth/guards";
import { getCatPhotoPublicUrl } from "@/lib/storage/catPhotos";
import { publicAreaLabel } from "@/lib/geo/location";
import { getCatTimeline } from "@/lib/cases/timeline";
import { hasAtLeast } from "@/lib/auth/roles";
import { Badge, Card } from "@/components/ui";
import { ClaimCaseButton } from "@/components/cases/ClaimCaseButton";
import { CaseUpdateForm } from "@/components/cases/CaseUpdateForm";
import { FeedingScheduleForm, FeedingLogForm } from "@/components/feeding/FeedingForms";
import { TnrForm } from "@/components/tnr/TnrForm";
import { AdoptionForm } from "@/components/adoption/AdoptionForm";
import { CommentForm, CommentList, type CommentItem } from "@/components/comments/CommentUI";
import { FollowBookmarkButtons } from "@/components/cat/FollowBookmarkButtons";
import { FlagButton } from "@/components/moderation/FlagButton";
import { CaseGovernanceActions } from "@/components/cases/CaseGovernanceActions";

export const metadata = { title: "Cat Profile — PawPin" };

function toLabel(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1).replace(/_/g, " ");
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

export default async function CatProfilePage({ params }: { params: { catId: string } }) {
  const supabase = createClient();
  const sessionUser = await getSessionUser();

  const { data: cat } = await supabase
    .from("cats")
    .select("*")
    .eq("id", params.catId)
    .maybeSingle();

  if (!cat) notFound();

  const { data: photo } = cat.primary_photo_id
    ? await supabase.from("photos").select("storage_path").eq("id", cat.primary_photo_id).maybeSingle()
    : { data: null };
  const photoUrl = photo ? getCatPhotoPublicUrl(supabase, photo.storage_path) : null;

  const { data: sightings } = await supabase
    .from("sighting_geo_public")
    .select("*")
    .eq("cat_id", cat.id)
    .order("created_at", { ascending: false });

  const { data: sightingPhotoRows } = await supabase
    .from("sightings")
    .select("id, photo_id")
    .eq("cat_id", cat.id)
    .not("photo_id", "is", null);
  const linkedPhotoIds = [...new Set((sightingPhotoRows ?? []).map((s) => s.photo_id).filter(Boolean))] as string[];
  const { data: linkedPhotoRows } =
    linkedPhotoIds.length > 0
      ? await supabase.from("photos").select("id, storage_path").in("id", linkedPhotoIds)
      : { data: [] };
  const linkedPhotoUrls = (linkedPhotoRows ?? []).map((p) => getCatPhotoPublicUrl(supabase, p.storage_path));

  // Most recent case (the active coordination unit for this cat).
  const { data: currentCase } = await supabase
    .from("cases")
    .select("id, status, priority, claimed_by, org_id, opened_at, closed_at")
    .eq("cat_id", cat.id)
    .order("opened_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let claimedByName: string | null = null;
  if (currentCase?.claimed_by) {
    const { data: claimedProfile } = await supabase
      .from("profiles")
      .select("display_name")
      .eq("id", currentCase.claimed_by)
      .maybeSingle();
    claimedByName = claimedProfile?.display_name ?? null;
  }

  const { data: feedingSchedules } = await supabase
    .from("feeding_schedules")
    .select("*")
    .eq("case_id", currentCase?.id ?? "00000000-0000-0000-0000-000000000000")
    .order("created_at", { ascending: false });

  const { data: feedingLogs } = currentCase
    ? await supabase
        .from("feeding_logs")
        .select("*")
        .eq("case_id", currentCase.id)
        .order("fed_at", { ascending: false })
        .limit(10)
    : { data: [] };

  const { data: tnrRecord } = currentCase
    ? await supabase.from("tnr_records").select("*").eq("case_id", currentCase.id).maybeSingle()
    : { data: null };

  // Adoption record: only fetched (with adopter_contact) for authorised
  // carers — RLS already enforces this, but we also avoid requesting it for
  // guests/public to keep the query intent explicit.
  const { data: adoptionRecord } = sessionUser
    ? await supabase.from("adoptions").select("id, status").eq("cat_id", cat.id).maybeSingle()
    : { data: null };

  const isAdmin = sessionUser?.role === "admin";

  const commentsQuery = supabase
    .from("comments")
    .select("id, body, created_at, author_id, is_hidden")
    .eq("cat_id", cat.id)
    .order("created_at", { ascending: false });
  const { data: rawComments } = isAdmin ? await commentsQuery : await commentsQuery.eq("is_hidden", false);

  const authorIds = [...new Set((rawComments ?? []).map((c) => c.author_id).filter(Boolean))] as string[];
  const { data: authorProfiles } =
    authorIds.length > 0
      ? await supabase.from("profiles").select("id, display_name").in("id", authorIds)
      : { data: [] };
  const nameByAuthor = new Map((authorProfiles ?? []).map((p) => [p.id, p.display_name]));
  const comments: CommentItem[] = (rawComments ?? []).map((c) => ({
    id: c.id,
    body: c.body,
    created_at: c.created_at,
    author_id: c.author_id,
    authorName: c.author_id ? nameByAuthor.get(c.author_id) ?? null : null,
    is_hidden: c.is_hidden,
  }));

  let isFollowing = false;
  let isBookmarked = false;
  if (sessionUser) {
    const [{ data: followRow }, { data: bookmarkRow }] = await Promise.all([
      supabase.from("follows").select("user_id").eq("user_id", sessionUser.id).eq("cat_id", cat.id).maybeSingle(),
      supabase.from("bookmarks").select("user_id").eq("user_id", sessionUser.id).eq("cat_id", cat.id).maybeSingle(),
    ]);
    isFollowing = Boolean(followRow);
    isBookmarked = Boolean(bookmarkRow);
  }

  const timeline = await getCatTimeline(supabase, cat.id);

  const latestUrgency = sightings?.[0]?.urgency ?? "medium";
  const canClaim = Boolean(sessionUser && hasAtLeast(sessionUser.role, "volunteer"));
  const alreadyClaimedByMe = Boolean(sessionUser && currentCase?.claimed_by === sessionUser.id);
  // "Authorised carer" for showing management forms: claimed volunteer, org
  // member of the case's org, or admin. Server-side approximation mirroring
  // has_case_access(); actual writes are still enforced by the RPCs.
  const isAuthorisedCarer = Boolean(
    sessionUser &&
      (sessionUser.role === "admin" ||
        (currentCase?.claimed_by && currentCase.claimed_by === sessionUser.id) ||
        (sessionUser.role === "org" && currentCase?.org_id))
  );

  return (
    <div className="space-y-6">
      <div className="grid gap-6 md:grid-cols-[280px_1fr]">
        {photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={photoUrl}
            alt={`Photo of a ${toLabel(cat.coat_color)} ${toLabel(cat.fur_pattern)} cat`}
            className="h-64 w-full rounded-xl border border-brand-100 object-cover md:h-full"
          />
        ) : (
          <div className="flex h-64 w-full items-center justify-center rounded-xl border border-brand-100 bg-brand-50 text-4xl md:h-full">
            🐱
          </div>
        )}

        <div className="space-y-3">
          <h1 className="text-2xl font-bold text-brand-800">
            {toLabel(cat.coat_color)} {toLabel(cat.fur_pattern)} Cat
          </h1>
          <div className="flex flex-wrap gap-2">
            <Badge>{toLabel(cat.status)}</Badge>
            <Badge>{toLabel(latestUrgency)} urgency</Badge>
            <Badge>{toLabel(cat.size_class)}</Badge>
            <Badge>{toLabel(cat.age_group)}</Badge>
            {cat.ear_tipped && <Badge>Ear-tipped</Badge>}
            {adoptionRecord && adoptionRecord.status !== "not_available" && (
              <Badge>Adoption: {toLabel(adoptionRecord.status)}</Badge>
            )}
          </div>
          {cat.distinguishing_marks.length > 0 && (
            <p className="text-sm text-gray-600">
              <span className="font-medium">Marks:</span> {cat.distinguishing_marks.join(", ")}
            </p>
          )}
          {sightings && sightings.length > 0 && (
            <p className="text-sm text-gray-600">
              <span className="font-medium">Public area:</span>{" "}
              {publicAreaLabel(sightings[0].fuzzed_lat, sightings[0].fuzzed_lng)}
            </p>
          )}

          <div className="flex flex-wrap gap-4 rounded-lg bg-brand-50 p-3 text-sm text-brand-800">
            <span>👁️ Seen <strong>{sightings?.length ?? 0}</strong> time{(sightings?.length ?? 0) === 1 ? "" : "s"}</span>
            <span>🗓️ First seen <strong>{formatDate(cat.first_seen_at)}</strong></span>
            <span>🕓 Last seen <strong>{formatDate(cat.last_seen_at)}</strong></span>
          </div>

          <p className="rounded-lg bg-brand-50 p-3 text-xs text-brand-700">
            🔒 Only an approximate area is shown publicly. Precise location is
            visible only to signed-in volunteers or rescues authorised on this case.
          </p>

          <p className="text-xs text-gray-500">
            This is a <strong>persistent cat profile</strong>: every confirmed
            sighting of this cat is linked here instead of creating a separate
            report, so carers can see the cat&apos;s full history in one place.
          </p>

          {sessionUser && (
            <FollowBookmarkButtons
              catId={cat.id}
              initiallyFollowing={isFollowing}
              initiallyBookmarked={isBookmarked}
            />
          )}
          {sessionUser && !isAdmin && (
            <FlagButton targetType="cat" targetId={cat.id} label="Report this profile" />
          )}
        </div>
      </div>

      {/* Case ownership & claim */}
      <Card>
        <h2 className="mb-2 font-semibold text-brand-800">Case coordination</h2>
        {currentCase ? (
          <div className="space-y-2 text-sm text-gray-700">
            <p>
              Status: <Badge>{toLabel(currentCase.status)}</Badge>{" "}
              Priority: <Badge>{toLabel(currentCase.priority)}</Badge>
            </p>
            <p>
              Handled by:{" "}
              <span className="font-medium">
                {claimedByName ?? (currentCase.claimed_by ? "A volunteer" : "Unclaimed — no one yet")}
              </span>
            </p>
            {sessionUser ? (
              <ClaimCaseButton
                caseId={currentCase.id}
                eligible={canClaim}
                alreadyClaimedByMe={alreadyClaimedByMe}
              />
            ) : (
              <p className="text-xs text-gray-500">Sign in as a volunteer to claim this case.</p>
            )}
            {isAuthorisedCarer && (
              <div className="border-t border-brand-100 pt-3">
                <CaseGovernanceActions
                  caseId={currentCase.id}
                  status={currentCase.status}
                  isClaimedByMe={alreadyClaimedByMe}
                  canReassign={Boolean(
                    sessionUser &&
                      (sessionUser.role === "admin" ||
                        (sessionUser.role === "org" && currentCase.org_id))
                  )}
                />
              </div>
            )}
          </div>
        ) : (
          <p className="text-sm text-gray-600">No case has been opened for this cat yet.</p>
        )}
      </Card>

      {/* Case update form (authorised carers only) */}
      {currentCase && isAuthorisedCarer && (
        <Card>
          <h2 className="mb-3 font-semibold text-brand-800">Post a case update</h2>
          <CaseUpdateForm caseId={currentCase.id} />
        </Card>
      )}

      {/* Feeding */}
      <section>
        <h2 className="mb-3 text-xl font-bold text-brand-800">Feeding</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <h3 className="mb-2 font-medium text-gray-900">Active schedule</h3>
            {feedingSchedules && feedingSchedules.length > 0 ? (
              <ul className="space-y-2 text-sm text-gray-700">
                {feedingSchedules.filter((s) => s.active).map((s) => (
                  <li key={s.id}>
                    <span className="font-medium">{toLabel(s.frequency)}:</span> {s.schedule_text}
                    {s.location_note && <span className="text-gray-500"> — {s.location_note}</span>}
                  </li>
                ))}
                {feedingSchedules.every((s) => !s.active) && <li className="text-gray-500">No active schedule.</li>}
              </ul>
            ) : (
              <p className="text-sm text-gray-500">No feeding schedule yet.</p>
            )}
            {currentCase && isAuthorisedCarer && (
              <div className="mt-4 space-y-4 border-t border-brand-100 pt-4">
                <FeedingScheduleForm caseId={currentCase.id} />
                <FeedingLogForm caseId={currentCase.id} scheduleId={feedingSchedules?.[0]?.id} />
              </div>
            )}
          </Card>
          <Card>
            <h3 className="mb-2 font-medium text-gray-900">Recent feeding history</h3>
            {feedingLogs && feedingLogs.length > 0 ? (
              <ul className="space-y-2 text-sm text-gray-700">
                {feedingLogs.map((log) => (
                  <li key={log.id}>
                    {new Date(log.fed_at).toLocaleString()}
                    {log.food_type && <span> — {log.food_type}</span>}
                    {log.notes && <span className="text-gray-500"> ({log.notes})</span>}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-gray-500">No feeding logs yet.</p>
            )}
          </Card>
        </div>
      </section>

      {/* TNR */}
      <section>
        <h2 className="mb-3 text-xl font-bold text-brand-800">TNR (Trap-Neuter-Return)</h2>
        <Card>
          {tnrRecord ? (
            <div className="mb-3 space-y-1 text-sm text-gray-700">
              <p><span className="font-medium">Status:</span> {toLabel(tnrRecord.tnr_status)}</p>
              {tnrRecord.clinic && <p><span className="font-medium">Clinic:</span> {tnrRecord.clinic}</p>}
              {tnrRecord.notes && <p><span className="font-medium">Notes:</span> {tnrRecord.notes}</p>}
            </div>
          ) : (
            <p className="mb-3 text-sm text-gray-500">No TNR record yet.</p>
          )}
          {currentCase && isAuthorisedCarer && (
            <TnrForm caseId={currentCase.id} currentStatus={tnrRecord?.tnr_status} />
          )}
        </Card>
      </section>

      {/* Adoption */}
      <section>
        <h2 className="mb-3 text-xl font-bold text-brand-800">Adoption</h2>
        <Card>
          <p className="mb-3 text-sm text-gray-700">
            <span className="font-medium">Status:</span>{" "}
            {toLabel(adoptionRecord?.status ?? "not_available")}
          </p>
          {isAuthorisedCarer && (
            <AdoptionForm catId={cat.id} currentStatus={adoptionRecord?.status} />
          )}
        </Card>
      </section>

      {linkedPhotoUrls.length > 0 && (
        <section>
          <h2 className="mb-3 text-xl font-bold text-brand-800">Photos from sightings</h2>
          <div className="flex gap-3 overflow-x-auto pb-1">
            {linkedPhotoUrls.map((url) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={url}
                src={url}
                alt="Photo submitted with a sighting of this cat"
                className="h-24 w-24 flex-shrink-0 rounded-lg border border-brand-100 object-cover"
              />
            ))}
          </div>
        </section>
      )}

      {/* Combined timeline */}
      <section>
        <h2 className="mb-3 text-xl font-bold text-brand-800">Timeline</h2>
        {timeline.length === 0 ? (
          <Card><p className="text-sm text-gray-600">No activity recorded yet.</p></Card>
        ) : (
          <ol className="space-y-2 border-l border-brand-100 pl-4">
            {timeline.map((entry) => (
              <li key={entry.id} className="relative">
                <span className="absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full bg-brand-400" />
                <p className="text-sm font-medium text-gray-900">{entry.title}</p>
                <p className="text-xs text-gray-500">{new Date(entry.createdAt).toLocaleString()}</p>
                {entry.detail && <p className="text-sm text-gray-600">{entry.detail}</p>}
              </li>
            ))}
          </ol>
        )}
      </section>

      {/* Comments */}
      <section>
        <h2 className="mb-3 text-xl font-bold text-brand-800">Comments</h2>
        <div className="space-y-4">
          {sessionUser ? (
            <CommentForm catId={cat.id} />
          ) : (
            <p className="text-sm text-gray-500">
              <a href="/auth/sign-in" className="font-medium text-brand-600 hover:underline">Sign in</a> to comment.
            </p>
          )}
          <CommentList comments={comments} isAdmin={isAdmin} />
        </div>
      </section>
    </div>
  );
}
