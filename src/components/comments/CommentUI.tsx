"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { addComment } from "@/actions/comments";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui";

export function CommentForm({ catId }: { catId: string }) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!body.trim()) {
      setError("Comment cannot be empty.");
      return;
    }
    setLoading(true);
    const result = await addComment({ catId, body: body.trim() });
    setLoading(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setBody("");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-2">
      <Textarea
        rows={2}
        maxLength={2000}
        placeholder="Share an update or ask a question…"
        value={body}
        onChange={(e) => setBody(e.target.value)}
        aria-label="Add a comment"
      />
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      <Button type="submit" variant="secondary" disabled={loading}>
        {loading ? "Posting…" : "Post comment"}
      </Button>
    </form>
  );
}

export type CommentItem = {
  id: string;
  body: string;
  created_at: string;
  author_id: string | null;
  authorName: string | null;
};

export function CommentList({ comments }: { comments: CommentItem[] }) {
  if (comments.length === 0) {
    return <p className="text-sm text-gray-500">No comments yet.</p>;
  }
  return (
    <ul className="space-y-3">
      {comments.map((c) => (
        <li key={c.id} className="rounded-lg border border-brand-100 bg-white p-3">
          {/* Rendered as plain text — React escapes this by default; never
              dangerouslySetInnerHTML. */}
          <p className="whitespace-pre-wrap text-sm text-gray-800">{c.body}</p>
          <p className="mt-1 text-xs text-gray-400">
            {c.authorName ?? "A PawPin user"} · {new Date(c.created_at).toLocaleString()}
          </p>
        </li>
      ))}
    </ul>
  );
}
