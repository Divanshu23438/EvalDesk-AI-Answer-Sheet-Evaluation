import React, { useEffect, useState, useMemo } from 'react';
import { useSheetStore } from '../state/useSheetStore';
import { apiClient } from '../api/client';
import {
  LayoutDashboard,
  FileCheck2,
  History,
  FileSpreadsheet,
  BookOpen,
} from 'lucide-react';

interface PaperSummary {
  id: string;
  title: string;
  subject?: string;
  total_marks?: number;
  created_at?: string;
}

export const AppSidebar: React.FC = () => {
  const [state, store] = useSheetStore();
  const isCollapsed = state.isSidebarCollapsed;

  const [searchQuery, setSearchQuery] = useState('');
  const [papers, setPapers] = useState<PaperSummary[]>([]);
  const [healthStatus, setHealthStatus] = useState<'healthy' | 'offline'>('healthy');

  // Load live papers and backend health
  useEffect(() => {
    let isMounted = true;
    const fetchData = async () => {
      try {
        const res = await apiClient.get<{ papers: PaperSummary[] }>('/api/papers');
        if (isMounted && res?.papers) {
          setPapers(res.papers);
        }
      } catch {
        // graceful empty fallback
      }

      try {
        const health = await apiClient.get<{ status: string }>('/api/health');
        if (isMounted) {
          setHealthStatus(health?.status === 'healthy' ? 'healthy' : 'offline');
        }
      } catch {
        if (isMounted) {
          setHealthStatus('offline');
        }
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  // ⌘K shortcut handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        const input = document.getElementById('sidebar-quick-search') as HTMLInputElement | null;
        if (input) {
          if (isCollapsed) {
            store.toggleSidebar();
            setTimeout(() => input.focus(), 150);
          } else {
            input.focus();
          }
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isCollapsed, store]);

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      const q = searchQuery.trim();
      if (q) {
        store.setStep('history');
        window.location.hash = `#/history?q=${encodeURIComponent(q)}`;
      }
    }
  };

  const filteredPapers = useMemo(() => {
    if (!searchQuery.trim()) return papers;
    const q = searchQuery.toLowerCase();
    return papers.filter(
      (p) =>
        p.title.toLowerCase().includes(q) ||
        (p.subject && p.subject.toLowerCase().includes(q))
    );
  }, [papers, searchQuery]);

  const navItems = [
    {
      id: 'dashboard',
      label: 'Dashboard',
      icon: LayoutDashboard,
      isActive: state.step === 'dashboard',
      onClick: () => {
        store.setStep('dashboard');
        window.location.hash = '#/dashboard';
      },
    },
    {
      id: 'evaluate-sheets',
      label: 'Evaluate Sheets',
      icon: FileCheck2,
      isActive: state.step === 'upload' || state.step === 'evaluate' || state.step === 'report',
      onClick: () => {
        store.setStep('upload');
        window.location.hash = '#/upload';
      },
    },
    {
      id: 'history',
      label: 'History',
      icon: History,
      isActive: state.step === 'history',
      onClick: () => {
        store.setStep('history');
        window.location.hash = '#/history';
      },
    },
    {
      id: 'reports',
      label: 'Reports',
      icon: FileSpreadsheet,
      isActive: state.step === 'reports',
      onClick: () => {
        store.setStep('reports');
        window.location.hash = '#/reports';
      },
    },
  ];

  return (
    <aside
      id="mainSidebar"
      className={`${
        isCollapsed ? 'w-20' : 'w-64'
      } flex-shrink-0 bg-white border-r border-slate-100 flex flex-col justify-between p-4 transition-all duration-300 ease-in-out select-none`}
    >
      <div className="flex-1 flex flex-col min-h-0">
        {/* Sidebar Brand Header */}
        <div className="flex items-center justify-between pb-5 px-1 shrink-0">
          <a
            href="#/home"
            onClick={() => store.setStep('home')}
            className="flex items-center gap-3 overflow-hidden hover:opacity-85 transition-opacity cursor-pointer"
            title="EvalDesk Home"
          >
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-indigo-400 flex items-center justify-center text-white shadow-md shadow-indigo-500/25 flex-shrink-0">
              {/* Academic Logo Icon */}
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2L1 7l11 5 9-4.09V17h2V7L12 2zM4.27 10.37L12 13.88l7.73-3.51V16c0 3.31-3.69 6-8.73 6s-8.73-2.69-8.73-6v-5.63z" />
              </svg>
            </div>
            {!isCollapsed && (
              <span className="font-bold text-lg text-slate-900 tracking-tight whitespace-nowrap">
                EvalDesk
              </span>
            )}
          </a>
          {/* Toggle Collapse Button */}
          <button
            id="sidebarCollapseBtn"
            type="button"
            onClick={() => store.toggleSidebar()}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
            title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            <svg
              id="collapseArrow"
              className={`w-5 h-5 transition-transform duration-300 ${
                isCollapsed ? 'rotate-180' : ''
              }`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                d="M11 19l-7-7 7-7m8 14l-7-7 7-7"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
              />
            </svg>
          </button>
        </div>

        {/* Quick Search Input */}
        {!isCollapsed ? (
          <div className="relative mt-1 mb-5 shrink-0">
            <svg
              className="w-4 h-4 absolute left-3 top-3 text-slate-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
              />
            </svg>
            <input
              id="sidebar-quick-search"
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={handleSearchKeyDown}
              placeholder="Search..."
              className="w-full bg-slate-50 hover:bg-slate-100/80 focus:bg-white text-xs text-slate-700 pl-9 pr-9 py-2.5 rounded-xl border border-slate-200/70 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all placeholder:text-slate-400"
            />
            <span className="absolute right-2.5 top-2.5 px-1.5 py-0.5 rounded border border-slate-200 bg-white text-[10px] font-semibold text-slate-400">
              ⌘K
            </span>
          </div>
        ) : (
          <div className="flex justify-center mb-5 shrink-0">
            <button
              type="button"
              onClick={() => store.toggleSidebar()}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-50 transition-colors"
              title="Search (⌘K)"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                />
              </svg>
            </button>
          </div>
        )}

        {/* Navigation Section */}
        <nav className="space-y-6 flex-1 overflow-y-auto">
          {/* MAIN Group */}
          <div>
            {!isCollapsed && (
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider px-2">
                MAIN
              </span>
            )}
            <div className="mt-2 space-y-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={item.onClick}
                    title={isCollapsed ? item.label : undefined}
                    className={`w-full flex items-center rounded-xl transition-all group cursor-pointer ${
                      isCollapsed
                        ? `h-10 justify-center ${
                            item.isActive
                              ? 'bg-indigo-50 text-indigo-600'
                              : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
                          }`
                        : `gap-3 px-3 py-2 text-xs ${
                            item.isActive
                              ? 'bg-indigo-50 text-indigo-600 font-semibold'
                              : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50 font-medium'
                          }`
                    }`}
                  >
                    <Icon
                      className={`w-4 h-4 flex-shrink-0 ${
                        item.isActive
                          ? 'text-indigo-600'
                          : 'text-slate-400 group-hover:text-slate-600'
                      }`}
                    />
                    {!isCollapsed && <span className="truncate">{item.label}</span>}
                  </button>
                );
              })}
            </div>
          </div>

          {/* RECENT PAPERS Section */}
          {!isCollapsed && (
            <div className="pt-2">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider px-2">
                RECENT PAPERS
              </span>
              <div className="mt-2 space-y-1">
                {filteredPapers.length === 0 ? (
                  <p className="px-2 py-3 text-xs text-slate-400 italic">
                    No papers uploaded yet
                  </p>
                ) : (
                  filteredPapers.slice(0, 5).map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => {
                        store.setPaper({
                          id: p.id,
                          title: p.title,
                          totalMarks: p.total_marks || 0,
                          isLocked: true,
                        });
                        store.setStep('upload');
                        window.location.hash = '#/upload';
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-left text-slate-600 hover:text-indigo-600 hover:bg-slate-50 transition-colors group cursor-pointer"
                      title={`${p.title} (${p.subject || 'General'})`}
                    >
                      <BookOpen className="w-3.5 h-3.5 text-slate-400 group-hover:text-indigo-600 flex-shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium text-slate-700 group-hover:text-indigo-600 truncate">
                          {p.title}
                        </p>
                        <p className="text-[10px] text-slate-400 truncate">
                          {p.subject || 'General'}
                        </p>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>
          )}
        </nav>
      </div>

      {/* Bottom Status Card: Live Backend Health */}
      <div className="pt-4 border-t border-slate-100 shrink-0">
        {!isCollapsed ? (
          <div className="flex items-center gap-2.5 p-2 rounded-xl bg-slate-50 border border-slate-200/80">
            <span className="relative flex h-2.5 w-2.5 flex-shrink-0">
              <span
                className={`animate-ping absolute inline-flex h-full w-full rounded-full ${
                  healthStatus === 'healthy' ? 'bg-emerald-400' : 'bg-rose-400'
                } opacity-75`}
              />
              <span
                className={`relative inline-flex rounded-full h-2.5 w-2.5 ${
                  healthStatus === 'healthy' ? 'bg-emerald-500' : 'bg-rose-500'
                }`}
              />
            </span>
            <div className="overflow-hidden text-left flex-1">
              <h4 className="text-xs font-semibold text-slate-800 truncate">
                {healthStatus === 'healthy' ? 'AI Engine Online' : 'AI Engine Offline'}
              </h4>
              <p className="text-[10px] text-slate-400 truncate">
                {healthStatus === 'healthy' ? 'Evaluation services active' : 'Backend unavailable'}
              </p>
            </div>
          </div>
        ) : (
          <div
            className="w-10 h-10 mx-auto rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-center cursor-pointer"
            title={healthStatus === 'healthy' ? 'AI Engine Online' : 'AI Engine Offline'}
            onClick={() => store.toggleSidebar()}
          >
            <span
              className={`w-2.5 h-2.5 rounded-full ${
                healthStatus === 'healthy' ? 'bg-emerald-500' : 'bg-rose-500'
              }`}
            />
          </div>
        )}
      </div>
    </aside>
  );
};
