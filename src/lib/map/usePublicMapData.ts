"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/types/database";

export type PublicMapCat = Database["public"]["Views"]["cats_map_public"]["Row"];

export type MapDataState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; cats: PublicMapCat[] };

/**
 * Loads cat pins from the `cats_map_public` view only. This view NEVER
 * exposes precise coordinates — see supabase/migrations/0006_report_flow.sql.
 */
export function usePublicMapData(): MapDataState {
  const [state, setState] = useState<MapDataState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const supabase = createClient();
        const { data, error } = await supabase
          .from("cats_map_public")
          .select("*")
          .order("last_sighting_at", { ascending: false });

        if (cancelled) return;

        if (error) {
          setState({ status: "error", message: error.message });
          return;
        }
        setState({ status: "ready", cats: data ?? [] });
      } catch (err) {
        if (cancelled) return;
        setState({
          status: "error",
          message: err instanceof Error ? err.message : "Failed to load map data.",
        });
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
