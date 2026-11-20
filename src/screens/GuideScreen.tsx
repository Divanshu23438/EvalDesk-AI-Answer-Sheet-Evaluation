import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  BookOpen,
  Search,
  CheckCircle2,
  ChevronDown,
  ArrowRight,
  ArrowLeft,
  Sparkles,
  FileCheck2,
  Sliders,
  SplitSquareVertical,
  FileSpreadsheet,
  HelpCircle,
  Clock,
  Lightbulb,
  Keyboard,
  ShieldCheck,
  AlertCircle,
  Award,
  Layers,
  X,
} from 'lucide-react';

interface StepItem {
  num: number;
  title: string;
  desc: string;
  details?: string[];
  tip?: string;
}

interface Chapter {
  id: number;
  tabLabel: string;
  badge: string;
  title: string;
  readTime: string;
  summary: string;
  icon: React.ComponentType<{ className?: string }>;
  steps: StepItem[];
  callout: {
    title: string;
    text: string;
  };
  cta: {
    label: string;
    route: string;
  };
}

interface FAQItem {
  id: string;
  category: 'OCR & Scans' | 'Scoring' | 'Reports';
  question: string;
  answer: string;
  chapterId: number;
  chapterTitle: string;
}

const CHAPTERS: Chapter[] = [
  {
    id: 1,
    tabLabel: '01. Exam Setup & Reference Key',
    badge: 'Exam Scheme & Rubrics',
    title: '1. Upload Question Paper & Generate Reference Key',
    readTime: '3 min read',
    summary:
      'Configure assessment parameters, establish total marks and question distribution, and leverage automated vision scanning to generate the expected reference answer key and rubrics.',
    icon: Sparkles,
    steps: [
      {
        num: 1,
        title: 'Define Assessment Master Metadata',
        desc: 'Begin by selecting or creating a target Assessment Paper in the upload workspace. Specify the formal Subject Name, Subject Code, Exam Session, and Total Maximum Marks.',
        details: [
          'Subject Code provides unambiguous indexing for multi-section university courses.',
          'Total marks serve as the denominator for percentage calculations and institutional grade cutoffs.',
        ],
      },
      {
        num: 2,
        title: 'Upload Question Paper & Auto-Fetch Reference Key',
        desc: 'Upload your original examination question paper (PDF or PNG). Click the "Auto-Fetch Exam Details" button to automatically extract question numbers, maximum marks, question formats, and model answers.',
        details: [
          'Automatically parses question types: Multiple Choice, Short Answer, Long Essay, and Numerical Proofs.',
          'Generates structured model reference points with proportional step-wise mark weights.',
        ],
      },
      {
        num: 3,
        title: 'Review Rubrics & Lock Paper Scheme',
        desc: 'Verify each question rubric before processing student booklets. You can adjust per-question point distributions, add model answer keywords, and lock the paper schema to guarantee batch consistency.',
        tip: 'Locking the paper scheme prevents accidental rubrics drift across the evaluation batch.',
      },
    ],
    callout: {
      title: 'Teacher Best Practice',
      text: 'Always verify the total marks tally in the scheme summary card. Locking the paper before uploading answer sheets guarantees uniform scoring criteria across all student submissions.',
    },
    cta: {
      label: 'Go to Upload & Setup →',
      route: '#/upload',
    },
  },
  {
    id: 2,
    tabLabel: '02. Batch Upload & Identity',
    badge: 'Scans & Extraction',
    title: '2. Batch Upload & Evaluate Answer Sheets (OCR Best Practices)',
    readTime: '4 min read',
    summary:
      'Import student handwritten booklets, review automatic handwriting OCR extraction of student metadata, and resolve student identity validations in the upload queue.',
    icon: FileCheck2,
    steps: [
      {
        num: 1,
        title: 'Prepare Clean Answer Booklet Scans (300 DPI Recommended)',
        desc: 'Scan student answer booklets at a recommended 300 DPI flatbed or feeder resolution. Files may be uploaded as multi-page PDFs or individual image archives (PNG, JPG).',
        details: [
          'Multi-page answer booklets are automatically grouped into sequential virtual booklets.',
          'Higher scan contrast eliminates background paper bleed-through and improves stroke recognition.',
        ],
      },
      {
        num: 2,
        title: 'Automated Student Header Extraction',
        desc: 'EvalDesk vision models inspect the front cover page to automatically extract Student Name, Roll Number, and Class/Section.',
        details: [
          'Standard roll number conventions are parsed and normalized (e.g. CS-2026-089, ENG-402-A).',
          'Extracted names and roll numbers populate the batch processing queue automatically.',
        ],
      },
      {
        num: 3,
        title: 'Resolve Identity Confidence Flags & Troubleshoot Uploads',
        desc: 'If handwriting legibility on the cover page is below 85% confidence, an amber badge appears on the row. Click the identity pill to open the inline editor and verify the student details prior to evaluation.',
        tip: 'Double-sided answer booklets are automatically paired into a single virtual student booklet.',
      },
    ],
    callout: {
      title: 'Optimal Scan Settings',
      text: 'For the highest handwriting recognition accuracy, capture scans at 300 DPI grayscale or color. Avoid low-resolution mobile photographs with angled perspective skew or dark uneven shadowing.',
    },
    cta: {
      label: 'Go to Upload & Setup →',
      route: '#/upload',
    },
  },
  {
    id: 3,
    tabLabel: '03. 1–5 Strictness Levels',
    badge: 'Grading Calibration',
    title: '1–5 AI Strictness Calibration & Partial Credit Mechanics',
    readTime: '5 min read',
    summary:
      'Calibrate the grading engine across 5 standardized strictness tiers (Lenient to Exact) to match your institutional assessment standards and evaluation objectives.',
    icon: Sliders,
    steps: [
      {
        num: 1,
        title: 'Understand the 1–5 Strictness Continuum',
        desc: 'EvalDesk offers 5 discrete strictness calibrations that control how the evaluation model handles semantic synonyms, minor grammatical flaws, missing derivation steps, and exact technical terminology.',
      },
      {
        num: 2,
        title: 'Select Appropriate Level for Exam Context',
        desc: 'Choose your strictness level based on whether the assessment is a low-stakes conceptual formative quiz or a high-stakes final degree accreditation examination.',
      },
      {
        num: 3,
        title: 'Real-Time Recalibration Without Re-scanning',
        desc: 'Modifying the strictness level recalculates rubric confidence bands and threshold tolerances instantly without requiring re-OCR of student handwriting.',
      },
    ],
    callout: {
      title: 'Calibration Rule of Thumb',
      text: 'Use Level 3 (Balanced) for regular midterm and semester exams. Reserve Level 4 (Rigorous) for senior honors and science courses, and Level 5 (Exact) for code syntax or objective factual benchmarks.',
    },
    cta: {
      label: 'Open Evaluation History →',
      route: '#/history',
    },
  },
  {
    id: 4,
    tabLabel: '04. Split-Screen Evaluation',
    badge: 'Evaluation Workspace',
    title: 'Split-Screen Workspace, Keyboard Navigation & Re-Evaluation',
    readTime: '6 min read',
    summary:
      'Master the high-speed split evaluation workspace: inspect synchronized answer booklet crops, audit AI scoring rationales, navigate with keyboard shortcuts, and override marks.',
    icon: SplitSquareVertical,
    steps: [
      {
        num: 1,
        title: 'Three-Pane Synchronized Layout',
        desc: 'The evaluation screen provides an interactive 3-pane split layout: Left pane displays high-res booklet pages with bounding-box navigation; Center pane presents rubric step scores and diagnostic rationales; Right rail shows question status pills.',
      },
      {
        num: 2,
        title: 'Audit AI Justification & Confidence Bands',
        desc: 'Each question evaluation provides an itemized breakdown of correct assertions (green), partial omissions (amber), and incorrect statements (rose) alongside an overall OCR confidence score.',
      },
      {
        num: 3,
        title: 'Single-Click Teacher Grade Override & Re-evaluation',
        desc: 'Teachers retain full authoritative control. Click directly on any question mark pill or adjust rubric sliders to override the score, or hit "R" to trigger an AI re-evaluation with teacher notes.',
        tip: 'Press keyboard shortcut "A" to rapidly approve questions with >=85% confidence and jump straight to the next student question.',
      },
    ],
    callout: {
      title: 'Confidence Review Protocol',
      text: 'Questions with OCR confidence >=85% are verified. Questions with confidence <85% are automatically flagged with an amber warning dot so you can focus inspection time where it matters most.',
    },
    cta: {
      label: 'Open Evaluation History →',
      route: '#/history',
    },
  },
  {
    id: 5,
    tabLabel: '05. Report Cards & Exports',
    badge: 'Reports & Publishing',
    title: '3. Review Detailed Report & Export 1-Page Report Cards',
    readTime: '4 min read',
    summary:
      'Export official academic transcripts: generate whole-class Excel master sheets, printable PDF report cards with institutional grading scales, and performance analytics.',
    icon: FileSpreadsheet,
    steps: [
      {
        num: 1,
        title: 'Access the Centralized Report Card Center (#/reports)',
        desc: 'Navigate to Report Card (#/reports) to view aggregated class performance metrics, student rank distributions, pass rates, and individual 1-page digital report cards.',
      },
      {
        num: 2,
        title: 'Download Whole-Class Excel Master Ledger (.xlsx)',
        desc: 'Generate a comprehensive spreadsheet with a single click. Includes student names, roll numbers, individual question scores, section totals, percentages, and letter grades formatted for institutional archives.',
      },
      {
        num: 3,
        title: 'Generate Two-Sided Printable Student Marksheet (.pdf)',
        desc: 'Export formal student report cards featuring detailed score breakdowns on Page 1, and institutional grading scales (letter grades, percentage brackets, GPA points, and signature blocks) on Page 2.',
      },
    ],
    callout: {
      title: 'Institutional Archiving',
      text: 'Exported Excel workbooks contain active formulas and standardized headers, making it straightforward to import results into university Learning Management Systems (LMS) and student portals.',
    },
    cta: {
      label: 'Open Report Card Center →',
      route: '#/reports',
    },
  },
];

