import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useTheme } from '../context/ThemeContext';
import {
  FileText,
  Sliders,
  School,
  Check,
  ChevronLeft,
  ChevronRight,
  ArrowRight,
  ArrowDown,
  Play,
  Pause,
  Download,
  RotateCcw,
  Sparkles,
  Laptop,
  Tablet,
  Smartphone,
  ShieldCheck,
  Scale,
  GraduationCap,
  FileSpreadsheet,
  CheckCircle2,
  Scan,
  CheckCircle,
  ExternalLink,
  Layers,
  Sun,
  Moon,
} from 'lucide-react';

interface QuestionItem {
  number: number;
  title: string;
  sub: string;
  score: string;
  maxScore: string;
  rubrics: { mark: string; desc: string; isNegative?: boolean }[];
}

const QUESTIONS_DATA: Record<number, QuestionItem> = {
  1: {
    number: 1,
    title: 'Thursday • Q.1 (4 Marks)',
    sub: 'Kernel Architecture & Modes',
    score: '4.0',
    maxScore: '4.0',
    rubrics: [
      { mark: '+2.0 M', desc: 'Monolithic vs Microkernel' },
      { mark: '+2.0 M', desc: 'Ring 0 Privileges & Traps' },
    ],
  },
  2: {
    number: 2,
    title: 'Thursday • Q.2 (2 Marks)',
    sub: 'System Calls Overview',
    score: '2.0',
    maxScore: '2.0',
    rubrics: [
      { mark: '+1.0 M', desc: 'POSIX Standard Interfaces' },
      { mark: '+1.0 M', desc: 'Interrupt Trap Vector Handling' },
    ],
  },
  3: {
    number: 3,
    title: 'Thursday • Q.3 (5 Marks)',
    sub: 'Process Scheduling Algorithms',
    score: '4.5',
    maxScore: '5.0',
    rubrics: [
      { mark: '+2.0 M', desc: 'Round Robin Time Slicing' },
      { mark: '+2.0 M', desc: 'Context Switch Overhead Cost' },
      { mark: '+0.5 M', desc: 'Quantum Drift Calculation' },
    ],
  },
  4: {
    number: 4,
    title: 'Thursday • Q.4 (6 Marks)',
    sub: 'Absolute Path vs. Relative Path',
    score: '5.5',
    maxScore: '6.0',
    rubrics: [
      { mark: '+2.0 M', desc: 'Core Definition' },
      { mark: '+2.0 M', desc: 'Path Syntax' },
      { mark: '+1.5 M', desc: 'CLI Examples' },
      { mark: '-0.5 M', desc: 'Edge Case Note', isNegative: true },
    ],
  },
  5: {
    number: 5,
    title: 'Thursday • Q.5 (4 Marks)',
    sub: 'File Permission Octals',
    score: '4.0',
    maxScore: '4.0',
    rubrics: [
      { mark: '+2.0 M', desc: 'Octal 755 bitmask logic' },
      { mark: '+2.0 M', desc: 'rwx binary octal translation' },
    ],
  },
  6: {
    number: 6,
    title: 'Thursday • Q.6 (3 Marks)',
    sub: 'Hardlinks vs Softlinks',
    score: '2.5',
    maxScore: '3.0',
    rubrics: [
      { mark: '+1.5 M', desc: 'Inode Pointer Logic' },
      { mark: '+1.0 M', desc: 'Cross-Filesystem Limitations', isNegative: true },
    ],
  },
  7: {
    number: 7,
    title: 'Thursday • Q.7 (6 Marks)',
    sub: 'Inter-Process Pipes & FIFO',
    score: '6.0',
    maxScore: '6.0',
    rubrics: [
      { mark: '+3.0 M', desc: 'pipe() System Call Implementation' },
      { mark: '+3.0 M', desc: 'Producer-Consumer Buffer' },
    ],
  },
  8: {
    number: 8,
    title: 'Thursday • Q.8 (2 Marks)',
    sub: 'Grep vs Sed Usage',
    score: '2.0',
    maxScore: '2.0',
    rubrics: [
      { mark: '+1.0 M', desc: 'Regex Token Matching' },
      { mark: '+1.0 M', desc: 'Stream Editing Buffer Rules' },
    ],
  },
  9: {
    number: 9,
    title: 'Thursday • Q.9 (4 Marks)',
    sub: 'Virtual Memory Paging',
    score: '3.5',
    maxScore: '4.0',
    rubrics: [
      { mark: '+2.0 M', desc: 'Page Table Multi-Level Walk' },
      { mark: '+1.5 M', desc: 'TLB Hit Rate Optimization' },
    ],
  },
  10: {
    number: 10,
    title: 'Thursday • Q.10 (3 Marks)',
    sub: 'Bash Script Environment Vars',
    score: '3.0',
    maxScore: '3.0',
    rubrics: [
      { mark: '+1.5 M', desc: 'export keyword scope' },
      { mark: '+1.5 M', desc: 'Subshell process inheritance' },
    ],
  },
  11: {
    number: 11,
    title: 'Thursday • Q.11 (4 Marks)',
    sub: 'Signals & Trap Catching',
    score: '3.5',
    maxScore: '4.0',
    rubrics: [
      { mark: '+2.0 M', desc: 'SIGTERM vs SIGKILL Semantics' },
      { mark: '+1.5 M', desc: 'Default Signal Actions' },
    ],
  },
  12: {
    number: 12,
    title: 'Thursday • Q.12 (2 Marks)',
    sub: 'Cron Daemon Syntax',
    score: '2.0',
    maxScore: '2.0',
    rubrics: [
      { mark: '+1.0 M', desc: '5-Field Timeline Specification' },
      { mark: '+1.0 M', desc: 'crontab -e daemon syntax' },
    ],
  },
  13: {
    number: 13,
    title: 'Thursday • Q.13 (5 Marks)',
    sub: 'Disk Partitioning & Mounts',
    score: '4.5',
    maxScore: '5.0',
    rubrics: [
      { mark: '+2.5 M', desc: 'fdisk Partitioning & UUIDs' },
      { mark: '+2.0 M', desc: '/etc/fstab Boot Mount Config' },
    ],
  },
  14: {
    number: 14,
    title: 'Thursday • Q.14 (3 Marks)',
    sub: 'SSH Key Fingerprints',
    score: '3.0',
    maxScore: '3.0',
    rubrics: [
      { mark: '+1.5 M', desc: 'Asymmetric Public/Private Keys' },
      { mark: '+1.5 M', desc: 'authorized_keys Handshake' },
    ],
  },
  15: {
    number: 15,
    title: 'Thursday • Q.15 (4 Marks)',
    sub: 'LVM Volume Groups',
    score: '4.0',
    maxScore: '4.0',
    rubrics: [
      { mark: '+2.0 M', desc: 'PV / VG / LV Logical Layout' },
      { mark: '+2.0 M', desc: 'Live Volume Extension Syntax' },
    ],
  },
  16: {
    number: 16,
    title: 'Thursday • Q.16 (2 Marks)',
    sub: 'Systemd Unit Files',
    score: '2.0',
    maxScore: '2.0',
    rubrics: [
      { mark: '+1.0 M', desc: '[Service] ExecStart Definition' },
      { mark: '+1.0 M', desc: 'systemctl daemon-reload Cycle' },
    ],
  },
  17: {
    number: 17,
    title: 'Thursday • Q.17 (3 Marks)',
    sub: 'Network Sockets & Netstat',
    score: '2.5',
    maxScore: '3.0',
    rubrics: [
      { mark: '+1.5 M', desc: 'TCP 3-Way Handshake States' },
      { mark: '+1.0 M', desc: 'LISTEN vs ESTABLISHED Flags' },
    ],
  },
  18: {
    number: 18,
    title: 'Thursday • Q.18 (4 Marks)',
    sub: 'Tar Compression Formats',
    score: '4.0',
    maxScore: '4.0',
    rubrics: [
      { mark: '+2.0 M', desc: 'tar -czvf Flag Combinations' },
      { mark: '+2.0 M', desc: 'gzip vs bzip2 Compression Tradeoffs' },
    ],
  },
  19: {
    number: 19,
    title: 'Thursday • Q.19 (6 Marks)',
    sub: 'Buffer Overflow Mitigation',
    score: 'Pending',
    maxScore: '6.0',
    rubrics: [
      { mark: '-- M', desc: 'ASLR Defense Analysis' },
      { mark: '-- M', desc: 'Stack Canary Verification' },
    ],
  },
};

const CHAPTERS = [
  { id: 'upload', label: '01. Drag & Drop Upload', time: 0, tag: '0:00' },
  { id: 'scan', label: '02. AI Laser Scan & Scoring', time: 5, tag: '0:05' },
  { id: 'report', label: '03. Detailed Evaluation Report', time: 7, tag: '0:07' },
];

const INTRO_PILLS = [
  { text: '48 handwritten booklets to grade by tomorrow?', isPrimary: false },
  { text: 'Manual rubric checks & totaling take hours.', isPrimary: false },
  { text: 'How do we keep 1–5 strictness consistent?', isPrimary: false },
  { text: 'Scan, rubric-grade & export in seconds.', isPrimary: true },
];

/**
 * Reusable ScrollReveal component using IntersectionObserver
 */
interface ScrollRevealProps {
  children: React.ReactNode;
  className?: string;
  direction?: 'up' | 'down' | 'left' | 'right' | 'zoom' | 'tilt-left' | 'tilt-right' | 'none';
  delay?: number;
  duration?: number;
  threshold?: number;
}

export const ScrollReveal: React.FC<ScrollRevealProps> = ({
  children,
  className = '',
  direction = 'up',
  delay = 0,
  duration = 700,
  threshold = 0.14,
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const elementRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    // Respect prefers-reduced-motion
    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (prefersReducedMotion) {
      setIsVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.unobserve(entry.target);
        }
      },
      {
        threshold,
        rootMargin: '0px 0px -40px 0px',
      }
    );

    const el = elementRef.current;
    if (el) observer.observe(el);

    return () => {
      if (el) observer.unobserve(el);
    };
  }, [threshold]);

  const getTransformClasses = () => {
    if (isVisible) {
      return 'opacity-100 translate-x-0 translate-y-0 scale-100 rotate-0';
    }
    switch (direction) {
      case 'left':
        return 'opacity-0 -translate-x-8';
      case 'right':
        return 'opacity-0 translate-x-8';
      case 'up':
        return 'opacity-0 translate-y-8';
      case 'down':
        return 'opacity-0 -translate-y-8';
      case 'zoom':
        return 'opacity-0 scale-95 translate-y-4';
      case 'tilt-left':
        return 'opacity-0 -rotate-2 scale-95 translate-y-4';
      case 'tilt-right':
        return 'opacity-0 rotate-2 scale-95 translate-y-4';
      case 'none':
      default:
        return 'opacity-0';
    }
  };

  return (
    <div
      ref={elementRef}
      className={`transition-all ease-out ${getTransformClasses()} ${className}`}
      style={{
        transitionDuration: `${duration}ms`,
        transitionDelay: `${delay}ms`,
      }}
    >
      {children}
    </div>
  );
};

