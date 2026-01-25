// app/account/types.ts

export type Profile = {
  id: string;
  email: string | null;
  name: string | null;
};

export type Course = {
  id: string;
  title: string;
  code: string | null;
};

export type Lesson = {
  id: string;
  course_id: string;
  title: string;
};

export type Llo = {
  id: string;
  course_id: string;
  lesson_id: string | null;
  code: string | null;
  text: string;
  bloom_suggested: string | null;
};

export type McqItem = {
  id: string;
  stem: string;
  course_id: string | null;
  llo_ids: string[] | null;
  status: string | null;
  created_at: string;
};

export type McqOption = {
  id: string;
  item_id: string;
  label: string;
  text: string;
  is_correct: boolean;
  created_at?: string | null;
};

export type SearchProfile = {
  id: string;
  email: string | null;
  name: string | null;
};

export type ReceivedShare = {
  id: string;
  created_at: string;
  mcq_item_id: string;
  mcq_stem: string;
  from_user_name: string | null;
  from_user_email: string | null;
};

export type TabKey = "bank" | "share";