const FAQS: FAQItem[] = [
  {
    id: 'faq-1',
    category: 'OCR & Scans',
    question: 'What scan resolution (DPI) gives the highest OCR accuracy?',
    answer:
      'We recommend scanning at 300 DPI in grayscale or color (PDF or PNG format). 300 DPI delivers optimal line contrast for cursive and print handwriting, sustaining over 96% recognition accuracy. Avoid 72 DPI mobile photographs with low contrast or uneven lighting.',
    chapterId: 2,
    chapterTitle: 'Chapter 02. Batch Upload & Identity',
  },
  {
    id: 'faq-2',
    category: 'OCR & Scans',
    question: "How do I fix a student's auto-extracted Roll Number or Class?",
    answer:
      'When an answer sheet cover page has low OCR clarity (<85%), an amber badge appears on that row in the Upload Queue. Click the student identity badge to open the inline editor, update the Student Name, Roll Number, or Class, and click "Save Identity". The corrected identity updates immediately.',
    chapterId: 2,
    chapterTitle: 'Chapter 02. Batch Upload & Identity',
  },
  {
    id: 'faq-3',
    category: 'Scoring',
    question: 'Which strictness level should I choose for mid-semester vs. end-semester exams?',
    answer:
      'For formative assessments, quizzes, and mid-semester exams where rewarding partial conceptual reasoning is desirable, choose Level 2 (Mild) or Level 3 (Balanced). For official end-semester finals and competitive benchmarks, calibrate to Level 4 (Rigorous) or Level 5 (Exact).',
    chapterId: 3,
    chapterTitle: 'Chapter 03. 1–5 Strictness Levels',
  },
  {
    id: 'faq-4',
    category: 'Scoring',
    question: 'How do I override AI-awarded marks or edit rubrics on a single question?',
    answer:
      'In the Split-Screen Evaluation Workspace (#/evaluate/:sheetId), click the Mark pill or rubric score sliders in the center panel. Enter your revised score; the teacher override immediately recalculates total marks, updates the marksheet, and logs an approved teacher state.',
    chapterId: 4,
    chapterTitle: 'Chapter 04. Split-Screen Evaluation',
  },
  {
    id: 'faq-5',
    category: 'OCR & Scans',
    question: 'What does the OCR Confidence score indicate?',
    answer:
      'The confidence score measures handwriting legibility and alignment with the question rubric. Scores >=85% are marked Verified. Answers with confidence <85% are automatically flagged with an amber warning dot for manual teacher inspection before finalizing.',
    chapterId: 4,
    chapterTitle: 'Chapter 04. Split-Screen Evaluation',
  },
  {
    id: 'faq-6',
    category: 'Scoring',
    question: 'How does the Auto-Fetch Question Paper scanner generate the Reference Key?',
    answer:
      'In Step 1 of Upload & Setup (#/upload), click "Auto-Fetch Exam Details" with the sparkles icon. The vision model analyzes the question paper file, extracts Subject, Code, Max Marks, and parses each question with expected answer rubrics into your assessment paper scheme.',
    chapterId: 1,
    chapterTitle: 'Chapter 01. Exam Setup & Reference Key',
  },
  {
    id: 'faq-7',
    category: 'Reports',
    question: 'How do I view the grading scale on the back of the student marksheet?',
    answer:
      'In the Student Marksheet PDF export, Page 2 contains the complete institutional grading scale, illustrating letter grades (O, A+, A, B+, B, C, F), percentage ranges, grade points, and signature verification blocks for head examiners.',
    chapterId: 5,
    chapterTitle: 'Chapter 05. Report Cards & Exports',
  },
  {
    id: 'faq-8',
    category: 'Reports',
    question: 'How do I download a whole-class Excel sheet vs. an individual 1-page student report card PDF?',
    answer:
      'Navigate to Report Card (#/reports). The top action card offers a single-click button "Download Whole Class Result (.xlsx)" for the entire class roster. In the student directory, click "Download PDF" on any individual student card to export that student\'s 1-page report card.',
    chapterId: 5,
    chapterTitle: 'Chapter 05. Report Cards & Exports',
  },
  {
    id: 'faq-9',
    category: 'Scoring',
    question: 'Can I recheck or re-evaluate an answer if the AI misread student handwriting?',
    answer:
      'Yes. Press keyboard shortcut "R" or click the "Recheck" icon on any question card. A popover opens allowing you to enter optional teacher guidance (e.g., "Student wrote in cursive script") to trigger an instantaneous re-evaluation with enhanced vision passes.',
    chapterId: 4,
    chapterTitle: 'Chapter 04. Split-Screen Evaluation',
  },
  {
    id: 'faq-10',
    category: 'Reports',
    question: 'Is student evaluation data saved permanently between sessions?',
    answer:
      'Yes. All papers, extracted booklets, rubric scores, and teacher overrides are stored in the persistent local SQLite database. You can review previous evaluation batches anytime from the Evaluation History screen (#/history).',
    chapterId: 5,
    chapterTitle: 'Chapter 05. Report Cards & Exports',
  },
];

