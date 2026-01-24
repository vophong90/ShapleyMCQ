// app/wizard/context/types.ts

export type Specialty = {
  id: string;
  code: string | null;
  name: string;
};

export type Course = {
  id: string;
  code: string | null;
  title: string;
};

export type Lesson = {
  id: string;
  title: string;
  course_id: string;
};

// Giữ llos_text để đọc lại localStorage cũ, nhưng UI sẽ dùng lloList
export type ContextState = {
  specialty_id: string;
  learner_level: string;
  bloom_level: string;
  course_id?: string;
  lesson_id?: string;
  llos_text?: string;
};

export type LloLine = {
  id?: string;
  text: string;
  bloom_suggested?: string | null;
};

export const LEARNER_LEVELS = [
  { value: "undergrad", label: "Sinh viên (Đại học)" },
  { value: "postgrad", label: "Học viên sau đại học" },
  { value: "phd", label: "Nghiên cứu sinh" },
] as const;

export const BLOOM_LEVELS = [
  { value: "remember", label: "Remember – Nhớ" },
  { value: "understand", label: "Understand – Hiểu" },
  { value: "apply", label: "Apply – Vận dụng" },
  { value: "analyze", label: "Analyze – Phân tích" },
  { value: "evaluate", label: "Evaluate – Đánh giá" },
  { value: "create", label: "Create – Sáng tạo" },
] as const;

export type LloEvalItem = {
  llo: string;
  inferred_bloom: string;
  bloom_match: "good" | "too_low" | "too_high" | string;
  level_fit: "good" | "too_easy" | "too_hard" | string;
  comments: string;
};

export type LloEvalResult = {
  overall_comment: string;
  items: LloEvalItem[];
};

// Row của VIEW v_llos_with_stats
export type ExistingLloRow = {
  llo_id: string;
  text: string;
  bloom_suggested: string | null;
  level_suggested: string | null;
  au_count: number;
  mis_count: number;
  mcq_count: number;
};
