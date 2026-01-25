// app/account/hooks/useMcqBankData.ts
"use client";

import { useEffect, useState } from "react";
import type { Course, Lesson, Llo, McqItem } from "../types";

export function useMcqBankData(supabase: any, profileId: string) {
  const [loading, setLoading] = useState(true);
  const [courses, setCourses] = useState<Course[]>([]);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [llos, setLlos] = useState<Llo[]>([]);
  const [mcqs, setMcqs] = useState<McqItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;

    async function loadData() {
      setLoading(true);
      setError(null);

      try {
        const { data: courseRows, error: courseErr } = await supabase
          .from("courses")
          .select("id, title, code")
          .order("title", { ascending: true });
        if (courseErr) throw courseErr;

        const { data: lessonRows, error: lessonErr } = await supabase
          .from("lessons")
          .select("id, course_id, title")
          .eq("owner_id", profileId)
          .order("order_in_course", { ascending: true });
        if (lessonErr) throw lessonErr;

        const { data: lloRows, error: lloErr } = await supabase
          .from("llos")
          .select("id, course_id, lesson_id, code, text, bloom_suggested")
          .eq("owner_id", profileId)
          .order("code", { ascending: true });
        if (lloErr) throw lloErr;

        const { data: mcqRows, error: mcqErr } = await supabase
          .from("mcq_items")
          .select("id, stem, course_id, llo_ids, status, created_at")
          .eq("owner_id", profileId)
          .order("created_at", { ascending: false });
        if (mcqErr) throw mcqErr;

        if (!alive) return;

        setCourses((courseRows || []) as Course[]);
        setLessons((lessonRows || []) as Lesson[]);
        setLlos((lloRows || []) as Llo[]);
        setMcqs((mcqRows || []) as McqItem[]);
      } catch (e: any) {
        console.error(e);
        if (!alive) return;
        setError(e?.message ?? "Không tải được dữ liệu ngân hàng MCQ.");
      } finally {
        if (alive) setLoading(false);
      }
    }

    if (profileId) loadData();

    return () => {
      alive = false;
    };
  }, [supabase, profileId]);

  return { loading, error, courses, lessons, llos, mcqs, setMcqs };
}