const STRICTNESS_LEVELS = [
  {
    level: 1,
    name: 'Lenient',
    scoreTolerance: 'High partial credit tolerance',
    logic: 'Awards up to 80% marks if core concepts are present, overlooking syntax & phrasing defects.',
    recommendedFor: 'Formative diagnostics, open-book assignments, and introductory coursework.',
    badgeBg: '#ECFDF5',
    badgeText: '#065F46',
    darkBg: '#142B20',
    darkText: '#6EE7B7',
  },
  {
    level: 2,
    name: 'Mild',
    scoreTolerance: 'Moderate leniency',
    logic: 'Forgives phrasing differences if core reasoning steps are logically sound and complete.',
    recommendedFor: 'Standard unit quizzes, weekly classroom tests, and revision checks.',
    badgeBg: '#F0FDF4',
    badgeText: '#15803D',
    darkBg: '#172D1E',
    darkText: '#86EFAC',
  },
  {
    level: 3,
    name: 'Balanced',
    scoreTolerance: 'Academic standard (Default)',
    logic: 'Requires key terminology and step-wise derivation; awards proportionate partial marks.',
    recommendedFor: 'Semester-end assessments, midterm examinations, and board papers.',
    badgeBg: '#E8F3EE',
    badgeText: '#0F5132',
    darkBg: '#1A2B23',
    darkText: '#7CC9A3',
    isDefault: true,
  },
  {
    level: 4,
    name: 'Rigorous',
    scoreTolerance: 'Strict accuracy',
    logic: 'Deducts for omitted steps, imprecise technical terms, or missing units of measurement.',
    recommendedFor: 'Advanced degree courses, honors classes, and competitive selections.',
    badgeBg: '#FEF3C7',
    badgeText: '#B45309',
    darkBg: '#2B2416',
    darkText: '#E5B567',
  },
  {
    level: 5,
    name: 'Exact',
    scoreTolerance: 'Zero tolerance',
    logic: 'Strict point-to-point concordance required; non-standard wording receives zero marks.',
    recommendedFor: 'Objective tests, coding syntax evaluations, and precision certifications.',
    badgeBg: '#FFE4E6',
    badgeText: '#BE123C',
    darkBg: '#2B191D',
    darkText: '#E57D8A',
  },
];

