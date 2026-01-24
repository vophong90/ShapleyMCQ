// app/wizard/mcq/types.ts

export type Course = {
  id: string;
  code?: string | null;
  title?: string | null;
};

export type Lesson = {
  id: string;
  title: string | null;
};

export type LLO = {
  id: string;
  code?: string | null;
  text: string | null;
};

export type AU = {
  id: string;
  text: string;
  llo_id: string | null;
};

export type Miscon = {
  description: string;
  error_type: string;
};

export type MCQ = {
  stem: string;
  correct_answer: string;
  distractors: string[];
  explanation: string;
};

export type NbmeResult = {
  hard_rules: {
    passed: boolean;
    flags: string[];
  };
  rubric: {
    overall_score: number;
    summary: string;
    dimensions: {
      [key: string]: {
        score: number;
        comment: string;
      };
    };
    suggestions: string;
    [key: string]: any;
  };
};

export type EduFitResult = {
  inferred_bloom: string;
  bloom_match: string;
  level_fit: string;
  summary: string;
  llo_coverage: {
    llo: string;
    coverage: string;
    comment: string;
  }[];
  recommendations: string[];
};

export type ExistingMcqSummary = {
  id: string;
  stem: string;
  created_at: string | null;
};
