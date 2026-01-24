// app/wizard/simulate/types.ts

export type Course = {
  id: string;
  title: string;
  code: string | null;
};

export type Lesson = {
  id: string;
  title: string;
};

export type LLO = {
  id: string;
  text: string;
};

export type AU = {
  id: string;
  core_statement: string;
};

export type MCQListItem = {
  id: string;
  stem: string;
  au_id: string | null;
};

export type SimOption = {
  label: string; // A, B, C, D...
  text: string;
  is_correct: boolean;
};

export type PersonaProb = {
  name: string;
  probs: Record<string, number>;
};

export type AccuracyRow = {
  persona: string;
  accuracy: number;
  total: number;
};

export type ResponseRow = {
  persona: string;
  chosen_option: string;
  chosen_text: string;
  is_correct: boolean;
};

export type SimResult = {
  options: SimOption[];
  personas: PersonaProb[];
  N_per_persona: number;
  accuracy_summary: AccuracyRow[];
  response_matrix: ResponseRow[];
};

export type ShapleyRow = {
  label: string;
  text: string;
  shapley: number; // 0–1
  share_pct: number;
  wrong_pct: number;
  novice_pct: number;
  recommendation: string;
};

export type PersonaWeight = {
  name: string;
  weight: number; // percent
};

export type MCQCardState = {
  id: string;
  stem: string;
  correct_answer: string;
  explanation: string;
  distractors: string[];
  simN: number;
  simLoading: boolean;
  simResult: SimResult | null;
  shapleyRows: ShapleyRow[] | null;
  saving: boolean;
  refineIndex: number | null;
};