export const HomeScreen: React.FC = () => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const { theme, toggleTheme } = useTheme();

  // 1. Kinetic Morph Loading Intro State
  const [introStage, setIntroStage] = useState<'pills' | 'morph' | 'done'>('pills');
  const [visiblePills, setVisiblePills] = useState<number[]>([]);
  const [introDismissed, setIntroDismissed] = useState<boolean>(false);
  const [heroRevealed, setHeroRevealed] = useState<boolean>(false);
  const introTimersRef = useRef<number[]>([]);

  // 2. Scroll Progress State
  const [scrollProgress, setScrollProgress] = useState<number>(0);

  // 3. Interactive Question Matrix State
  const [activeQuestion, setActiveQuestion] = useState<number>(4);
  const [isApproved, setIsApproved] = useState<boolean>(false);

  // 4. Multi-device Filter State
  const [deviceFilter, setDeviceFilter] = useState<'all' | 'laptop' | 'tablet' | 'mobile'>('all');

  // 5. Video Demo State & Chapters
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [videoTime, setVideoTime] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(true);

  // 6. Strictness Calibration Demo Slider
  const [strictnessLevel, setStrictnessLevel] = useState<number>(3);

  // Clear pending intro timers
  const clearIntroTimers = () => {
    introTimersRef.current.forEach((t) => window.clearTimeout(t));
    introTimersRef.current = [];
  };

  // Run the full kinetic morph intro sequence
  const runIntroSequence = useCallback(() => {
    clearIntroTimers();

    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (prefersReducedMotion) {
      setIntroStage('done');
      setIntroDismissed(true);
      setHeroRevealed(true);
      return;
    }

    setIntroDismissed(false);
    setHeroRevealed(false);
    setIntroStage('pills');
    setVisiblePills([]);

    // Stage 1 (0ms - 1400ms): Staggered speech pills popping in 250ms apart
    INTRO_PILLS.forEach((_, idx) => {
      const t = window.setTimeout(() => {
        setVisiblePills((prev) => [...prev, idx]);
      }, 250 * (idx + 1));
      introTimersRef.current.push(t);
    });

    // Stage 2 (1500ms - 2200ms): Morph pills into EvalDesk logo mark
    const morphTimer = window.setTimeout(() => {
      setIntroStage('morph');
    }, 1500);
    introTimersRef.current.push(morphTimer);

    // Stage 3 (2300ms): Curtain reveal & fade out overlay
    const curtainTimer = window.setTimeout(() => {
      setIntroStage('done');
    }, 2300);
    introTimersRef.current.push(curtainTimer);

    // Finish overlay removal and trigger hero upward rise
    const doneTimer = window.setTimeout(() => {
      setIntroDismissed(true);
      setHeroRevealed(true);
    }, 2700);
    introTimersRef.current.push(doneTimer);
  }, []);

  const skipIntro = () => {
    clearIntroTimers();
    setIntroStage('done');
    setIntroDismissed(true);
    setHeroRevealed(true);
  };

  // Start intro animation on mount
  useEffect(() => {
    runIntroSequence();
    return () => clearIntroTimers();
  }, [runIntroSequence]);

  // Track scroll progress across scroll container or window
  useEffect(() => {
    const getScrollContainer = () => {
      let el = containerRef.current?.parentElement;
      while (el) {
        const overflowY = window.getComputedStyle(el).overflowY;
        if (overflowY === 'auto' || overflowY === 'scroll') return el;
        el = el.parentElement;
      }
      return window;
    };

    const target = getScrollContainer();
    let rafId: number;

    const handleScroll = () => {
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        let scrollTop = 0;
        let scrollHeight = 0;
        let clientHeight = 0;

        if (target === window) {
          scrollTop = window.scrollY || document.documentElement.scrollTop;
          scrollHeight = document.documentElement.scrollHeight;
          clientHeight = window.innerHeight;
        } else {
          const el = target as HTMLElement;
          scrollTop = el.scrollTop;
          scrollHeight = el.scrollHeight;
          clientHeight = el.clientHeight;
        }

        const maxScroll = scrollHeight - clientHeight;
        const progress = maxScroll > 0 ? Math.min(Math.max(scrollTop / maxScroll, 0), 1) : 0;
        setScrollProgress(progress);
      });
    };

    target.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();

    return () => {
      target.removeEventListener('scroll', handleScroll);
      window.removeEventListener('scroll', handleScroll);
      cancelAnimationFrame(rafId);
    };
  }, []);

  // Question Selection Handling
  const handleSelectQuestion = (qNum: number) => {
    setActiveQuestion(qNum);
    setIsApproved(false);
  };

  const handlePrevQuestion = () => {
    if (activeQuestion > 1) {
      handleSelectQuestion(activeQuestion - 1);
    }
  };

  const handleNextQuestion = () => {
    if (activeQuestion < 19) {
      handleSelectQuestion(activeQuestion + 1);
    }
  };

  const currentQData = QUESTIONS_DATA[activeQuestion] || QUESTIONS_DATA[4];

  // Video Chapter Seeking
  const handleSeek = (time: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = time;
      videoRef.current.play().catch(() => {});
      setIsPlaying(true);
      setVideoTime(time);
    }
  };

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setVideoTime(videoRef.current.currentTime);
      setIsPlaying(!videoRef.current.paused);
    }
  };

  // Smooth scroll helper
  const scrollToSection = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const strictnessLabels: Record<number, string> = {
    1: '1: Lenient (Grace Allowed)',
    2: '2: Mild (Standard School)',
    3: '3: Balanced (Default Academic)',
    4: '4: Rigorous (Strict Terminology)',
    5: '5: Exact (Verbatim ISO/IEEE)',
  };

  return (
    <div
      ref={containerRef}
      className="w-full min-h-screen bg-[#F6F7F5] dark:bg-[#111312] text-[#1E2430] dark:text-[#ECEEED] font-sans antialiased selection:bg-[#0F5132]/15 selection:text-[#0F5132] dark:selection:bg-[#1A2B23] dark:selection:text-[#7CC9A3] flex flex-col relative"
    >
      {/* =========================================================
          STAGE 1 & 2: KINETIC MORPH LOADING INTRO OVERLAY
          Solid matte surfaces in dark mode, zero blur/aurora glow
          ========================================================= */}
      {!introDismissed && (
        <div
          className={`fixed inset-0 z-50 flex items-center justify-center bg-[#F6F7F5] dark:bg-[#111312] transition-opacity duration-700 select-none ${
            introStage === 'done' ? 'opacity-0 pointer-events-none' : 'opacity-100'
          }`}
          aria-hidden={introStage === 'done'}
        >
          {/* Skip Intro Button */}
          <button
            type="button"
            onClick={skipIntro}
            className="absolute top-6 right-6 px-3.5 py-1.5 rounded-full bg-white dark:bg-[#181B19] hover:bg-slate-50 dark:hover:bg-[#202422] border border-slate-200 dark:border-[#2A2F2C] text-xs font-semibold text-slate-600 dark:text-[#969E9A] hover:text-slate-900 dark:hover:text-[#ECEEED] transition-all cursor-pointer flex items-center gap-1.5"
            title="Skip Intro Animation"
          >
            <span>Skip</span>
            <ArrowRight className="w-3 h-3" />
          </button>

          <div className="relative w-full max-w-lg mx-auto px-6 flex flex-col items-center justify-center min-h-[280px]">
            {/* Stage 1: Staggered Speech Pills */}
            <div
              className={`flex flex-col items-center gap-3 w-full transition-all duration-500 ${
                introStage === 'morph' ? 'opacity-0 scale-75 -translate-y-4 pointer-events-none' : 'opacity-100'
              }`}
            >
              {INTRO_PILLS.map((pill, idx) => {
                const isPopped = visiblePills.includes(idx);
                return (
                  <div
                    key={idx}
                    className={`px-5 py-2.5 rounded-full text-xs sm:text-sm font-medium text-center max-w-md transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)] ${
                      pill.isPrimary
                        ? 'bg-[#0F5132] dark:bg-[#1F6E4A] text-white font-semibold'
                        : 'bg-white dark:bg-[#181B19] text-slate-800 dark:text-[#ECEEED] border border-slate-200/80 dark:border-[#2A2F2C]'
                    } ${
                      isPopped
                        ? 'opacity-100 translate-y-0 scale-100'
                        : 'opacity-0 translate-y-4 scale-90 pointer-events-none'
                    }`}
                  >
                    <span>{pill.text}</span>
                  </div>
                );
              })}
            </div>

            {/* Stage 2: Morphing Logo Pill Bars & Label */}
            <div
              className={`absolute flex flex-col items-center gap-2 transition-all duration-700 ease-out ${
                introStage === 'morph'
                  ? 'opacity-100 scale-100 translate-y-0'
                  : 'opacity-0 scale-75 translate-y-4 pointer-events-none'
              }`}
            >
              <div className="flex flex-col items-center gap-[5px]">
                <div className="w-16 h-4 rounded-full bg-[#0F5132] dark:bg-[#1F6E4A] transition-transform duration-500" />
                <div className="w-10 h-4 rounded-full bg-[#3A7D8C] dark:bg-[#2D8A61] transition-transform duration-500" />
              </div>
              <span className="text-xs uppercase font-bold tracking-widest text-[#1E2430] dark:text-[#ECEEED] mt-1 font-mono">
                EVALDESK WORKSPACE
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Floating Replay Intro Trigger (Always available) */}
      <button
        type="button"
        onClick={runIntroSequence}
        className="fixed top-20 right-6 z-40 bg-white dark:bg-[#181B19] border border-slate-200/90 dark:border-[#2A2F2C] text-slate-700 dark:text-[#969E9A] hover:text-[#1E2430] dark:hover:text-[#ECEEED] hover:bg-slate-50 dark:hover:bg-[#202422] px-3.5 py-1.5 rounded-full text-xs font-medium transition-all flex items-center gap-1.5 cursor-pointer shadow-none dark:shadow-none hover:scale-105"
        title="Replay kinetic morph intro"
      >
        <RotateCcw className="w-3.5 h-3.5 text-[#0F5132] dark:text-[#7CC9A3]" />
        <span>Replay intro</span>
      </button>

      {/* =========================================================
          1. MINIMALIST TOP NAVIGATION HEADER (STRICTLY 4 ITEMS)
             + THEME TOGGLE ICON + FIXED SCROLL PROGRESS BAR (2.5px #0F5132)
          ========================================================= */}
      <header className="sticky top-0 w-full z-40 bg-[#F6F7F5] dark:bg-[#111312] border-b border-slate-200/70 dark:border-[#2A2F2C] transition-all relative">
        <div className="h-[72px] max-w-6xl mx-auto px-6 flex items-center justify-between">
          {/* Left: Two-pill stacked #0F5132 mark + EVALDESK wordmark */}
          <a
            href="#/home"
            className="flex items-center gap-2.5 focus:outline-none group"
            title="EvalDesk Academic Precision"
          >
            <div className="flex flex-col gap-[3px]">
              <div className="w-5 h-2 rounded-full bg-[#0F5132] dark:bg-[#1F6E4A] transition-transform group-hover:scale-105" />
              <div className="w-3.5 h-2 rounded-full bg-[#0D9488] dark:bg-[#3A7D8C] transition-transform group-hover:scale-105" />
            </div>
            <span className="text-base font-bold tracking-tight text-[#1E2430] dark:text-[#ECEEED] uppercase">
              EVALDESK
            </span>
          </a>

          {/* Center: ONLY two links — Home (active) and About Us */}
          <nav className="flex items-center gap-8" aria-label="Main Navigation">
            <a
              href="#/home"
              className="text-sm font-semibold text-[#1E2430] dark:text-[#ECEEED] transition-colors"
              aria-current="page"
            >
              Home
            </a>
            <button
              type="button"
              onClick={() => scrollToSection('about-us')}
              className="text-sm font-medium text-slate-500 dark:text-[#969E9A] hover:text-[#1E2430] dark:hover:text-[#ECEEED] transition-colors cursor-pointer"
            >
              About Us
            </button>
          </nav>

          {/* Right: Login, Sign Up & Compact Theme Switcher Button */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={toggleTheme}
              className="w-9 h-9 rounded-lg flex items-center justify-center text-[#4B5563] dark:text-[#969E9A] hover:bg-[#EAEEF5] dark:hover:bg-[#202422] hover:text-[#111827] dark:hover:text-[#ECEEED] transition cursor-pointer border border-transparent hover:border-[#E2E8E4] dark:hover:border-[#2F3532]"
              title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
              aria-label="Toggle theme appearance"
            >
              {theme === 'dark' ? (
                <Sun className="w-4 h-4 text-[#E5B567]" />
              ) : (
                <Moon className="w-4 h-4 text-[#4B5563]" />
              )}
            </button>
            <button
              type="button"
              onClick={() => {
                window.location.hash = '#/dashboard';
              }}
              className="bg-[#EAEEF5] hover:bg-[#dfe4ef] dark:bg-[#202422] dark:hover:bg-[#2F3532] text-[#1E2430] dark:text-[#ECEEED] rounded-lg px-4 py-2 text-sm font-medium transition-colors cursor-pointer border border-transparent dark:border-[#2F3532]"
            >
              Login
            </button>
            <button
              type="button"
              onClick={() => {
                window.location.hash = '#/upload';
              }}
              className="bg-[#0F5132] hover:bg-[#0B3D26] dark:bg-[#1F6E4A] dark:hover:bg-[#27855A] text-white rounded-lg px-4 py-2 text-sm font-semibold transition-colors cursor-pointer"
            >
              Sign Up
            </button>
          </div>
        </div>

        {/* Scroll Progress Bar (2.5px #0F5132, scales 0% to 100%) */}
        <div
          className="absolute bottom-0 left-0 h-[2.5px] bg-[#0F5132] dark:bg-[#1F6E4A] transition-all duration-75 ease-out"
          style={{ width: `${Math.round(scrollProgress * 100)}%` }}
          aria-hidden="true"
        />
      </header>

      {/* =========================================================
          2. HERO SECTION + 3-CARD INTERACTIVE UI DOCK
             (Curtain reveal: opacity-0 translate-y-6 -> opacity-100 translate-y-0)
          ========================================================= */}
      <section
        className={`w-full max-w-6xl mx-auto px-6 pt-12 sm:pt-16 pb-12 flex flex-col items-center text-center transition-all duration-700 ease-out ${
          heroRevealed ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
        }`}
      >
        {/* Top Badge */}
        <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-white dark:bg-[#181B19] border border-slate-200/90 dark:border-[#2A2F2C] mb-6 shadow-none dark:shadow-none">
          <span className="px-2 py-0.5 rounded-full bg-[#0F5132] dark:bg-[#1F6E4A] text-white text-[10px] font-bold uppercase tracking-wider">
            NEW
          </span>
          <span className="text-xs sm:text-sm text-slate-600 dark:text-[#969E9A] font-medium">
            Dual-Engine OCR &amp; 1–5 Rubric Calibration
          </span>
        </div>

        {/* Centered Headline */}
        <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-[#1E2430] dark:text-[#ECEEED] max-w-3xl mb-4 leading-[1.18]">
          Grade answer sheets with <span className="text-[#0F5132] dark:text-[#7CC9A3]">precision</span> without manual fatigue
        </h1>

        {/* Subtitle */}
        <p className="text-base sm:text-lg text-slate-600 dark:text-[#969E9A] max-w-2xl mb-8 leading-relaxed">
          Introducing an effortless way to scan handwritten booklets, verify rubrics, and export class results in seconds.
        </p>

        {/* CTAs */}
        <div className="flex flex-wrap items-center justify-center gap-3.5 mb-14">
          <button
            type="button"
            onClick={() => {
              window.location.hash = '#/upload';
            }}
            className="inline-flex items-center justify-center px-6 py-2.5 rounded-lg text-sm font-semibold text-white bg-[#0F5132] hover:bg-[#0B3D26] dark:bg-[#1F6E4A] dark:hover:bg-[#27855A] transition-all cursor-pointer shadow-none dark:shadow-none"
          >
            Sign up for free
          </button>
          <button
            type="button"
            onClick={() => scrollToSection('demo-stage')}
            className="inline-flex items-center justify-center px-5 py-2.5 rounded-lg text-sm font-medium text-[#1E2430] dark:text-[#ECEEED] bg-white hover:bg-slate-50 dark:bg-[#181B19] dark:hover:bg-[#202422] border border-slate-200/90 dark:border-[#2A2F2C] transition-all cursor-pointer gap-1.5 shadow-none dark:shadow-none"
          >
            <span>Watch Demo</span>
            <span className="text-xs">↓</span>
          </button>
        </div>

        {/* 3-Column Interactive Preview Dock (Staggered Rising Cards + Hover Lift) */}
        <div className="w-full grid grid-cols-1 md:grid-cols-3 gap-5 text-left items-stretch">
          {/* Card 1: Evaluation Setup Summary (delay-0) */}
          <div
            className={`flex flex-col justify-between bg-white dark:bg-[#181B19] rounded-xl p-5 border border-slate-200/80 dark:border-[#2A2F2C] shadow-none dark:shadow-none hover:-translate-y-1 transition-all duration-300 ${
              heroRevealed ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
            }`}
          >
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-1 border-b border-slate-100 dark:border-[#2F3532]">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-[#68706C]">
                  Evaluation Setup
                </span>
                <span className="w-6 h-6 rounded-full bg-slate-50 dark:bg-[#202422] flex items-center justify-center text-slate-400 dark:text-[#969E9A]">
                  <Sliders className="w-3.5 h-3.5" />
                </span>
              </div>

              <div>
                <h3 className="text-lg font-bold text-[#1E2430] dark:text-[#ECEEED]">Assessment Paper</h3>
                <p className="text-xs font-mono font-semibold text-[#0F5132] dark:text-[#7CC9A3] mt-0.5">
                  Roll No: SGSU250489
                </p>
              </div>

              <div className="space-y-2 pt-1 text-xs">
                <div className="flex items-center gap-2.5 p-2 rounded-lg bg-slate-50 dark:bg-[#202422] border border-slate-100 dark:border-[#2F3532]">
                  <FileText className="w-4 h-4 text-slate-500 dark:text-[#969E9A] shrink-0" />
                  <div className="flex flex-col min-w-0">
                    <span className="font-medium text-slate-800 dark:text-[#ECEEED] leading-none">Question Paper</span>
                    <span className="text-[11px] text-slate-500 dark:text-[#969E9A] font-mono mt-0.5 truncate">
                      OS_Exam.pdf
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2.5 p-2 rounded-lg bg-[#E8F3EE]/60 dark:bg-[#1A2B23] border border-[#0F5132]/10 dark:border-[#294236]">
                  <Sliders className="w-4 h-4 text-[#0F5132] dark:text-[#7CC9A3] shrink-0" />
                  <div className="flex flex-col min-w-0">
                    <span className="font-medium text-slate-800 dark:text-[#ECEEED] leading-none">
                      Strictness Calibration
                    </span>
                    <span className="text-[11px] text-[#0F5132] dark:text-[#7CC9A3] font-semibold mt-0.5">
                      3 / 5 Balanced
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2.5 p-2 rounded-lg bg-slate-50 dark:bg-[#202422] border border-slate-100 dark:border-[#2F3532]">
                  <School className="w-4 h-4 text-slate-500 dark:text-[#969E9A] shrink-0" />
                  <div className="flex flex-col min-w-0">
                    <span className="font-medium text-slate-800 dark:text-[#ECEEED] leading-none">Class Cohort</span>
                    <span className="text-[11px] text-slate-500 dark:text-[#969E9A] mt-0.5">
                      BCA 1st Sem • Sec A
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-5 pt-3 border-t border-slate-100 dark:border-[#2F3532] flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[#0F5132] dark:bg-[#7CC9A3] animate-pulse" />
                <span className="font-medium text-slate-700 dark:text-[#ECEEED]">Batch OCR Pipeline</span>
              </div>
              <span className="font-mono text-[11px] font-semibold text-slate-600 dark:text-[#969E9A] bg-slate-100 dark:bg-[#202422] border border-transparent dark:border-[#2F3532] px-2 py-0.5 rounded">
                9 of 9 Pages Read
              </span>
            </div>
          </div>

          {/* Card 2: Interactive Q.1 – Q.19 Matrix (delay-150) */}
          <div
            className={`flex flex-col justify-between bg-white dark:bg-[#181B19] rounded-xl p-5 border border-slate-200/80 dark:border-[#2A2F2C] shadow-none dark:shadow-none hover:-translate-y-1 transition-all duration-300 ${
              heroRevealed ? 'opacity-100 translate-y-0 delay-150' : 'opacity-0 translate-y-4'
            }`}
          >
            <div>
              <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-[#2F3532] mb-3">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-[#68706C]">
                  Question &amp; Page Matrix
                </span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={handlePrevQuestion}
                    disabled={activeQuestion <= 1}
                    className="w-6 h-6 rounded-full bg-slate-100 dark:bg-[#202422] hover:bg-slate-200 dark:hover:bg-[#2F3532] disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center text-slate-700 dark:text-[#ECEEED] transition-colors cursor-pointer"
                    title="Previous question"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </button>
                  <span className="font-mono text-xs font-semibold text-slate-700 dark:text-[#ECEEED] px-1">
                    Q.1 – Q.19
                  </span>
                  <button
                    type="button"
                    onClick={handleNextQuestion}
                    disabled={activeQuestion >= 19}
                    className="w-6 h-6 rounded-full bg-slate-100 dark:bg-[#202422] hover:bg-slate-200 dark:hover:bg-[#2F3532] disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center text-slate-700 dark:text-[#ECEEED] transition-colors cursor-pointer"
                    title="Next question"
                  >
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* 5-Column Grid with 19 interactive round buttons */}
              <div className="grid grid-cols-5 gap-1.5 pt-1">
                {Array.from({ length: 19 }, (_, i) => i + 1).map((qNum) => {
                  const isActive = qNum === activeQuestion;
                  const isPending = qNum === 19;
                  return (
                    <button
                      key={qNum}
                      type="button"
                      onClick={() => handleSelectQuestion(qNum)}
                      className={`h-8 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer flex items-center justify-center ${
                        isActive
                          ? 'bg-[#0F5132] dark:bg-[#1F6E4A] text-white scale-105 ring-1 ring-[#0F5132] dark:ring-[#1F6E4A]'
                          : isPending
                          ? 'bg-slate-50 dark:bg-[#202422] text-slate-400 dark:text-[#68706C] border border-dashed border-slate-200 dark:border-[#2F3532] hover:bg-slate-100 dark:hover:bg-[#2F3532]'
                          : 'bg-slate-100 dark:bg-[#202422] text-slate-700 dark:text-[#ECEEED] hover:bg-slate-200 dark:hover:bg-[#2F3532]'
                      }`}
                      title={`Select Q.${qNum}`}
                    >
                      {qNum}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="mt-5 pt-3 border-t border-slate-100 dark:border-[#2F3532] flex items-center justify-between text-xs text-slate-500 dark:text-[#969E9A] font-mono">
              <span>Allocated: 54 Marks</span>
              <span className="text-[#0F5132] dark:text-[#7CC9A3] font-semibold">18 Completed • 1 Pending</span>
            </div>
          </div>

          {/* Card 3: Active Question Rubric Pills (delay-300) */}
          <div
            className={`flex flex-col justify-between bg-white dark:bg-[#181B19] rounded-xl p-5 border border-slate-200/80 dark:border-[#2A2F2C] shadow-none dark:shadow-none hover:-translate-y-1 transition-all duration-300 ${
              heroRevealed ? 'opacity-100 translate-y-0 delay-300' : 'opacity-0 translate-y-4'
            }`}
          >
            <div>
              <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-[#2F3532] mb-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-[#68706C]">
                  Active Evaluation
                </span>
                <span className="text-[10px] font-semibold font-mono px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-[#1A2B23] dark:text-[#7CC9A3] dark:border-[#294236] flex items-center gap-1">
                  <Check className="w-3 h-3" />
                  <span>Verified</span>
                </span>
              </div>

              <div>
                <h3 className="text-base font-bold text-[#1E2430] dark:text-[#ECEEED]">{currentQData.title}</h3>
                <p className="text-xs text-slate-500 dark:text-[#969E9A] mt-0.5">{currentQData.sub}</p>
              </div>

              {/* Rubric Mark Pills Grid */}
              <div className="grid grid-cols-2 gap-2 mt-3">
                {currentQData.rubrics.map((r, idx) => (
                  <div
                    key={idx}
                    className="p-2 rounded-lg bg-slate-50 dark:bg-[#202422] border border-slate-100 dark:border-[#2F3532] flex flex-col justify-between"
                  >
                    <span
                      className={`font-mono text-xs font-bold ${
                        r.isNegative ? 'text-rose-600 dark:text-[#E57D8A]' : 'text-[#0F5132] dark:text-[#7CC9A3]'
                      }`}
                    >
                      {r.mark}
                    </span>
                    <span className="text-[11px] text-slate-600 dark:text-[#969E9A] leading-tight mt-0.5">
                      {r.desc}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-5 pt-3 border-t border-slate-100 dark:border-[#2F3532] flex items-center justify-between">
              <div className="flex flex-col">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-[#68706C]">
                  Awarded
                </span>
                <span className="text-xl font-bold font-mono text-[#1E2430] dark:text-[#ECEEED]">
                  {currentQData.score}{' '}
                  <span className="text-xs text-slate-400 dark:text-[#68706C] font-normal">
                    / {currentQData.maxScore}
                  </span>
                </span>
              </div>

              <button
                type="button"
                onClick={() => setIsApproved(!isApproved)}
                className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
                  isApproved
                    ? 'bg-[#0F5132] dark:bg-[#1F6E4A] text-white'
                    : 'bg-[#0F5132] hover:bg-[#0B3D26] dark:bg-[#1F6E4A] dark:hover:bg-[#27855A] text-white'
                }`}
              >
                <span>{isApproved ? 'Approved' : 'Approve'}</span>
                <Check className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================
          3. MULTI-DEVICE SHOWCASE SECTION (#device-suite)
             (Scroll-revealed straightening tilt & perspective scaling)
          ========================================================= */}
      <section id="device-suite" className="w-full max-w-6xl mx-auto px-6 py-16 scroll-mt-20">
        <ScrollReveal direction="up" delay={50}>
          <div className="flex flex-col items-center text-center mb-10">
            <span className="text-xs font-bold uppercase tracking-wider text-[#0F5132] dark:text-[#7CC9A3] mb-2">
              Ecosystem Architecture
            </span>
            <h2 className="text-3xl sm:text-4xl font-bold text-[#1E2430] dark:text-[#ECEEED] tracking-tight">
              Designed for every screen in your workflow
            </h2>
            <p className="text-sm sm:text-base text-slate-600 dark:text-[#969E9A] max-w-xl mt-2 leading-relaxed">
              Seamless handoff across batch submission tablets, high-throughput desktop grading, and mobile audit reviews.
            </p>

            {/* Interactive filter pills */}
            <div className="inline-flex items-center gap-1.5 p-1 bg-white dark:bg-[#181B19] border border-slate-200/90 dark:border-[#2A2F2C] rounded-full shadow-none dark:shadow-none mt-6">
              {(
                [
                  { id: 'all', label: 'All Devices', icon: Layers },
                  { id: 'laptop', label: 'Laptop', icon: Laptop },
                  { id: 'tablet', label: 'Tablet', icon: Tablet },
                  { id: 'mobile', label: 'Mobile', icon: Smartphone },
                ] as const
              ).map((filter) => {
                const Icon = filter.icon;
                const isActive = deviceFilter === filter.id;
                return (
                  <button
                    key={filter.id}
                    type="button"
                    onClick={() => setDeviceFilter(filter.id)}
                    className={`px-3.5 py-1.5 rounded-full text-xs font-medium transition-all cursor-pointer flex items-center gap-1.5 ${
                      isActive
                        ? 'bg-[#0F5132] dark:bg-[#1F6E4A] text-white shadow-none dark:shadow-none'
                        : 'text-slate-600 dark:text-[#969E9A] hover:text-[#1E2430] dark:hover:text-[#ECEEED] hover:bg-slate-50 dark:hover:bg-[#202422]'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span>{filter.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </ScrollReveal>

        {/* 3 Hardware Mockups Grid with Perspective Straightening */}
        <div className="w-full relative flex flex-col lg:flex-row items-center justify-center gap-6 pt-4">
          {/* MOCKUP 1: Tablet / iPad Mockup (Left - Tilt Straightening) */}
          {(deviceFilter === 'all' || deviceFilter === 'tablet') && (
            <ScrollReveal
              direction="tilt-left"
              delay={100}
              className={`w-full lg:w-[28%] transition-all duration-500 ${
                deviceFilter === 'tablet' ? 'lg:w-[48%] max-w-lg' : 'lg:max-w-[320px]'
              }`}
            >
              <div className="bg-[#1E2430] dark:bg-[#111312] p-2.5 rounded-[24px] border border-slate-700/60 dark:border-[#2A2F2C] flex flex-col shadow-none dark:shadow-none">
                {/* Tablet front camera dot */}
                <div className="w-2 h-2 rounded-full bg-slate-700 dark:bg-[#2A2F2C] mx-auto mb-2" />

                {/* Tablet Screen Content: Batch Upload & Live OCR Queue */}
                <div className="bg-white dark:bg-[#181B19] rounded-xl p-4 flex flex-col justify-between min-h-[360px] text-left border border-transparent dark:border-[#2A2F2C]">
                  <div>
                    <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-[#2F3532] mb-3">
                      <div className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-[#1F6E4A] dark:bg-[#7CC9A3]" />
                        <span className="text-[11px] font-bold text-[#1E2430] dark:text-[#ECEEED]">Tablet Ingestion</span>
                      </div>
                      <span className="text-[10px] font-mono text-slate-400 dark:text-[#68706C]">v2.4 Live</span>
                    </div>

                    {/* Batch OCR Feeder Tile */}
                    <div className="p-3 rounded-lg bg-[#E8F3EE]/70 dark:bg-[#1A2B23] border border-[#0F5132]/10 dark:border-[#294236] flex flex-col items-center text-center mb-3">
                      <div className="w-9 h-9 rounded-full bg-white dark:bg-[#181B19] text-[#0F5132] dark:text-[#7CC9A3] border border-transparent dark:border-[#2A2F2C] flex items-center justify-center mb-1.5">
                        <Scan className="w-5 h-5" />
                      </div>
                      <span className="text-xs font-bold text-[#1E2430] dark:text-[#ECEEED]">Batch OCR Feeder</span>
                      <span className="text-[10px] text-slate-500 dark:text-[#969E9A]">Camera / Flatbed Sync Active</span>
                    </div>

                    {/* Extracted Metadata Rows */}
                    <div className="space-y-1.5 text-xs">
                      <div className="p-2 rounded bg-slate-50 dark:bg-[#202422] border border-slate-100 dark:border-[#2F3532] flex justify-between items-center">
                        <span className="text-slate-500 dark:text-[#969E9A]">Student:</span>
                        <span className="font-semibold text-slate-800 dark:text-[#ECEEED]">Aarav M. Sharma</span>
                      </div>
                      <div className="p-2 rounded bg-slate-50 dark:bg-[#202422] border border-slate-100 dark:border-[#2F3532] flex justify-between items-center">
                        <span className="text-slate-500 dark:text-[#969E9A]">Roll No:</span>
                        <span className="font-mono font-semibold text-[#0F5132] dark:text-[#7CC9A3]">SGSU250489</span>
                      </div>
                      <div className="p-2 rounded bg-slate-50 dark:bg-[#202422] border border-slate-100 dark:border-[#2F3532] flex justify-between items-center">
                        <span className="text-slate-500 dark:text-[#969E9A]">Class:</span>
                        <span className="font-semibold text-slate-800 dark:text-[#ECEEED]">BCA 1st Sem • Sec A</span>
                      </div>
                    </div>
                  </div>

                  {/* Live Page Scanning Strip */}
                  <div className="mt-4 pt-3 border-t border-slate-100 dark:border-[#2F3532]">
                    <div className="flex items-center justify-between text-[11px] mb-1.5">
                      <span className="font-medium text-slate-700 dark:text-[#969E9A]">Page 3 of 9 · Scanning...</span>
                      <span className="font-mono text-[#0F5132] dark:text-[#7CC9A3] font-bold">300 DPI</span>
                    </div>
                    <div className="w-full h-1.5 rounded-full bg-slate-100 dark:bg-[#202422] overflow-hidden">
                      <div className="h-full bg-[#0F5132] dark:bg-[#1F6E4A] rounded-full animate-pulse w-3/5" />
                    </div>
                  </div>
                </div>
              </div>
            </ScrollReveal>
          )}

          {/* MOCKUP 2: Laptop / MacBook Mockup (Center, Primary Scale) */}
          {(deviceFilter === 'all' || deviceFilter === 'laptop') && (
            <ScrollReveal
              direction="zoom"
              delay={0}
              className={`w-full transition-all duration-500 ${
                deviceFilter === 'laptop'
                  ? 'lg:w-[78%] max-w-3xl'
                  : 'lg:w-[46%] max-w-xl z-10'
              }`}
            >
              {/* Laptop Screen Frame */}
              <div className="bg-[#1E2430] dark:bg-[#111312] p-2.5 rounded-t-2xl border border-slate-700/60 dark:border-[#2A2F2C] flex flex-col shadow-none dark:shadow-none">
                {/* Laptop Camera Dot */}
                <div className="w-1.5 h-1.5 rounded-full bg-slate-700 dark:bg-[#2A2F2C] mx-auto mb-1.5" />

                {/* Laptop Internal Screen Area */}
                <div className="bg-white dark:bg-[#181B19] rounded-lg p-3 flex flex-col gap-2 min-h-[350px] text-left border border-transparent dark:border-[#2A2F2C]">
                  {/* Window Top Bar */}
                  <div className="flex items-center justify-between pb-1.5 border-b border-slate-100 dark:border-[#2F3532] text-[10px]">
                    <div className="flex items-center gap-1.5">
                      <div className="w-2.5 h-2.5 rounded-full bg-rose-500/80" />
                      <div className="w-2.5 h-2.5 rounded-full bg-amber-400/80" />
                      <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/80" />
                    </div>
                    <span className="font-mono text-slate-500 dark:text-[#68706C] truncate max-w-[200px]">
                      evaldesk.workspace / exam / Q4_eval
                    </span>
                    <span className="font-mono font-bold text-[#0F5132] dark:text-[#7CC9A3] bg-[#E8F3EE] dark:bg-[#1A2B23] px-1.5 py-0.5 rounded border border-[#0F5132]/20 dark:border-[#294236]">
                      100% OCR CONFIDENCE
                    </span>
                  </div>

                  {/* 2-Pane Evaluation Workspace */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 flex-1">
                    {/* Left Sub-Pane: Ruled Handwriting Sheet Crop */}
                    <div className="bg-slate-50 dark:bg-[#202422] rounded-lg p-2.5 border border-slate-200/80 dark:border-[#2F3532] flex flex-col justify-between">
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-[#969E9A]">
                            Sheet Scan · Page 3
                          </span>
                          <span className="text-[9px] font-mono bg-white dark:bg-[#181B19] px-1.5 py-0.5 rounded border border-slate-200 dark:border-[#2F3532] text-slate-600 dark:text-[#ECEEED]">
                            300 DPI
                          </span>
                        </div>

                        {/* Crop Box with Emerald Q.4 DETECTED CROP */}
                        <div className="relative bg-white dark:bg-[#181B19] rounded p-2.5 border-2 border-[#0F5132]/80 dark:border-[#1F6E4A] mt-1">
                          <div className="absolute -top-2 left-2 px-1 bg-[#0F5132] dark:bg-[#1F6E4A] text-white font-mono text-[8px] font-bold rounded">
                            Q.4 DETECTED CROP
                          </div>
                          <p className="text-[11px] font-serif italic text-slate-800 dark:text-[#ECEEED] leading-snug">
                            "An absolute path begins from the root directory (/), while a relative path starts from the current working dir..."
                          </p>
                        </div>
                      </div>

                      <span className="text-[9px] font-mono text-slate-400 dark:text-[#68706C] mt-2 block">
                        Bounding box: [X:142, Y:890, W:720, H:240]
                      </span>
                    </div>

                    {/* Right Sub-Pane: OCR Detected & Marks Breakdown */}
                    <div className="bg-slate-50 dark:bg-[#202422] rounded-lg p-2.5 border border-slate-200/80 dark:border-[#2F3532] flex flex-col justify-between text-xs">
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-700 dark:text-[#ECEEED]">
                            1. OCR Detected
                          </span>
                          <span className="text-[9px] font-mono font-semibold text-[#0F5132] dark:text-[#7CC9A3] bg-[#E8F3EE] dark:bg-[#1A2B23] border border-[#C8E3D5] dark:border-[#294236] px-1 rounded">
                            Exact Match
                          </span>
                        </div>

                        <div className="p-2 rounded bg-white dark:bg-[#181B19] border border-slate-200 dark:border-[#2F3532] text-[10px] font-mono text-slate-700 dark:text-[#ECEEED] leading-relaxed mb-2">
                          <div>Absolute Path: starts from '/'</div>
                          <div>Relative Path: cwd-dependent.</div>
                          <div>Example: cd /var/log vs cd ../</div>
                        </div>

                        <div className="space-y-1 text-[11px]">
                          <div className="flex justify-between text-slate-600 dark:text-[#969E9A]">
                            <span>Theory Concept:</span>
                            <span className="font-mono font-bold text-[#0F5132] dark:text-[#7CC9A3]">2.0 / 2.0</span>
                          </div>
                          <div className="flex justify-between text-slate-600 dark:text-[#969E9A]">
                            <span>Syntax Verbatim:</span>
                            <span className="font-mono font-bold text-[#0F5132] dark:text-[#7CC9A3]">2.0 / 2.0</span>
                          </div>
                          <div className="flex justify-between text-slate-600 dark:text-[#969E9A]">
                            <span>Terminal Example:</span>
                            <span className="font-mono font-bold text-[#0F5132] dark:text-[#7CC9A3]">1.5 / 2.0</span>
                          </div>
                        </div>
                      </div>

                      <div className="pt-2 border-t border-slate-200 dark:border-[#2F3532] flex items-center justify-between">
                        <span className="text-[11px] font-semibold text-slate-800 dark:text-[#ECEEED]">Total Awarded</span>
                        <span className="font-mono text-xs font-bold text-[#0F5132] dark:text-[#7CC9A3]">
                          5.5 / 6.0 M
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Laptop Matte Dark Base */}
              <div className="rounded-b-xl bg-slate-300 dark:bg-[#202422] border-t border-slate-400/20 dark:border-[#2F3532] h-3 w-[104%] -ml-[2%] relative flex justify-center items-start">
                <div className="w-16 h-1 bg-slate-400 dark:bg-[#2A2F2C] rounded-b" />
              </div>
            </ScrollReveal>
          )}

          {/* MOCKUP 3: Mobile Phone Mockup (Right - Tilt Straightening) */}
          {(deviceFilter === 'all' || deviceFilter === 'mobile') && (
            <ScrollReveal
              direction="tilt-right"
              delay={200}
              className={`w-full lg:w-[26%] transition-all duration-500 ${
                deviceFilter === 'mobile' ? 'lg:w-[40%] max-w-sm' : 'lg:max-w-[260px]'
              }`}
            >
              <div className="bg-[#1E2430] dark:bg-[#111312] p-2 rounded-[28px] border border-slate-700/60 dark:border-[#2A2F2C] flex flex-col shadow-none dark:shadow-none">
                {/* Mobile top speaker notch */}
                <div className="w-12 h-1 bg-slate-700 dark:bg-[#2A2F2C] rounded-full mx-auto mb-2" />

                {/* Mobile Screen Content: Mobile Student Result Card */}
                <div className="bg-white dark:bg-[#181B19] rounded-[20px] p-3.5 flex flex-col justify-between min-h-[360px] text-left border border-transparent dark:border-[#2A2F2C]">
                  <div>
                    <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-[#2F3532] mb-2.5">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-[#969E9A]">
                        Mobile Audit
                      </span>
                      <span className="w-2 h-2 rounded-full bg-[#0F5132] dark:bg-[#7CC9A3]" />
                    </div>

                    {/* Score summary card */}
                    <div className="p-3 rounded-xl bg-slate-50 dark:bg-[#202422] border border-slate-100 dark:border-[#2F3532] text-center mb-3">
                      <span className="text-[10px] uppercase font-mono tracking-wider text-slate-500 dark:text-[#969E9A]">
                        Final Audit Total
                      </span>
                      <div className="text-xl font-bold font-mono text-[#1E2430] dark:text-[#ECEEED] mt-0.5">
                        44.5 <span className="text-xs font-normal text-slate-400 dark:text-[#68706C]">/ 54</span>
                      </div>
                      <span className="inline-block text-[11px] font-bold text-[#0F5132] dark:text-[#7CC9A3] bg-[#E8F3EE] dark:bg-[#1A2B23] px-2 py-0.5 rounded-full mt-1 border border-[#0F5132]/10 dark:border-[#294236]">
                        82.4% • Grade A
                      </span>
                    </div>

                    {/* Subject Breakdown Rows */}
                    <div className="space-y-1.5 text-xs">
                      <div className="p-2 rounded-lg bg-slate-50 dark:bg-[#202422] flex items-center justify-between border border-slate-100 dark:border-[#2F3532]">
                        <span className="text-slate-700 dark:text-[#ECEEED] truncate pr-1">Operating Systems</span>
                        <span className="font-mono font-bold text-[#0F5132] dark:text-[#7CC9A3]">18/20</span>
                      </div>
                      <div className="p-2 rounded-lg bg-slate-50 dark:bg-[#202422] flex items-center justify-between border border-slate-100 dark:border-[#2F3532]">
                        <span className="text-slate-700 dark:text-[#ECEEED] truncate pr-1">Data Structures</span>
                        <span className="font-mono font-bold text-[#0F5132] dark:text-[#7CC9A3]">16/20</span>
                      </div>
                      <div className="p-2 rounded-lg bg-slate-50 dark:bg-[#202422] flex items-center justify-between border border-slate-100 dark:border-[#2F3532]">
                        <span className="text-slate-700 dark:text-[#ECEEED] truncate pr-1">Database Systems</span>
                        <span className="font-mono font-bold text-[#0F5132] dark:text-[#7CC9A3]">10.5/14</span>
                      </div>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-100 dark:border-[#2F3532] flex items-center justify-between text-[11px]">
                    <span className="text-slate-500 dark:text-[#969E9A]">AI Strictness:</span>
                    <span className="font-semibold text-slate-800 dark:text-[#ECEEED]">Level 3 (Balanced)</span>
                  </div>

                  {/* Download PDF button */}
                  <button
                    type="button"
                    onClick={() => {
                      window.location.hash = '#/dashboard';
                    }}
                    className="w-full mt-3 py-2 rounded-lg bg-[#0F5132] hover:bg-[#0B3D26] dark:bg-[#1F6E4A] dark:hover:bg-[#27855A] text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download PDF</span>
                  </button>
                </div>
              </div>
            </ScrollReveal>
          )}
        </div>
      </section>

      {/* =========================================================
          4. VIDEO DEMO SECTION (#demo-stage)
             (Scroll-revealed widescreen browser cinema frame)
          ========================================================= */}
      <section id="demo-stage" className="w-full max-w-6xl mx-auto px-6 py-16 scroll-mt-20">
        <ScrollReveal direction="up" delay={50}>
          <div className="flex flex-col items-center text-center mb-10">
            <span className="text-xs font-bold uppercase tracking-wider text-[#0F5132] mb-2">
              Live Execution Pipeline
            </span>
            <h2 className="text-3xl sm:text-4xl font-bold text-[#1E2430] tracking-tight">
              Watch a booklet go from scan to graded report
            </h2>
            <p className="text-sm sm:text-base text-slate-600 max-w-lg mt-2 leading-relaxed">
              Continuous OCR handwriting segmentation coupled directly to your course criteria.
            </p>
          </div>
        </ScrollReveal>

        {/* Cinema Card Container with Zoom Reveal */}
        <ScrollReveal direction="zoom" duration={700}>
          <div className="rounded-2xl border border-slate-200/90 dark:border-[#2A2F2C] bg-white dark:bg-[#181B19] p-4 sm:p-6 shadow-none dark:shadow-none max-w-5xl mx-auto flex flex-col gap-4">
            {/* Browser / Player Top Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-[#2F3532]">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-rose-400/80" />
                <div className="w-3 h-3 rounded-full bg-amber-400/80" />
                <div className="w-3 h-3 rounded-full bg-emerald-400/80" />
              </div>

              <div className="flex-1 max-w-md mx-auto hidden sm:flex items-center justify-center px-3 py-1 bg-slate-50 dark:bg-[#202422] border border-slate-200 dark:border-[#2F3532] rounded-md text-xs font-mono text-slate-600 dark:text-[#969E9A]">
                <span className="text-slate-400 dark:text-[#68706C] mr-1">https://</span>
                <span>evaldesk.com/Answer-Sheet-Evaluation-Portal</span>
              </div>

              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#E8F3EE] dark:bg-[#1A2B23] border border-[#0F5132]/20 dark:border-[#294236] text-[#0F5132] dark:text-[#7CC9A3] text-xs font-semibold">
                  <span className="w-2 h-2 rounded-full bg-[#0F5132] dark:bg-[#7CC9A3] animate-pulse" />
                  <span>Live Product Walkthrough (0:10)</span>
                </span>
              </div>
            </div>

            {/* Real HTML5 Video Element */}
            <div className="relative rounded-xl overflow-hidden bg-slate-950 aspect-video shadow-none group">
              <video
                ref={videoRef}
                src="/demo/evaldesk-demo.mp4"
                autoPlay
                loop
                muted
                playsInline
                controls
                onTimeUpdate={handleTimeUpdate}
                className="w-full h-full object-cover rounded-xl"
              />
            </div>

            {/* Clickable Chapter Buttons below video (Staggered) */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
              {CHAPTERS.map((ch, idx) => {
                const isCurrent =
                  (idx === 0 && videoTime < 5) ||
                  (idx === 1 && videoTime >= 5 && videoTime < 7) ||
                  (idx === 2 && videoTime >= 7);

                return (
                  <button
                    key={ch.id}
                    type="button"
                    onClick={() => handleSeek(ch.time)}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex items-center justify-between ${
                      isCurrent
                        ? 'bg-[#E8F3EE] dark:bg-[#1A2B23] border-[#0F5132] dark:border-[#294236] text-[#0F5132] dark:text-[#7CC9A3]'
                        : 'bg-slate-50 dark:bg-[#202422] hover:bg-slate-100 dark:hover:bg-[#2F3532] border-slate-200/80 dark:border-[#2F3532] text-slate-700 dark:text-[#ECEEED]'
                    }`}
                  >
                    <div className="flex flex-col">
                      <span className="text-xs font-bold">{ch.label}</span>
                      <span className="text-[11px] text-slate-500 dark:text-[#969E9A] font-mono mt-0.5">
                        Seek to {ch.tag}
                      </span>
                    </div>
                    <Play className={`w-3.5 h-3.5 ${isCurrent ? 'text-[#0F5132] dark:text-[#7CC9A3]' : 'text-slate-400 dark:text-[#68706C]'}`} />
                  </button>
                );
              })}
            </div>

            {/* Strictness calibration preview interactive bar */}
            <div className="mt-2 p-4 rounded-xl bg-slate-50 dark:bg-[#202422] border border-slate-200/80 dark:border-[#2F3532] flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="flex flex-col">
                <span className="text-xs font-bold uppercase tracking-wider text-[#1E2430] dark:text-[#ECEEED]">
                  Calibrate Evaluation Strictness
                </span>
                <span className="text-xs text-slate-500 dark:text-[#969E9A] mt-0.5">
                  Current Threshold:{' '}
                  <strong className="text-[#0F5132] dark:text-[#7CC9A3] font-medium">
                    {strictnessLabels[strictnessLevel]}
                  </strong>
                </span>
              </div>

              <div className="flex items-center gap-1.5 flex-wrap">
                {[1, 2, 3, 4, 5].map((lvl) => (
                  <button
                    key={lvl}
                    type="button"
                    onClick={() => setStrictnessLevel(lvl)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer ${
                      strictnessLevel === lvl
                        ? 'bg-[#0F5132] dark:bg-[#1F6E4A] text-white shadow-none dark:shadow-none'
                        : 'bg-white dark:bg-[#181B19] hover:bg-slate-100 dark:hover:bg-[#2F3532] text-slate-700 dark:text-[#ECEEED] border border-slate-200 dark:border-[#2F3532]'
                    }`}
                  >
                    {lvl}: {lvl === 1 ? 'Lenient' : lvl === 2 ? 'Mild' : lvl === 3 ? 'Balanced' : lvl === 4 ? 'Rigorous' : 'Exact'}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </ScrollReveal>
      </section>

      {/* =========================================================
          5. SCROLL-REVEALED MAJOR FEATURES (4 ALTERNATING ROWS)
             (Sliding text and cards from alternating sides)
          ========================================================= */}
      <section className="w-full max-w-6xl mx-auto px-6 py-16 flex flex-col gap-16">
        {/* Feature Row 1: Auto-Fill Student Identity & Exam Details */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-10 items-center">
          <ScrollReveal direction="left" delay={50} className="space-y-3 text-left">
            <span className="text-xs font-bold uppercase tracking-wider text-[#0F5132] dark:text-[#7CC9A3]">
              01 / Metadata Ingestion
            </span>
            <h3 className="text-2xl sm:text-3xl font-bold text-[#1E2430] dark:text-[#ECEEED] tracking-tight">
              Auto-Fill Student Identity &amp; Exam Details
            </h3>
            <p className="text-sm sm:text-base text-slate-600 dark:text-[#969E9A] leading-relaxed">
              Eliminate hours of manual booklet sorting. EvalDesk’s OCR instantly isolates barcode identifiers, university roll numbers, course codes, and section numbers right from the cover sheet.
            </p>
            <div className="flex flex-wrap items-center gap-4 pt-2">
              <div className="flex items-center gap-1.5 text-xs font-medium text-slate-700 dark:text-[#ECEEED]">
                <CheckCircle2 className="w-4 h-4 text-[#0F5132] dark:text-[#7CC9A3]" />
                <span>Sub-second Roll Resolution</span>
              </div>
              <div className="flex items-center gap-1.5 text-xs font-medium text-slate-700 dark:text-[#ECEEED]">
                <CheckCircle2 className="w-4 h-4 text-[#0F5132] dark:text-[#7CC9A3]" />
                <span>Zero Roster Discrepancies</span>
              </div>
            </div>
          </ScrollReveal>

          <ScrollReveal direction="right" delay={150}>
            <div className="bg-white dark:bg-[#181B19] rounded-2xl p-6 border border-slate-200/90 dark:border-[#2A2F2C] shadow-none dark:shadow-none">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-[#2F3532] mb-4">
                <span className="text-xs font-bold uppercase tracking-wider text-[#1E2430] dark:text-[#ECEEED]">
                  Auto-Extraction Matrix
                </span>
                <span className="font-mono text-xs font-bold text-[#0F5132] dark:text-[#7CC9A3] bg-[#E8F3EE] dark:bg-[#1A2B23] border border-[#0F5132]/20 dark:border-[#294236] px-2 py-0.5 rounded">
                  PASSED
                </span>
              </div>
              <div className="space-y-2 text-xs">
                <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-[#202422] border border-slate-100 dark:border-[#2F3532] flex justify-between items-center">
                  <span className="text-slate-500 dark:text-[#969E9A]">Student Full Name:</span>
                  <span className="font-semibold text-slate-900 dark:text-[#ECEEED]">Aarav M. Sharma</span>
                </div>
                <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-[#202422] border border-slate-100 dark:border-[#2F3532] flex justify-between items-center">
                  <span className="text-slate-500 dark:text-[#969E9A]">Enrolment ID:</span>
                  <span className="font-mono font-semibold text-[#0F5132] dark:text-[#7CC9A3]">SGSU250489</span>
                </div>
                <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-[#202422] border border-slate-100 dark:border-[#2F3532] flex justify-between items-center">
                  <span className="text-slate-500 dark:text-[#969E9A]">Examination:</span>
                  <span className="font-semibold text-slate-900 dark:text-[#ECEEED]">Operating Systems MST-1</span>
                </div>
                <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-[#202422] border border-slate-100 dark:border-[#2F3532] flex justify-between items-center">
                  <span className="text-slate-500 dark:text-[#969E9A]">Seat Allocation:</span>
                  <span className="font-mono font-semibold text-slate-800 dark:text-[#ECEEED]">Hall B • Desk 14</span>
                </div>
              </div>
            </div>
          </ScrollReveal>
        </div>

        {/* Feature Row 2: Live Book-Flip OCR Progress */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-10 items-center">
          <ScrollReveal direction="left" delay={150} className="order-2 md:order-1">
            <div className="bg-white dark:bg-[#181B19] rounded-2xl p-6 border border-slate-200/90 dark:border-[#2A2F2C] shadow-none dark:shadow-none">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-[#2F3532] mb-4">
                <span className="text-xs font-bold uppercase tracking-wider text-[#1E2430] dark:text-[#ECEEED]">
                  Live Feed Telemetry
                </span>
                <span className="font-mono text-xs font-bold text-[#0F5132] dark:text-[#7CC9A3] bg-[#E8F3EE] dark:bg-[#1A2B23] border border-[#0F5132]/20 dark:border-[#294236] px-2 py-0.5 rounded flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#0F5132] dark:bg-[#7CC9A3] animate-pulse" />
                  <span>STREAMING</span>
                </span>
              </div>
              <div className="space-y-2 text-xs">
                <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-[#202422] border border-slate-100 dark:border-[#2F3532] flex items-center justify-between">
                  <span className="font-medium text-slate-800 dark:text-[#ECEEED]">Sheet 1: Cover Header</span>
                  <span className="font-mono text-[#0F5132] dark:text-[#7CC9A3] font-bold">98.4% Confidence</span>
                </div>
                <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-[#202422] border border-slate-100 dark:border-[#2F3532] flex items-center justify-between">
                  <span className="font-medium text-slate-800 dark:text-[#ECEEED]">Sheet 2: Question 1 – 3</span>
                  <span className="font-mono text-[#0F5132] dark:text-[#7CC9A3] font-bold">96.2% Confidence</span>
                </div>
                <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-[#202422] border border-slate-100 dark:border-[#2F3532] flex items-center justify-between">
                  <span className="font-medium text-slate-800 dark:text-[#ECEEED]">Sheet 3: Question 4 (Diagram)</span>
                  <span className="font-mono text-[#0F5132] dark:text-[#7CC9A3] font-bold">99.1% Confidence</span>
                </div>
                <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-[#202422] border border-slate-100 dark:border-[#2F3532] flex items-center justify-between">
                  <span className="font-medium text-slate-800 dark:text-[#ECEEED]">Sheet 4: Question 5 – 6</span>
                  <span className="font-mono text-slate-400 dark:text-[#68706C]">Scanning...</span>
                </div>
              </div>
            </div>
          </ScrollReveal>

          <ScrollReveal direction="right" delay={50} className="order-1 md:order-2 space-y-3 text-left">
            <span className="text-xs font-bold uppercase tracking-wider text-[#0F5132] dark:text-[#7CC9A3]">
              02 / Dual-Engine Vision
            </span>
            <h3 className="text-2xl sm:text-3xl font-bold text-[#1E2430] dark:text-[#ECEEED] tracking-tight">
              Live Book-Flip OCR Progress
            </h3>
            <p className="text-sm sm:text-base text-slate-600 dark:text-[#969E9A] leading-relaxed">
              Handle messy handwriting, strikethroughs, and varied ink types. EvalDesk applies dual-pass tokenization to transcribe and index each question’s boundary without destroying the student’s original visual context.
            </p>
            <div className="flex flex-wrap items-center gap-4 pt-2">
              <div className="flex items-center gap-1.5 text-xs font-medium text-slate-700 dark:text-[#ECEEED]">
                <CheckCircle2 className="w-4 h-4 text-[#0F5132] dark:text-[#7CC9A3]" />
                <span>Cursive &amp; Print Adaptation</span>
              </div>
              <div className="flex items-center gap-1.5 text-xs font-medium text-slate-700 dark:text-[#ECEEED]">
                <CheckCircle2 className="w-4 h-4 text-[#0F5132] dark:text-[#7CC9A3]" />
                <span>Instant Strikethrough Omission</span>
              </div>
            </div>
          </ScrollReveal>
        </div>

        {/* Feature Row 3: Split-Screen Evaluation & Collapsible Question Rail */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-10 items-center">
          <ScrollReveal direction="left" delay={50} className="space-y-3 text-left">
            <span className="text-xs font-bold uppercase tracking-wider text-[#0F5132] dark:text-[#7CC9A3]">
              03 / Ergonomic Grading
            </span>
            <h3 className="text-2xl sm:text-3xl font-bold text-[#1E2430] dark:text-[#ECEEED] tracking-tight">
              Split-Screen Evaluation &amp; Collapsible Question Rail
            </h3>
            <p className="text-sm sm:text-base text-slate-600 dark:text-[#969E9A] leading-relaxed">
              Grading should never require 10 open browser tabs. View the raw handwriting on your left, the verified OCR transcript in the center, and rubrics on the right. Keyboard shortcuts allow grading whole sets in one continuous flow.
            </p>
            <div className="flex flex-wrap items-center gap-4 pt-2">
              <div className="flex items-center gap-1.5 text-xs font-medium text-slate-700 dark:text-[#ECEEED]">
                <CheckCircle2 className="w-4 h-4 text-[#0F5132] dark:text-[#7CC9A3]" />
                <span>Rapid Keyboard Navigation</span>
              </div>
              <div className="flex items-center gap-1.5 text-xs font-medium text-slate-700 dark:text-[#ECEEED]">
                <CheckCircle2 className="w-4 h-4 text-[#0F5132] dark:text-[#7CC9A3]" />
                <span>Anchored Sticky Scoring</span>
              </div>
            </div>
          </ScrollReveal>

          <ScrollReveal direction="right" delay={150}>
            <div className="bg-white dark:bg-[#181B19] rounded-2xl p-6 border border-slate-200/90 dark:border-[#2A2F2C] shadow-none dark:shadow-none">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-[#2F3532] mb-4">
                <span className="text-xs font-bold uppercase tracking-wider text-[#1E2430] dark:text-[#ECEEED]">
                  Rubric Breakdown • Q.7
                </span>
                <span className="font-mono text-xs font-semibold text-slate-500 dark:text-[#969E9A]">Max: 10.0 M</span>
              </div>
              <div className="space-y-2 text-xs">
                <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-[#202422] border border-slate-100 dark:border-[#2F3532] flex justify-between items-center">
                  <span className="font-medium text-slate-800 dark:text-[#ECEEED]">1. Process Synchronization Logic</span>
                  <span className="font-mono font-bold text-[#0F5132] dark:text-[#7CC9A3]">4.0 / 4.0</span>
                </div>
                <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-[#202422] border border-slate-100 dark:border-[#2F3532] flex justify-between items-center">
                  <span className="font-medium text-slate-800 dark:text-[#ECEEED]">2. Mutex Semaphore Explanation</span>
                  <span className="font-mono font-bold text-[#0F5132] dark:text-[#7CC9A3]">3.5 / 4.0</span>
                </div>
                <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-[#202422] border border-slate-100 dark:border-[#2F3532] flex justify-between items-center">
                  <span className="font-medium text-slate-800 dark:text-[#ECEEED]">3. Race Condition Edge Case</span>
                  <span className="font-mono font-bold text-rose-600 dark:text-[#E57D8A]">1.0 / 2.0</span>
                </div>
              </div>
              <div className="pt-3 mt-3 border-t border-slate-100 dark:border-[#2F3532] flex justify-between items-center text-xs">
                <span className="font-semibold text-slate-800 dark:text-[#ECEEED]">Calculated Score</span>
                <span className="font-mono font-bold text-sm text-[#1E2430] dark:text-[#ECEEED]">8.5 / 10.0 Marks</span>
              </div>
            </div>
          </ScrollReveal>
        </div>

        {/* Feature Row 4: Dashboard Analytics & One-Click Class Reports */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-10 items-center">
          <ScrollReveal direction="left" delay={150} className="order-2 md:order-1">
            <div className="bg-white dark:bg-[#181B19] rounded-2xl p-6 border border-slate-200/90 dark:border-[#2A2F2C] shadow-none dark:shadow-none">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-[#2F3532] mb-4">
                <span className="text-xs font-bold uppercase tracking-wider text-[#1E2430] dark:text-[#ECEEED]">
                  Cohort Analytics Overview
                </span>
                <span className="font-mono text-xs font-bold text-[#0F5132] dark:text-[#7CC9A3]">N = 48 STUDENTS</span>
              </div>

              {/* Minimal Cohort Distribution Chart with smooth expansion transitions */}
              <div className="w-full h-28 flex items-end justify-between gap-3 pt-2 px-3 bg-slate-50 dark:bg-[#202422] border border-slate-100 dark:border-[#2F3532] rounded-xl">
                <div className="flex flex-col items-center gap-1 w-full">
                  <div className="w-full bg-[#0F5132]/25 dark:bg-[#2D8A61]/25 rounded-t h-8 transition-all duration-700 hover:bg-[#0F5132]/40" />
                  <span className="font-mono text-[10px] text-slate-500 dark:text-[#969E9A]">0-40%</span>
                </div>
                <div className="flex flex-col items-center gap-1 w-full">
                  <div className="w-full bg-[#0F5132]/45 dark:bg-[#2D8A61]/45 rounded-t h-14 transition-all duration-700 hover:bg-[#0F5132]/60" />
                  <span className="font-mono text-[10px] text-slate-500 dark:text-[#969E9A]">41-60%</span>
                </div>
                <div className="flex flex-col items-center gap-1 w-full">
                  <div className="w-full bg-[#0F5132] dark:bg-[#2D8A61] rounded-t h-20 transition-all duration-700 hover:scale-105" />
                  <span className="font-mono text-[10px] text-[#0F5132] dark:text-[#7CC9A3] font-bold">61-80%</span>
                </div>
                <div className="flex flex-col items-center gap-1 w-full">
                  <div className="w-full bg-[#0F5132]/70 dark:bg-[#2D8A61]/70 rounded-t h-12 transition-all duration-700 hover:bg-[#0F5132]/85" />
                  <span className="font-mono text-[10px] text-slate-500 dark:text-[#969E9A]">81-100%</span>
                </div>
              </div>

              <div className="flex items-center justify-between pt-3 mt-2 text-xs">
                <span className="text-slate-600 dark:text-[#969E9A]">
                  Class Average: <strong className="font-mono text-[#1E2430] dark:text-[#ECEEED]">73.8%</strong>
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      window.location.hash = '#/reports';
                    }}
                    className="px-2.5 py-1 rounded bg-slate-100 dark:bg-[#202422] hover:bg-slate-200 dark:hover:bg-[#2F3532] text-slate-700 dark:text-[#ECEEED] text-xs font-medium transition-colors cursor-pointer border border-transparent dark:border-[#2F3532]"
                  >
                    Export .XLSX
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      window.location.hash = '#/reports';
                    }}
                    className="px-2.5 py-1 rounded bg-slate-100 dark:bg-[#202422] hover:bg-slate-200 dark:hover:bg-[#2F3532] text-slate-700 dark:text-[#ECEEED] text-xs font-medium transition-colors cursor-pointer border border-transparent dark:border-[#2F3532]"
                  >
                    Export PDF
                  </button>
                </div>
              </div>
            </div>
          </ScrollReveal>

          <ScrollReveal direction="right" delay={50} className="order-1 md:order-2 space-y-3 text-left">
            <span className="text-xs font-bold uppercase tracking-wider text-[#0F5132] dark:text-[#7CC9A3]">
              04 / Institutional Governance
            </span>
            <h3 className="text-2xl sm:text-3xl font-bold text-[#1E2430] dark:text-[#ECEEED] tracking-tight">
              Dashboard Analytics &amp; One-Click Class Reports
            </h3>
            <p className="text-sm sm:text-base text-slate-600 dark:text-[#969E9A] leading-relaxed">
              Export accreditation-ready tabulation sheets instantly. Discover which specific questions caused confusion across the cohort with automated rubric deviation flags.
            </p>
            <div className="flex flex-wrap items-center gap-4 pt-2">
              <div className="flex items-center gap-1.5 text-xs font-medium text-slate-700 dark:text-[#ECEEED]">
                <CheckCircle2 className="w-4 h-4 text-[#0F5132] dark:text-[#7CC9A3]" />
                <span>Full Historical Audit Trail</span>
              </div>
              <div className="flex items-center gap-1.5 text-xs font-medium text-slate-700 dark:text-[#ECEEED]">
                <CheckCircle2 className="w-4 h-4 text-[#0F5132] dark:text-[#7CC9A3]" />
                <span>SIS / LMS Direct Integration</span>
              </div>
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* =========================================================
          6. ABOUT US & VALUE PILLARS (#about-us)
             (Staggered 3 philosophy cards: 0ms, 120ms, 240ms)
          ========================================================= */}
      <section id="about-us" className="w-full max-w-6xl mx-auto px-6 py-16 scroll-mt-20">
        <ScrollReveal direction="up" delay={50}>
          <div className="flex flex-col items-center text-center mb-12">
            <span className="text-xs font-bold uppercase tracking-wider text-[#0F5132] dark:text-[#7CC9A3] mb-2">
              Our Philosophy
            </span>
            <h2 className="text-3xl sm:text-4xl font-bold text-[#1E2430] dark:text-[#ECEEED] tracking-tight">
              Built for academic rigor, not shortcut grading
            </h2>
            <p className="text-sm sm:text-base text-slate-600 dark:text-[#969E9A] max-w-lg mt-2 leading-relaxed">
              EvalDesk bridges paper-based examinations with high-fidelity sovereign AI so instructors retain absolute control.
            </p>
          </div>
        </ScrollReveal>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full text-left">
          {/* Pillar 1 (delay 0ms) */}
          <ScrollReveal direction="up" delay={0}>
            <div className="bg-white dark:bg-[#181B19] rounded-2xl p-6 border border-slate-200/90 dark:border-[#2A2F2C] shadow-none dark:shadow-none flex flex-col gap-3 h-full">
              <div className="w-10 h-10 rounded-xl bg-[#E8F3EE] dark:bg-[#1A2B23] text-[#0F5132] dark:text-[#7CC9A3] border border-transparent dark:border-[#294236] flex items-center justify-center">
                <Scale className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-[#1E2430] dark:text-[#ECEEED]">Rubric-Anchored Precision</h3>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-[#969E9A] leading-relaxed">
                Eliminates evaluator fatigue drift. Every single point awarded or deducted is mapped verbatim against course learning outcomes and department rubrics.
              </p>
            </div>
          </ScrollReveal>

          {/* Pillar 2 (delay 120ms) */}
          <ScrollReveal direction="up" delay={120}>
            <div className="bg-white dark:bg-[#181B19] rounded-2xl p-6 border border-slate-200/90 dark:border-[#2A2F2C] shadow-none dark:shadow-none flex flex-col gap-3 h-full">
              <div className="w-10 h-10 rounded-xl bg-[#E8F3EE] dark:bg-[#1A2B23] text-[#0F5132] dark:text-[#7CC9A3] border border-transparent dark:border-[#294236] flex items-center justify-center">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-[#1E2430] dark:text-[#ECEEED]">Human-in-the-Loop Sovereignty</h3>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-[#969E9A] leading-relaxed">
                AI assists with transcription and baseline criteria matches, but the final mark approval remains exclusively with the authenticated course instructor.
              </p>
            </div>
          </ScrollReveal>

          {/* Pillar 3 (delay 240ms) */}
          <ScrollReveal direction="up" delay={240}>
            <div className="bg-white dark:bg-[#181B19] rounded-2xl p-6 border border-slate-200/90 dark:border-[#2A2F2C] shadow-none dark:shadow-none flex flex-col gap-3 h-full">
              <div className="w-10 h-10 rounded-xl bg-[#E8F3EE] dark:bg-[#1A2B23] text-[#0F5132] dark:text-[#7CC9A3] border border-transparent dark:border-[#294236] flex items-center justify-center">
                <GraduationCap className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-[#1E2430] dark:text-[#ECEEED]">Audit-Ready Documentation</h3>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-[#969E9A] leading-relaxed">
                Standardized digital records withstand institutional scrutiny, grade appeals, and accreditation reviews with immutable evaluation logs.
              </p>
            </div>
          </ScrollReveal>
        </div>

        {/* Bottom Call to Action Banner (Zoom reveal) */}
        <ScrollReveal direction="zoom" delay={100}>
          <div className="w-full mt-14 bg-white dark:bg-[#181B19] rounded-2xl p-8 sm:p-10 border border-slate-200/90 dark:border-[#2A2F2C] shadow-none dark:shadow-none flex flex-col md:flex-row items-center justify-between gap-6 text-left">
            <div className="flex flex-col gap-1.5 max-w-xl">
              <h3 className="text-xl sm:text-2xl font-bold text-[#1E2430] dark:text-[#ECEEED]">
                Ready to modernize paper grading?
              </h3>
              <p className="text-sm text-slate-600 dark:text-[#969E9A]">
                Deploy EvalDesk for your upcoming mid-terms or department final examinations.
              </p>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <button
                type="button"
                onClick={() => {
                  window.location.hash = '#/upload';
                }}
                className="px-6 py-2.5 rounded-lg text-sm font-semibold text-white bg-[#0F5132] hover:bg-[#0B3D26] dark:bg-[#1F6E4A] dark:hover:bg-[#27855A] transition-all cursor-pointer shadow-none dark:shadow-none"
              >
                Sign up for free
              </button>
              <button
                type="button"
                onClick={() => {
                  window.location.hash = '#/dashboard';
                }}
                className="px-5 py-2.5 rounded-lg text-sm font-medium text-[#1E2430] dark:text-[#ECEEED] bg-slate-50 dark:bg-[#202422] hover:bg-slate-100 dark:hover:bg-[#2F3532] border border-slate-200 dark:border-[#2F3532] transition-all cursor-pointer"
              >
                Explore Workspace
              </button>
            </div>
          </div>
        </ScrollReveal>
      </section>

      {/* =========================================================
          7. CLEAN 4-COLUMN FOOTER
          ========================================================= */}
      <footer className="w-full bg-white dark:bg-[#181B19] border-t border-slate-200/90 dark:border-[#2A2F2C] mt-auto">
        <div className="max-w-6xl mx-auto px-6 py-12">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-10 text-left">
            {/* Col 1: Brand */}
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <div className="flex flex-col gap-[3px]">
                  <div className="w-4 h-1.5 rounded-full bg-[#0F5132] dark:bg-[#1F6E4A]" />
                  <div className="w-2.5 h-1.5 rounded-full bg-[#3A7D8C] dark:bg-[#2D8A61]" />
                </div>
                <span className="text-sm font-bold tracking-tight text-[#1E2430] dark:text-[#ECEEED] uppercase">
                  EVALDESK
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-[#969E9A] leading-relaxed">
                The exacting academic grading workspace. Engineered for structural evaluation and non-distracting institutional precision.
              </p>
            </div>

            {/* Col 2: Product */}
            <div className="flex flex-col gap-2.5 text-xs">
              <span className="font-bold uppercase tracking-wider text-slate-900 dark:text-[#ECEEED]">Product</span>
              <a href="#/home" className="text-slate-500 dark:text-[#969E9A] hover:text-[#1E2430] dark:hover:text-[#ECEEED] transition-colors">
                Overview
              </a>
              <button
                type="button"
                onClick={() => scrollToSection('demo-stage')}
                className="text-left text-slate-500 dark:text-[#969E9A] hover:text-[#1E2430] dark:hover:text-[#ECEEED] transition-colors cursor-pointer"
              >
                Rubrics Suite
              </button>
              <button
                type="button"
                onClick={() => scrollToSection('device-suite')}
                className="text-left text-slate-500 dark:text-[#969E9A] hover:text-[#1E2430] dark:hover:text-[#ECEEED] transition-colors cursor-pointer"
              >
                Scoring Specs
              </button>
              <button
                type="button"
                onClick={() => {
                  window.location.hash = '#/upload';
                }}
                className="text-left text-slate-500 dark:text-[#969E9A] hover:text-[#1E2430] dark:hover:text-[#ECEEED] transition-colors cursor-pointer"
              >
                Batch Review
              </button>
            </div>

            {/* Col 3: Institution */}
            <div className="flex flex-col gap-2.5 text-xs">
              <span className="font-bold uppercase tracking-wider text-slate-900 dark:text-[#ECEEED]">Institution</span>
              <button
                type="button"
                onClick={() => scrollToSection('about-us')}
                className="text-left text-slate-500 dark:text-[#969E9A] hover:text-[#1E2430] dark:hover:text-[#ECEEED] transition-colors cursor-pointer"
              >
                About Us
              </button>
              <span className="text-slate-500 dark:text-[#969E9A]">Accreditation</span>
              <span className="text-slate-500 dark:text-[#969E9A]">Security &amp; Trust</span>
              <span className="text-slate-500 dark:text-[#969E9A]">Academic Contact</span>
            </div>

            {/* Col 4: Governance */}
            <div className="flex flex-col gap-2.5 text-xs">
              <span className="font-bold uppercase tracking-wider text-slate-900 dark:text-[#ECEEED]">Governance</span>
              <span className="text-slate-500 dark:text-[#969E9A]">Privacy Policy</span>
              <span className="text-slate-500 dark:text-[#969E9A]">Terms of Service</span>
              <span className="text-slate-500 dark:text-[#969E9A]">Audit Standards</span>
              <span className="text-slate-500 dark:text-[#969E9A]">System Status</span>
            </div>
          </div>

          <div className="pt-6 border-t border-slate-100 dark:border-[#2F3532] flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-400 dark:text-[#68706C]">
            <p>© 2025 EvalDesk Technologies Inc. All rights reserved.</p>
            <div className="flex items-center gap-4 font-mono text-[11px]">
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-slate-100 dark:bg-[#202422] text-slate-600 dark:text-[#969E9A] border border-transparent dark:border-[#2F3532]">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                <span>SYSTEM: v2.4.0-SECURE</span>
              </span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default HomeScreen;
