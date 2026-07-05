"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { followCat, unfollowCat, bookmarkCat, unbookmarkCat } from "@/actions/follows";
import { Button } from "@/components/ui/Button";

export function FollowBookmarkButtons({
  catId,
  initiallyFollowing,
  initiallyBookmarked,
}: {
  catId: string;
  initiallyFollowing: boolean;
  initiallyBookmarked: boolean;
}) {
  const router = useRouter();
  const [following, setFollowing] = useState(initiallyFollowing);
  const [bookmarked, setBookmarked] = useState(initiallyBookmarked);
  const [loading, setLoading] = useState<"follow" | "bookmark" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleFollowToggle() {
    setLoading("follow");
    setError(null);
    const result = following ? await unfollowCat({ catId }) : await followCat({ catId });
    setLoading(null);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setFollowing(!following);
    router.refresh();
  }

  async function handleBookmarkToggle() {
    setLoading("bookmark");
    setError(null);
    const result = bookmarked ? await unbookmarkCat({ catId }) : await bookmarkCat({ catId });
    setLoading(null);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setBookmarked(!bookmarked);
    router.refresh();
  }

  return (
    <div className="space-y-1">
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant={following ? "primary" : "secondary"}
          onClick={handleFollowToggle}
          disabled={loading === "follow"}
        >
          {following ? "✓ Following" : "Follow this cat"}
        </Button>
        <Button
          type="button"
          variant={bookmarked ? "primary" : "secondary"}
          onClick={handleBookmarkToggle}
          disabled={loading === "bookmark"}
        >
          {bookmarked ? "★ Bookmarked" : "☆ Bookmark"}
        </Button>
      </div>
      {error && <p role="alert" className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
