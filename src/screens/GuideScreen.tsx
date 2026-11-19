import React from 'react';
import {
  BookOpen,
  Sliders,
  Keyboard,
  Award,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
} from 'lucide-react';

const GRADE_SCALE = [
  { grade: 'O', label: 'Outstanding', min: '90.0% – 100%', gp: '10.0', desc: 'Flawless conceptual mastery and technical execution' },
  { grade: 'A+', label: 'Excellent', min: '80.0% – 89.9%', gp: '9.0', desc: 'Comprehensive understanding with minor omissions' },
  { grade: 'A', label: 'Very Good', min: '70.0% – 79.9%', gp: '8.0', desc: 'Sound theoretical and practical grasp of curriculum' },
  { grade: 'B+', label: 'Good', min: '60.0% – 69.9%', gp: '7.0', desc: 'Above-average conceptual clarity across core topics' },
  { grade: 'B', label: 'Above Average', min: '55.0% – 59.9%', gp: '6.0', desc: 'Satisfactory mastery meeting benchmark criteria' },
  { grade: 'C', label: 'Average', min: '50.0% – 54.9%', gp: '5.0', desc: 'Basic competency; requires remedial reinforcement' },
  { grade: 'P', label: 'Pass (Minimum)', min: '40.0% – 49.9%', gp: '4.0', desc: 'Threshold passing level; critical gaps noted' },
  { grade: 'F', label: 'Fail / Reappear', min: '0.0% – 39.9%', gp: '0.0', desc: 'Below passing threshold; requires mandatory re-evaluation' },
];

const STRICTNESS_LEVELS = [
  {
    level: 1,
    title: 'Lenient',
    tolerance: '±1.5 pts tolerance',
    desc: 'High conceptual credit; minor pseudocode syntax errors forgiven.',
    idealFor: 'Practice tests, weekly quizzes, introductory coursework',
  },
  {
    level: 2,
    title: 'Mild',
    tolerance: '±1.0 pt tolerance',
    desc: 'Moderate partial credit; minor notation mistakes penalized softly.',
    idealFor: 'Mid-semester tests (MSTs), formative assessments',
  },
  {
    level: 3,
    title: 'Balanced',
    tolerance: '±0.5 pt tolerance',
    desc: 'Standard examination rigor. Partial credit given only when algorithmic steps and tight bounds are mathematically sound.',
    idealFor: 'University end-term exams, formal departmental assessments',
  },
  {
    level: 4,
    title: 'Rigorous',
    tolerance: '±0.25 pt tolerance',
    desc: 'Strict edge case verification and formal inductive proof requirements.',
    idealFor: 'Competitive selection exams, honors programs, scholarship benchmarks',
  },
  {
    level: 5,
    title: 'Exact',
    tolerance: '0 pt tolerance',
    desc: 'Zero-tolerance rubric. Solutions must match gold model keys verbatim.',
    idealFor: 'Objective technical certifications, blind validation audits',
  },
];

const KEYBOARD_SHORTCUTS = [
  { key: 'A', label: 'Approve Question', desc: 'Accept AI-recommended marks and advance to next item' },
  { key: 'F', label: 'Flag for Review', desc: 'Mark ambiguous handwriting or grading edge cases for second pass' },
  { key: 'R', label: 'Recheck Question', desc: 'Trigger fresh secondary model inference on the question region' },
  { key: '← / →', label: 'Navigate Questions', desc: 'Step backward or forward through booklet questions' },
  { key: '[', label: 'Toggle Sidebar', desc: 'Collapse or expand navigation sidebar for maximized booklet view' },
  { key: '?', label: 'Help Dialog', desc: 'Toggle keyboard shortcut cheat-sheet anytime' },
];

