// app/account/hooks/useProfile.ts
"use client";

import { useEffect, useState } from "react";
import type { Profile } from "../types";

export function useProfile(supabase: any) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);

  useEffect(() => {
    let alive = true;

    async function loadProfile() {
      setLoadingProfile(true);

      const { data, error } = await supabase.auth.getUser();
      if (!alive) return;

      const user = data?.user;
      if (error || !user) {
        setProfile(null);
        setLoadingProfile(false);
        return;
      }

      const { data: p, error: pErr } = await supabase
        .from("profiles")
        .select("id, email, name")
        .eq("id", user.id)
        .single();

      if (!alive) return;

      if (pErr || !p) setProfile(null);
      else setProfile(p as Profile);

      setLoadingProfile(false);
    }

    loadProfile();

    return () => {
      alive = false;
    };
  }, [supabase]);

  return { profile, loadingProfile };
}
