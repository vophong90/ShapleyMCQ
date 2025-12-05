"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, Cpu, Brain, GitBranch, ListChecks, BarChart3 } from "lucide-react";

export default function HomePage() {
  const [open, setOpen] = useState<number | null>(null);

  const steps = [
    {
      id: 1,
      title: "Learning Context",
      icons: [Cpu, ListChecks, Brain],
      desc: [
        "Define specialty, level, course & lesson alignment",
        "Extract LLOs and Bloom levels",
        "Ensure pedagogical consistency"
      ]
    },
    {
      id: 2,
      title: "Assessment Units",
      icons: [Brain, Cpu, GitBranch],
      desc: [
        "AI-assisted AU extraction from documents",
        "Clustering conceptual cores",
        "Mapping AU → measurable skills"
      ]
    },
    {
      id: 3,
      title: "Misconceptions",
      icons: [Brain, GitBranch, Cpu],
      desc: [
        "Generate cognitive conflict patterns",
        "Validate reasoning errors",
        "Map misconceptions → distractor logic"
      ]
    },
    {
      id: 4,
      title: "MCQ Generation",
      icons: [ListChecks, Cpu, Brain],
      desc: [
        "Create USMLE-style stems",
        "Generate distractors from misconceptions",
        "Bloom-level verification"
      ]
    },
    {
      id: 5,
      title: "Simulation & Shapley Analysis",
      icons: [BarChart3, Cpu, GitBranch],
      desc: [
        "Monte Carlo learner simulation",
        "Distractor behavior modeling",
        "Shapley-based contribution scoring"
      ]
    }
  ];

  return (
    <div className="max-w-4xl mx-auto py-20 px-6">
      
      {/* HERO */}
      <div className="mb-16">
        <h1 className="text-4xl font-semibold text-slate-900 mb-3">
          ShapleyMCQ Lab
        </h1>
        <p className="text-slate-600 text-[15px] mb-6 max-w-xl">
          Transform learning objectives into validated MCQs through an 
          explainable AI pipeline designed for medical education.
        </p>

        <button className="px-4 py-2 bg-black text-white rounded-lg text-sm hover:bg-slate-800">
          Start Pipeline →
        </button>
      </div>

      {/* PIPELINE */}
      <div className="space-y-4">
        {steps.map((s) => (
          <div key={s.id} className="border border-slate-200 rounded-xl">
            
            {/* STEP HEADER */}
            <button
              onClick={() => setOpen(open === s.id ? null : s.id)}
              className="flex justify-between w-full px-5 py-4 text-left hover:bg-slate-50"
            >
              <span className="font-medium text-slate-800">
                {s.id}. {s.title}
              </span>
              {open === s.id ? (
                <ChevronDown className="w-5 h-5 text-slate-600" />
              ) : (
                <ChevronRight className="w-5 h-5 text-slate-600" />
              )}
            </button>

            {/* STEP CONTENT */}
            {open === s.id && (
              <div className="px-5 pb-5 animate-fadeIn">
                
                {/* ICON ROW */}
                <div className="flex gap-3 mb-4">
                  {s.icons.map((Icon, i) => (
                    <Icon key={i} className="w-5 h-5 text-slate-600" />
                  ))}
                </div>

                {/* DESCRIPTION */}
                <ul className="space-y-1 text-sm text-slate-600 mb-4">
                  {s.desc.map((d, i) => (
                    <li key={i}>• {d}</li>
                  ))}
                </ul>

                {/* MINI MOCKUP */}
                <div className="border border-slate-200 rounded-lg p-4 bg-white">
                  <div className="h-2 bg-slate-200 w-32 rounded mb-2"></div>
                  <div className="h-2 bg-slate-100 w-48 rounded mb-2"></div>
                  <div className="h-2 bg-slate-100 w-24 rounded"></div>
                </div>

              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