export const GuideScreen: React.FC = () => {
  return (
    <div className="w-full flex-1 overflow-y-auto bg-[#F6F7F5] dark:bg-[#111312] p-6 lg:p-8 space-y-8 select-text">
      {/* Top Header Card */}
      <div className="bg-white dark:bg-[#181B19] border border-[#E2E8E4] dark:border-[#2A2F2C] rounded-[20px] p-6 lg:p-8 shadow-none dark:shadow-none flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-2 max-w-2xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#E8F3EE] dark:bg-[#1A2B23] border border-[#0F5132]/20 dark:border-[#294236] text-[#0F5132] dark:text-[#7CC9A3] text-xs font-bold font-mono">
            <BookOpen className="w-3.5 h-3.5" />
            <span>INSTITUTIONAL EVALUATION MANUAL</span>
          </div>
          <h1 className="text-2xl lg:text-3xl font-bold tracking-tight text-[#111827] dark:text-[#ECEEED]">
            Evaluation Guide &amp; Strictness Specifications
          </h1>
          <p className="text-sm text-[#4B5563] dark:text-[#969E9A] leading-relaxed">
            Standard operating procedures for AI-assisted handwritten answer booklet evaluation, rubric criteria alignment, and UGC 10-point academic grading.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={() => {
              window.location.hash = '#/upload';
            }}
            className="px-4 py-2.5 rounded-xl bg-[#0F5132] hover:bg-[#0B3D26] dark:bg-[#1F6E4A] dark:hover:bg-[#27855A] text-white text-xs font-semibold shadow-none dark:shadow-none transition cursor-pointer flex items-center gap-2"
          >
            <span>Start Evaluating</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Grid: 10-Point Grade Scale & Strictness Matrix */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left: 10-Point UGC Grading Scale */}
        <div className="lg:col-span-7 bg-white dark:bg-[#181B19] border border-[#E2E8E4] dark:border-[#2A2F2C] rounded-[20px] p-6 shadow-none dark:shadow-none space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-[#E2E8E4] dark:border-[#2F3532]">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-[#E8F3EE] dark:bg-[#1A2B23] text-[#0F5132] dark:text-[#7CC9A3] flex items-center justify-center font-bold text-xs border border-transparent dark:border-[#294236]">
                <Award className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-[#111827] dark:text-[#ECEEED]">
                  10-Point Academic Grading System
                </h2>
                <p className="text-xs text-[#4B5563] dark:text-[#969E9A]">
                  Autonomous University &amp; UGC Standard Grade Thresholds
                </p>
              </div>
            </div>
            <span className="text-[11px] font-mono font-semibold px-2 py-0.5 rounded bg-[#F1F4F2] dark:bg-[#202422] text-[#4B5563] dark:text-[#969E9A] border border-[#E2E8E4] dark:border-[#2F3532]">
              UGC Standard
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-[#F1F4F2] dark:bg-[#202422] text-[#111827] dark:text-[#ECEEED] font-semibold">
                  <th className="py-2.5 px-3 rounded-l-lg border-y border-l border-[#E2E8E4] dark:border-[#2F3532]">Grade</th>
                  <th className="py-2.5 px-3 border-y border-[#E2E8E4] dark:border-[#2F3532]">Grade Point</th>
                  <th className="py-2.5 px-3 border-y border-[#E2E8E4] dark:border-[#2F3532]">Marks Range</th>
                  <th className="py-2.5 px-3 rounded-r-lg border-y border-r border-[#E2E8E4] dark:border-[#2F3532]">Competency Descriptor</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E2E8E4] dark:divide-[#2F3532]">
                {GRADE_SCALE.map((g) => (
                  <tr key={g.grade} className="hover:bg-[#F1F4F2]/50 dark:hover:bg-[#202422]/50 transition-colors">
                    <td className="py-3 px-3 font-mono font-bold text-[#111827] dark:text-[#ECEEED]">
                      <span className="inline-block px-2 py-0.5 rounded bg-[#E8F3EE] dark:bg-[#1A2B23] text-[#0F5132] dark:text-[#7CC9A3] border border-[#0F5132]/10 dark:border-[#294236]">
                        {g.grade}
                      </span>
                    </td>
                    <td className="py-3 px-3 font-mono text-[#111827] dark:text-[#ECEEED] font-semibold">{g.gp}</td>
                    <td className="py-3 px-3 font-mono text-[#4B5563] dark:text-[#969E9A]">{g.min}</td>
                    <td className="py-3 px-3 text-[#4B5563] dark:text-[#969E9A] leading-relaxed">
                      <span className="font-semibold text-[#111827] dark:text-[#ECEEED] mr-1">{g.label}:</span>
                      {g.desc}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right: 1–5 Strictness Matrix */}
        <div className="lg:col-span-5 bg-white dark:bg-[#181B19] border border-[#E2E8E4] dark:border-[#2A2F2C] rounded-[20px] p-6 shadow-none dark:shadow-none space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-[#E2E8E4] dark:border-[#2F3532]">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-[#E8F3EE] dark:bg-[#1A2B23] text-[#0F5132] dark:text-[#7CC9A3] flex items-center justify-center font-bold text-xs border border-transparent dark:border-[#294236]">
                <Sliders className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-[#111827] dark:text-[#ECEEED]">
                  Strictness Calibration Matrix
                </h2>
                <p className="text-xs text-[#4B5563] dark:text-[#969E9A]">
                  AI Rubric Tolerance Levels (1 to 5)
                </p>
              </div>
            </div>
            <span className="text-[11px] font-mono font-semibold px-2 py-0.5 rounded bg-[#F1F4F2] dark:bg-[#202422] text-[#4B5563] dark:text-[#969E9A] border border-[#E2E8E4] dark:border-[#2F3532]">
              5 Tiers
            </span>
          </div>

          <div className="space-y-3">
            {STRICTNESS_LEVELS.map((s) => (
              <div
                key={s.level}
                className="p-3.5 rounded-xl bg-[#F1F4F2] dark:bg-[#202422] border border-[#E2E8E4] dark:border-[#2F3532] space-y-1.5"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-md bg-[#0F5132] dark:bg-[#1F6E4A] text-white font-mono font-bold text-[10px] flex items-center justify-center">
                      {s.level}
                    </span>
                    <span className="text-xs font-bold text-[#111827] dark:text-[#ECEEED]">
                      {s.title}
                    </span>
                  </div>
                  <span className="text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded bg-white dark:bg-[#181B19] border border-[#E2E8E4] dark:border-[#2F3532] text-[#4B5563] dark:text-[#969E9A]">
                    {s.tolerance}
                  </span>
                </div>
                <p className="text-xs text-[#4B5563] dark:text-[#969E9A] leading-relaxed">
                  {s.desc}
                </p>
                <div className="text-[10px] text-[#6B7280] dark:text-[#68706C]">
                  <strong className="text-[#4B5563] dark:text-[#969E9A]">Recommended for:</strong> {s.idealFor}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Keyboard Shortcuts Strip */}
      <div className="bg-white dark:bg-[#181B19] border border-[#E2E8E4] dark:border-[#2A2F2C] rounded-[20px] p-6 shadow-none dark:shadow-none space-y-4">
        <div className="flex items-center gap-2.5 pb-3 border-b border-[#E2E8E4] dark:border-[#2F3532]">
          <div className="w-8 h-8 rounded-lg bg-[#E8F3EE] dark:bg-[#1A2B23] text-[#0F5132] dark:text-[#7CC9A3] flex items-center justify-center font-bold text-xs border border-transparent dark:border-[#294236]">
            <Keyboard className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-[#111827] dark:text-[#ECEEED]">
              Rapid Evaluation Keyboard Controls
            </h2>
            <p className="text-xs text-[#4B5563] dark:text-[#969E9A]">
              Continuous-flow grading shortcuts to minimize repetitive mouse movement
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {KEYBOARD_SHORTCUTS.map((item) => (
            <div
              key={item.key}
              className="p-3.5 rounded-xl bg-[#F1F4F2] dark:bg-[#202422] border border-[#E2E8E4] dark:border-[#2F3532] flex items-start gap-3"
            >
              <kbd className="px-2 py-1 rounded bg-white dark:bg-[#181B19] border border-[#E2E8E4] dark:border-[#2F3532] font-mono font-bold text-xs text-[#111827] dark:text-[#ECEEED] shrink-0">
                {item.key}
              </kbd>
              <div className="space-y-0.5 min-w-0">
                <div className="text-xs font-bold text-[#111827] dark:text-[#ECEEED]">{item.label}</div>
                <div className="text-[11px] text-[#4B5563] dark:text-[#969E9A] leading-tight">{item.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