const KEYBOARD_SHORTCUTS = [
  { key: 'A', desc: 'Approve AI Grade & advance to next question' },
  { key: 'F', desc: 'Jump to next flagged question requiring review' },
  { key: 'R', desc: 'Trigger AI recheck with custom teacher guidance' },
  { key: '← / →', desc: 'Navigate between previous and next question' },
  { key: '[', desc: 'Toggle navigation sidebar (expanded / collapsed)' },
  { key: '?', desc: 'Open keyboard shortcut cheatsheet modal' },
];

export const GuideScreen: React.FC = () => {
  const [activeChapterId, setActiveChapterId] = useState<number>(1);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [faqCategory, setFaqCategory] = useState<'All' | 'OCR & Scans' | 'Scoring' | 'Reports'>('All');
  const [expandedFaqId, setExpandedFaqId] = useState<string | null>('faq-1');

  // Persistence of completed chapters
  const [completedChapters, setCompletedChapters] = useState<number[]>(() => {
    if (typeof localStorage === 'undefined') return [1];
    try {
      const stored = localStorage.getItem('evaldesk_guide_read');
      return stored ? JSON.parse(stored) : [1];
    } catch {
      return [1];
    }
  });

  const readerRef = useRef<HTMLDivElement | null>(null);

  // Sync completed chapters to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('evaldesk_guide_read', JSON.stringify(completedChapters));
    } catch (err) {
      console.error('Failed to persist guide read state', err);
    }
  }, [completedChapters]);

  const toggleChapterLearned = (chapterId: number) => {
    setCompletedChapters((prev) =>
      prev.includes(chapterId) ? prev.filter((id) => id !== chapterId) : [...prev, chapterId]
    );
  };

  const handleSelectChapter = (id: number) => {
    setActiveChapterId(id);
    if (readerRef.current) {
      readerRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const handleLinkToChapter = (chapterId: number) => {
    setActiveChapterId(chapterId);
    if (readerRef.current) {
      readerRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const activeChapter = useMemo(
    () => CHAPTERS.find((ch) => ch.id === activeChapterId) || CHAPTERS[0],
    [activeChapterId]
  );

  const isCurrentLearned = completedChapters.includes(activeChapter.id);

  // Filter FAQs
  const filteredFaqs = useMemo(() => {
    return FAQS.filter((faq) => {
      const matchesCategory = faqCategory === 'All' || faq.category === faqCategory;
      const query = searchQuery.trim().toLowerCase();
      if (!query) return matchesCategory;

      const inQuestion = faq.question.toLowerCase().includes(query);
      const inAnswer = faq.answer.toLowerCase().includes(query);
      const inCategory = faq.category.toLowerCase().includes(query);
      return matchesCategory && (inQuestion || inAnswer || inCategory);
    });
  }, [faqCategory, searchQuery]);

  // Filter chapters matching search query
  const matchingChapterIds = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return [];
    return CHAPTERS.filter((ch) => {
      const inTitle = ch.title.toLowerCase().includes(query);
      const inSummary = ch.summary.toLowerCase().includes(query);
      const inSteps = ch.steps.some(
        (s) => s.title.toLowerCase().includes(query) || s.desc.toLowerCase().includes(query)
      );
      return inTitle || inSummary || inSteps;
    }).map((ch) => ch.id);
  }, [searchQuery]);

  const completedCount = completedChapters.length;

  return (
    <div className="w-full flex-1 min-h-0 overflow-y-auto bg-[#F6F7F5] dark:bg-[#111312] select-text transition-colors duration-200">
      <div className="max-w-[1440px] mx-auto p-4 sm:p-6 space-y-5">
        {/* A. Top Header & Unified Search Bento Bar */}
        <section
          aria-label="Teacher Guide Header & Search"
          className="bg-white dark:bg-[#181B19] rounded-[20px] border border-[#E2E8E4] dark:border-[#2A2F2C] p-5 sm:p-6 shadow-[0_4px_16px_rgba(17,24,39,0.04)] dark:shadow-none transition-colors duration-200"
        >
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
            {/* Title & Subtitle */}
            <div className="space-y-1.5 max-w-2xl">
              <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-[#E8F3EE] dark:bg-[#1A2B23] text-[#0F5132] dark:text-[#7CC9A3] text-xs font-semibold border border-[#0F5132]/20 dark:border-[#294236]">
                <BookOpen className="w-3.5 h-3.5" />
                <span>Teacher Documentation & Knowledge Base</span>
              </div>
              <h1 className="text-xl sm:text-2xl font-bold text-[#111827] dark:text-[#ECEEED] tracking-tight font-display">
                Teacher User Manual & FAQ Guide
              </h1>
              <p className="text-xs sm:text-sm text-[#4B5563] dark:text-[#969E9A] leading-relaxed">
                Step-by-step instructions for uploading question papers, calibrating strictness, evaluating sheets, and
                exporting official marksheets.
              </p>
            </div>

            {/* Right: Search Input + Reading Progress Badge */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 shrink-0">
              {/* Search Bar */}
              <div className="relative w-full sm:w-72">
                <Search className="w-4 h-4 text-slate-400 dark:text-[#68706C] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search manual chapters or FAQs..."
                  className="w-full pl-9 pr-8 py-2 text-xs sm:text-sm rounded-xl border border-[#E2E8E4] dark:border-[#2F3532] bg-[#F6F7F5]/60 dark:bg-[#202422] text-[#111827] dark:text-[#ECEEED] placeholder:text-slate-400 dark:placeholder:text-[#68706C] focus:outline-none focus:ring-2 focus:ring-[#0F5132]/20 dark:focus:ring-[#1F6E4A]/30 focus:border-[#0F5132] dark:focus:border-[#1F6E4A] transition"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 text-slate-400 dark:text-[#68706C] hover:text-slate-600 dark:hover:text-[#ECEEED] rounded-md"
                    title="Clear search"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Reading Progress Badge */}
              <div
                className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-[#E8F3EE] dark:bg-[#1A2B23] border border-[#0F5132]/20 dark:border-[#294236] text-[#0F5132] dark:text-[#7CC9A3] font-semibold text-xs whitespace-nowrap shadow-2xs dark:shadow-none"
                title={`${completedCount} of 5 Chapters Marked as Learned`}
              >
                <div className="w-5 h-5 rounded-full bg-[#0F5132] dark:bg-[#1F6E4A] text-white flex items-center justify-center text-[10px] font-bold">
                  {completedCount}
                </div>
                <span>{completedCount} of 5 Chapters Read</span>
              </div>
            </div>
          </div>

          {/* Search Result Quick Notification if filtered */}
          {searchQuery && (
            <div className="mt-4 pt-3 border-t border-[#E2E8E4] dark:border-[#2A2F2C] flex items-center justify-between text-xs text-[#4B5563] dark:text-[#969E9A]">
              <span>
                Found matching results: <strong>{matchingChapterIds.length}</strong> chapters,{' '}
                <strong>{filteredFaqs.length}</strong> FAQs
              </span>
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="text-[#0F5132] dark:text-[#7CC9A3] font-medium hover:underline"
              >
                Reset Search
              </button>
            </div>
          )}
        </section>

        {/* B. Two-Column Split: Center User Manual (8 Cols) + Right Common FAQs (4 Cols) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          {/* 1. CENTER SECTION (lg:col-span-8) — Interactive Teacher User Manual */}
          <main className="lg:col-span-8 space-y-5" ref={readerRef}>
            {/* Chapter Navigation Strip */}
            <nav
              aria-label="User Manual Chapters"
              className="bg-white dark:bg-[#181B19] rounded-[20px] border border-[#E2E8E4] dark:border-[#2A2F2C] p-2.5 shadow-[0_4px_16px_rgba(17,24,39,0.04)] dark:shadow-none overflow-x-auto no-scrollbar transition-colors duration-200"
            >
              <div className="flex items-center gap-2 min-w-max">
                {CHAPTERS.map((ch) => {
                  const isActive = ch.id === activeChapterId;
                  const isLearned = completedChapters.includes(ch.id);
                  const isMatch = matchingChapterIds.includes(ch.id);

                  return (
                    <button
                      key={ch.id}
                      type="button"
                      onClick={() => handleSelectChapter(ch.id)}
                      className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition-all duration-150 flex items-center gap-2 cursor-pointer ${
                        isActive
                          ? 'bg-[#0F5132] dark:bg-[#1F6E4A] text-white shadow-sm ring-2 ring-[#0F5132]/30 dark:ring-[#1F6E4A]/40'
                          : 'bg-[#F6F7F5] dark:bg-[#202422] text-[#4B5563] dark:text-[#969E9A] hover:bg-[#E8F3EE] dark:hover:bg-[#1A2B23] hover:text-[#0F5132] dark:hover:text-[#7CC9A3]'
                      } ${isMatch && !isActive ? 'ring-2 ring-[#D97706]/40 dark:ring-[#E5B567]/40' : ''}`}
                    >
                      <span>{ch.tabLabel}</span>
                      {isLearned && (
                        <CheckCircle2
                          className={`w-3.5 h-3.5 shrink-0 ${
                            isActive ? 'text-[#E8F3EE] dark:text-[#7CC9A3]' : 'text-[#0F5132] dark:text-[#7CC9A3]'
                          }`}
                        />
                      )}
                    </button>
                  );
                })}
              </div>
            </nav>

            {/* Active Manual Reader Card */}
            <article className="bg-white dark:bg-[#181B19] rounded-[20px] border border-[#E2E8E4] dark:border-[#2A2F2C] p-6 sm:p-8 shadow-[0_4px_16px_rgba(17,24,39,0.04)] dark:shadow-none space-y-6 transition-colors duration-200">
              {/* Card Header */}
              <div className="border-b border-[#E2E8E4] dark:border-[#2A2F2C] pb-6 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded-full bg-[#E8F3EE] dark:bg-[#1A2B23] text-[#0F5132] dark:text-[#7CC9A3] font-semibold text-xs border border-[#0F5132]/20 dark:border-[#294236]">
                      Chapter 0{activeChapter.id} · {activeChapter.badge}
                    </span>
                    <span className="inline-flex items-center gap-1 text-xs text-[#4B5563] dark:text-[#969E9A]">
                      <Clock className="w-3.5 h-3.5 text-slate-400 dark:text-[#68706C]" />
                      <span>{activeChapter.readTime}</span>
                    </span>
                  </div>

                  {/* Mark as Learned Toggle Button */}
                  <button
                    type="button"
                    onClick={() => toggleChapterLearned(activeChapter.id)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer shadow-2xs dark:shadow-none ${
                      isCurrentLearned
                        ? 'bg-[#0F5132] dark:bg-[#1F6E4A] text-white hover:bg-[#0B3D26] dark:hover:bg-[#27855A]'
                        : 'bg-white dark:bg-[#202422] border border-[#E2E8E4] dark:border-[#2F3532] text-[#0F5132] dark:text-[#7CC9A3] hover:bg-[#E8F3EE] dark:hover:bg-[#1A2B23]'
                    }`}
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>{isCurrentLearned ? 'Learned ✓' : 'Mark as Learned ✓'}</span>
                  </button>
                </div>

                <h2 className="text-xl sm:text-2xl font-bold text-[#111827] dark:text-[#ECEEED] tracking-tight">
                  {activeChapter.title}
                </h2>
                <p className="text-xs sm:text-sm text-[#4B5563] dark:text-[#969E9A] leading-relaxed">
                  {activeChapter.summary}
                </p>
              </div>

              {/* Numbered Step-by-Step Instructions */}
              <div className="space-y-5">
                <h3 className="text-sm font-bold uppercase tracking-wider text-[#111827] dark:text-[#ECEEED] flex items-center gap-2">
                  <Layers className="w-4 h-4 text-[#0F5132] dark:text-[#7CC9A3]" />
                  <span>Step-by-Step Teacher Workflow</span>
                </h3>

                <div className="space-y-4">
                  {activeChapter.steps.map((st) => (
                    <div
                      key={st.num}
                      className="p-4 sm:p-5 rounded-2xl bg-[#F6F7F5]/80 dark:bg-[#202422] border border-[#E2E8E4] dark:border-[#2F3532] space-y-2.5 transition-colors"
                    >
                      <div className="flex items-start gap-3">
                        <div className="w-7 h-7 rounded-xl bg-[#0F5132] dark:bg-[#1F6E4A] text-white font-bold text-xs flex items-center justify-center shrink-0 shadow-2xs dark:shadow-none mt-0.5">
                          {st.num}
                        </div>
                        <div className="space-y-1.5 flex-1 min-w-0">
                          <h4 className="text-sm font-bold text-[#111827] dark:text-[#ECEEED]">{st.title}</h4>
                          <p className="text-xs sm:text-sm text-[#4B5563] dark:text-[#969E9A] leading-relaxed">{st.desc}</p>
                          {st.details && st.details.length > 0 && (
                            <ul className="list-disc list-inside space-y-1 text-xs text-[#4B5563] dark:text-[#969E9A] pt-1">
                              {st.details.map((d, idx) => (
                                <li key={idx} className="leading-relaxed">
                                  {d}
                                </li>
                              ))}
                            </ul>
                          )}
                          {st.tip && (
                            <div className="mt-2 text-xs font-medium text-[#0F5132] dark:text-[#7CC9A3] bg-[#E8F3EE] dark:bg-[#1A2B23] px-2.5 py-1.5 rounded-lg border border-[#0F5132]/20 dark:border-[#294236] inline-block">
                              Tip: {st.tip}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Chapter-Specific Structured Reference Tables */}
              {/* Chapter 03 Custom Content: 1-5 Strictness Comparison Table */}
              {activeChapter.id === 3 && (
                <div className="space-y-3 pt-2">
                  <h3 className="text-sm font-bold uppercase tracking-wider text-[#111827] dark:text-[#ECEEED] flex items-center gap-2">
                    <Sliders className="w-4 h-4 text-[#0F5132] dark:text-[#7CC9A3]" />
                    <span>Strictness Level Comparison Matrix (Levels 1 to 5)</span>
                  </h3>
                  <div className="overflow-x-auto rounded-2xl border border-[#E2E8E4] dark:border-[#2A2F2C] bg-white dark:bg-[#181B19]">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-[#F6F7F5] dark:bg-[#202422] border-b border-[#E2E8E4] dark:border-[#2F3532] text-[#111827] dark:text-[#ECEEED] font-semibold">
                          <th className="p-3">Level & Mode</th>
                          <th className="p-3">Strictness Profile</th>
                          <th className="p-3">Partial Credit Scoring Logic</th>
                          <th className="p-3">Recommended Use Case</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#E2E8E4] dark:divide-[#2F3532]">
                        {STRICTNESS_LEVELS.map((lvl) => (
                          <tr
                            key={lvl.level}
                            className={`hover:bg-[#F6F7F5]/50 dark:hover:bg-[#202422]/50 transition-colors ${
                              lvl.isDefault ? 'bg-[#E8F3EE]/30 dark:bg-[#1A2B23]/30' : ''
                            }`}
                          >
                            <td className="p-3 whitespace-nowrap font-medium">
                              <span
                                className="px-2 py-0.5 rounded-md font-mono text-[11px] font-bold"
                                style={{
                                  backgroundColor: lvl.badgeBg,
                                  color: lvl.badgeText,
                                }}
                              >
                                Level {lvl.level} · {lvl.name}
                              </span>
                              {lvl.isDefault && (
                                <span className="ml-1.5 text-[9px] uppercase font-bold text-[#0F5132] dark:text-[#7CC9A3] bg-[#E8F3EE] dark:bg-[#1A2B23] px-1 py-0.2 rounded border border-[#0F5132]/20 dark:border-[#294236]">
                                  Default
                                </span>
                              )}
                            </td>
                            <td className="p-3 font-medium text-[#111827] dark:text-[#ECEEED]">{lvl.scoreTolerance}</td>
                            <td className="p-3 text-[#4B5563] dark:text-[#969E9A] leading-relaxed">{lvl.logic}</td>
                            <td className="p-3 text-[#4B5563] dark:text-[#969E9A] leading-relaxed">{lvl.recommendedFor}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Chapter 04 Custom Content: Keyboard Shortcuts & OCR Confidence */}
              {activeChapter.id === 4 && (
                <div className="space-y-4 pt-2">
                  <h3 className="text-sm font-bold uppercase tracking-wider text-[#111827] dark:text-[#ECEEED] flex items-center gap-2">
                    <Keyboard className="w-4 h-4 text-[#0F5132] dark:text-[#7CC9A3]" />
                    <span>Keyboard Shortcuts & Confidence Verification Standards</span>
                  </h3>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Confidence Thresholds Bento */}
                    <div className="p-4 rounded-2xl bg-[#F6F7F5] dark:bg-[#202422] border border-[#E2E8E4] dark:border-[#2F3532] space-y-3">
                      <div className="flex items-center gap-2 text-xs font-bold text-[#111827] dark:text-[#ECEEED]">
                        <ShieldCheck className="w-4 h-4 text-[#0F5132] dark:text-[#7CC9A3]" />
                        <span>OCR Confidence Calibration Rules</span>
                      </div>
                      <div className="space-y-2.5 text-xs">
                        <div className="p-3 rounded-xl bg-white dark:bg-[#181B19] border border-[#E2E8E4] dark:border-[#2A2F2C] flex items-start gap-2.5">
                          <span className="px-2 py-0.5 rounded-md bg-[#E8F3EE] dark:bg-[#1A2B23] text-[#0F5132] dark:text-[#7CC9A3] font-mono font-bold text-[11px]">
                            &gt;= 85%
                          </span>
                          <div>
                            <div className="font-bold text-[#111827] dark:text-[#ECEEED]">Verified (High Confidence)</div>
                            <div className="text-[#4B5563] dark:text-[#969E9A] text-[11px] leading-relaxed">
                              Clear handwriting strokes matching rubric key concepts. Auto-approved with one click.
                            </div>
                          </div>
                        </div>

                        <div className="p-3 rounded-xl bg-white dark:bg-[#181B19] border border-[#E2E8E4] dark:border-[#2A2F2C] flex items-start gap-2.5">
                          <span className="px-2 py-0.5 rounded-md bg-[#FEF3C7] dark:bg-[#2B2416] text-[#D97706] dark:text-[#E5B567] font-mono font-bold text-[11px]">
                            &lt; 85%
                          </span>
                          <div>
                            <div className="font-bold text-[#111827] dark:text-[#ECEEED]">Needs Review (Attention Required)</div>
                            <div className="text-[#4B5563] dark:text-[#969E9A] text-[11px] leading-relaxed">
                              Faint handwriting, ambiguous diagram notation, or partial omissions. Flagged for teacher inspection.
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Keyboard Shortcuts Bento */}
                    <div className="p-4 rounded-2xl bg-[#F6F7F5] dark:bg-[#202422] border border-[#E2E8E4] dark:border-[#2F3532] space-y-3">
                      <div className="flex items-center gap-2 text-xs font-bold text-[#111827] dark:text-[#ECEEED]">
                        <Keyboard className="w-4 h-4 text-[#0F5132] dark:text-[#7CC9A3]" />
                        <span>Speed Keyboard Shortcuts</span>
                      </div>
                      <div className="space-y-2 text-xs">
                        {KEYBOARD_SHORTCUTS.map((item, idx) => (
                          <div
                            key={idx}
                            className="flex items-center justify-between p-2 rounded-xl bg-white dark:bg-[#181B19] border border-[#E2E8E4] dark:border-[#2A2F2C]"
                          >
                            <span className="text-[#4B5563] dark:text-[#969E9A] text-[11px]">{item.desc}</span>
                            <kbd className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-[#202422] border border-slate-300 dark:border-[#2F3532] font-mono text-[10px] font-bold text-slate-800 dark:text-[#ECEEED] shrink-0 ml-2">
                              {item.key}
                            </kbd>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Practical Teacher Tips in Soft Mint Callout Box */}
              <div className="p-4 sm:p-5 rounded-2xl bg-[#E8F3EE] dark:bg-[#1A2B23] border border-[#0F5132]/20 dark:border-[#294236] flex items-start gap-3.5 transition-colors">
                <Lightbulb className="w-5 h-5 text-[#0F5132] dark:text-[#7CC9A3] shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <h4 className="text-xs sm:text-sm font-bold text-[#0F5132] dark:text-[#7CC9A3]">
                    {activeChapter.callout.title}
                  </h4>
                  <p className="text-xs sm:text-sm text-[#0F5132]/90 dark:text-[#A8D8C0] leading-relaxed">
                    {activeChapter.callout.text}
                  </p>
                </div>
              </div>

              {/* Bottom Chapter Footer */}
              <div className="pt-4 border-t border-[#E2E8E4] dark:border-[#2A2F2C] flex flex-col sm:flex-row items-center justify-between gap-3">
                {/* Previous Button */}
                <button
                  type="button"
                  onClick={() => handleSelectChapter(activeChapter.id - 1)}
                  disabled={activeChapter.id === 1}
                  className="w-full sm:w-auto px-4 py-2 rounded-xl border border-[#E2E8E4] dark:border-[#2F3532] text-xs font-semibold text-[#4B5563] dark:text-[#969E9A] hover:bg-[#F6F7F5] dark:hover:bg-[#202422] disabled:opacity-40 disabled:cursor-not-allowed transition flex items-center justify-center gap-2 cursor-pointer"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Previous Chapter</span>
                </button>

                {/* Next Chapter & Direct Action Buttons */}
                <div className="w-full sm:w-auto flex items-center gap-2.5">
                  <a
                    href={activeChapter.cta.route}
                    className="flex-1 sm:flex-initial px-4 py-2 rounded-xl bg-[#0F5132] dark:bg-[#1F6E4A] hover:bg-[#0B3D26] dark:hover:bg-[#27855A] text-white text-xs font-semibold shadow-xs transition flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <span>{activeChapter.cta.label}</span>
                  </a>

                  {activeChapter.id < CHAPTERS.length && (
                    <button
                      type="button"
                      onClick={() => handleSelectChapter(activeChapter.id + 1)}
                      className="flex-1 sm:flex-initial px-4 py-2 rounded-xl border border-[#E2E8E4] dark:border-[#2F3532] bg-white dark:bg-[#202422] text-xs font-semibold text-[#0F5132] dark:text-[#7CC9A3] hover:bg-[#E8F3EE] dark:hover:bg-[#1A2B23] transition flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <span>Next Chapter</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            </article>
          </main>

          {/* 2. RIGHT SECTION (lg:col-span-4 lg:sticky lg:top-6) — Common FAQs Panel */}
          <aside className="lg:col-span-4 lg:sticky lg:top-6 space-y-4">
            <div className="bg-white dark:bg-[#181B19] rounded-[20px] border border-[#E2E8E4] dark:border-[#2A2F2C] p-5 shadow-[0_4px_16px_rgba(17,24,39,0.04)] dark:shadow-none space-y-4 transition-colors duration-200">
              {/* Header */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <HelpCircle className="w-5 h-5 text-[#0F5132] dark:text-[#7CC9A3]" />
                    <h2 className="text-base font-bold text-[#111827] dark:text-[#ECEEED]">Common FAQs</h2>
                  </div>
                  <span className="text-[11px] font-semibold text-[#4B5563] dark:text-[#969E9A] bg-[#F6F7F5] dark:bg-[#202422] px-2 py-0.5 rounded-full border border-[#E2E8E4] dark:border-[#2F3532]">
                    {filteredFaqs.length} Questions
                  </span>
                </div>

                {/* Category Filter Pills */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  {(['All', 'OCR & Scans', 'Scoring', 'Reports'] as const).map((cat) => {
                    const isSelected = faqCategory === cat;
                    return (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => setFaqCategory(cat)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition cursor-pointer ${
                          isSelected
                            ? 'bg-[#0F5132] dark:bg-[#1F6E4A] text-white shadow-2xs'
                            : 'bg-[#F6F7F5] dark:bg-[#202422] text-[#4B5563] dark:text-[#969E9A] hover:bg-[#E8F3EE] dark:hover:bg-[#1A2B23] hover:text-[#0F5132] dark:hover:text-[#7CC9A3]'
                        }`}
                      >
                        {cat}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Accordion List */}
              <div className="space-y-2.5 divide-y divide-[#E2E8E4]/60 dark:divide-[#2A2F2C]">
                {filteredFaqs.length === 0 ? (
                  <div className="py-8 text-center text-xs text-slate-500 dark:text-[#68706C] space-y-1">
                    <AlertCircle className="w-6 h-6 text-slate-400 dark:text-[#68706C] mx-auto" />
                    <p className="font-semibold text-slate-700 dark:text-[#ECEEED]">No matching FAQs found</p>
                    <p>Try searching with another keyword or resetting the category filter.</p>
                  </div>
                ) : (
                  filteredFaqs.map((faq) => {
                    const isOpen = expandedFaqId === faq.id;

                    return (
                      <div key={faq.id} className="pt-2.5 first:pt-0">
                        <button
                          type="button"
                          onClick={() => setExpandedFaqId(isOpen ? null : faq.id)}
                          className="w-full text-left flex items-start justify-between gap-2.5 py-1.5 group cursor-pointer"
                        >
                          <span className="text-xs font-bold text-[#111827] dark:text-[#ECEEED] group-hover:text-[#0F5132] dark:group-hover:text-[#7CC9A3] transition leading-snug">
                            {faq.question}
                          </span>
                          <ChevronDown
                            className={`w-4 h-4 text-slate-400 dark:text-[#68706C] group-hover:text-[#0F5132] dark:group-hover:text-[#7CC9A3] transition-transform duration-200 shrink-0 mt-0.5 ${
                              isOpen ? 'rotate-180 text-[#0F5132] dark:text-[#7CC9A3]' : ''
                            }`}
                          />
                        </button>

                        {/* Accordion Content with smooth expand */}
                        {isOpen && (
                          <div className="mt-2 pl-1 pr-2 pb-2 space-y-2.5 text-xs text-[#4B5563] dark:text-[#969E9A] leading-relaxed animate-in fade-in duration-150">
                            <p>{faq.answer}</p>
                            <div className="pt-1">
                              <button
                                type="button"
                                onClick={() => handleLinkToChapter(faq.chapterId)}
                                className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#0F5132] dark:text-[#7CC9A3] hover:text-[#0B3D26] dark:hover:text-[#A8D8C0] hover:underline cursor-pointer bg-[#E8F3EE] dark:bg-[#1A2B23] px-2.5 py-1 rounded-lg border border-[#0F5132]/20 dark:border-[#294236] transition"
                              >
                                <span>Learn more in Chapter 0{faq.chapterId} →</span>
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Quick Support & Shortcuts Card */}
            <div className="bg-[#E8F3EE]/60 dark:bg-[#1A2B23]/40 rounded-[20px] border border-[#0F5132]/20 dark:border-[#294236] p-4 space-y-2 text-xs transition-colors">
              <div className="flex items-center gap-2 font-bold text-[#0F5132] dark:text-[#7CC9A3]">
                <Award className="w-4 h-4" />
                <span>Need Further Assistance?</span>
              </div>
              <p className="text-[#0F5132]/90 dark:text-[#A8D8C0] leading-relaxed text-[11px]">
                You can press <kbd className="px-1.5 py-0.5 rounded bg-white dark:bg-[#202422] border border-[#0F5132]/30 dark:border-[#294236] font-mono font-bold text-[10px] text-slate-800 dark:text-[#ECEEED]">?</kbd> on any evaluation screen to view contextual keyboard shortcuts.
              </p>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
};
