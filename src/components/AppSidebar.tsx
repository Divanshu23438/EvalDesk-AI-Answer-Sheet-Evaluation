import React, { useEffect, useState } from 'react';
import { useSheetStore } from '../state/useSheetStore';
import { useTheme } from '../context/ThemeContext';
import {
  LayoutDashboard,
  FileCheck2,
  History,
  FileSpreadsheet,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  Sun,
  Moon,
} from 'lucide-react';

interface Paper {
  id: string;
  title: string;
}

export const AppSidebar: React.FC = () => {
  const [state, store] = useSheetStore();
  const { theme, toggleTheme } = useTheme();
  const isCollapsed = state.isSidebarCollapsed;

  const [recentPapers, setRecentPapers] = useState<Paper[]>([]);
  const [papersLoading, setPapersLoading] = useState(true);
  const [backendOnline, setBackendOnline] = useState<boolean | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // localStorage sidebar persistence: read on mount
  useEffect(() => {
    const stored = localStorage.getItem('evaldesk_sidebar_collapsed');
    if (stored !== null) {
      const shouldCollapse = stored === 'true';
      if (shouldCollapse !== state.isSidebarCollapsed) {
        store.toggleSidebar();
      }
    }
  // Only run on mount
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleToggle = () => {
    const next = !isCollapsed;
    localStorage.setItem('evaldesk_sidebar_collapsed', String(next));
    store.toggleSidebar();
  };

  // Fetch backend health
  useEffect(() => {
    let cancelled = false;
    fetch('/api/health')
      .then((r) => {
        if (!cancelled) setBackendOnline(r.ok);
      })
      .catch(() => {
        if (!cancelled) setBackendOnline(false);
      });
    return () => { cancelled = true; };
  }, []);

  // Fetch recent papers
  useEffect(() => {
    let cancelled = false;
    setPapersLoading(true);
    fetch('/api/papers')
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        const list: Paper[] = Array.isArray(data?.papers)
          ? data.papers.slice(0, 5).map((p: any) => ({ id: p.id, title: p.title ?? p.name ?? 'Untitled' }))
          : Array.isArray(data)
          ? (data as any[]).slice(0, 5).map((p: any) => ({ id: p.id, title: p.title ?? p.name ?? 'Untitled' }))
          : [];
        setRecentPapers(list);
      })
      .catch(() => {
        if (!cancelled) setRecentPapers([]);
      })
      .finally(() => {
        if (!cancelled) setPapersLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  const navItems = [
    {
      id: 'dashboard',
      label: 'Dashboard',
      icon: LayoutDashboard,
      path: '#/dashboard',
      isActive: state.step === 'dashboard',
      onClick: () => store.setStep('dashboard'),
    },
    {
      id: 'evaluate-sheets',
      label: 'Evaluate Sheets',
      icon: FileCheck2,
      path: '#/upload',
      isActive: state.step === 'upload' || state.step === 'evaluate' || state.step === 'report',
      onClick: () => store.setStep('upload'),
    },
    {
      id: 'history',
      label: 'History',
      icon: History,
      path: '#/history',
      isActive: state.step === 'history',
      onClick: () => store.setStep('history'),
    },
    {
      id: 'reports',
      label: 'Report Card',
      icon: FileSpreadsheet,
      path: '#/reports',
      isActive: state.step === 'reports',
      onClick: () => store.setStep('reports'),
    },
  ];

  return (
    <aside
      className={`h-full bg-white dark:bg-[#181B19] border-r border-[#E2E8E4] dark:border-[#2A2F2C] transition-all duration-200 flex flex-col shrink-0 select-none print:hidden shadow-none dark:shadow-none ${
        isCollapsed ? 'w-20' : 'w-64'
      }`}
      aria-label="Application Navigation Sidebar"
    >
      {/* Sidebar Header */}
      <div className="h-12 border-b border-[#E2E8E4] dark:border-[#2A2F2C] flex items-center justify-between px-3 shrink-0">
        {!isCollapsed ? (
          <>
            <a
              href="#/home"
              onClick={() => store.setStep('home')}
              className="flex items-center gap-2 min-w-0 hover:opacity-80 transition-opacity"
              title="Return to Home Landing"
            >
              <div className="w-7 h-7 rounded-lg bg-[#0F5132] dark:bg-[#1F6E4A] text-white font-bold flex items-center justify-center text-xs shrink-0">
                ED
              </div>
              <span className="font-bold text-sm tracking-tight text-[#111827] dark:text-[#ECEEED] truncate">
                EvalDesk
              </span>
              <span className="text-[10px] font-bold uppercase tracking-wider bg-[#E8F3EE] text-[#0F5132] border border-[#0F5132]/20 dark:bg-[#1A2B23] dark:text-[#7CC9A3] dark:border-[#294236] px-1 py-0.2 rounded leading-none">
                PRO
              </span>
            </a>
            <button
              type="button"
              onClick={handleToggle}
              className="w-7 h-7 rounded-lg flex items-center justify-center text-[#4B5563] dark:text-[#969E9A] hover:text-[#111827] dark:hover:text-[#ECEEED] hover:bg-[#F1F4F2] dark:hover:bg-[#202422] transition-colors cursor-pointer"
              title="Collapse sidebar ([)"
              aria-label="Collapse sidebar"
            >
              <PanelLeftClose className="w-4 h-4" />
            </button>
          </>
        ) : (
          <div className="w-full flex items-center justify-center">
            <button
              type="button"
              onClick={handleToggle}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-[#4B5563] dark:text-[#969E9A] hover:text-[#0F5132] dark:hover:text-[#7CC9A3] hover:bg-[#E8F3EE] dark:hover:bg-[#1A2B23] transition-colors cursor-pointer"
              title="Expand sidebar ([)"
              aria-label="Expand sidebar"
            >
              <PanelLeftOpen className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* Quick Search (⌘K) */}
      {!isCollapsed ? (
        <div className="px-3 pt-3 pb-1 shrink-0">
          <div className="relative flex items-center">
            <Search className="w-3.5 h-3.5 text-[#6B7280] dark:text-[#68706C] absolute left-2.5 pointer-events-none" />
            <input
              type="text"
              placeholder="Quick search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-8 py-1.5 text-xs bg-[#F1F4F2] dark:bg-[#202422] border border-[#E2E8E4] dark:border-[#2F3532] rounded-xl text-[#111827] dark:text-[#ECEEED] placeholder-[#6B7280] dark:placeholder-[#68706C] focus:outline-none focus:ring-1 focus:ring-[#0F5132] dark:focus:ring-[#1F6E4A] focus:border-[#0F5132] dark:focus:border-[#1F6E4A]"
            />
            <kbd className="absolute right-2 px-1 py-0.5 text-[9px] font-mono text-[#6B7280] dark:text-[#68706C] bg-white dark:bg-[#181B19] border border-[#E2E8E4] dark:border-[#2F3532] rounded">
              ⌘K
            </kbd>
          </div>
        </div>
      ) : (
        <div className="px-2 pt-2 flex justify-center shrink-0">
          <button
            type="button"
            onClick={handleToggle}
            className="w-10 h-8 flex items-center justify-center rounded-xl text-[#4B5563] dark:text-[#969E9A] hover:text-[#111827] dark:hover:text-[#ECEEED] hover:bg-[#F1F4F2] dark:hover:bg-[#202422] transition"
            title="Quick search (⌘K)"
          >
            <Search className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Navigation Menu */}
      <nav className="py-3 px-2 space-y-1.5 overflow-y-auto overflow-x-hidden">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              type="button"
              onClick={item.onClick}
              title={isCollapsed ? item.label : undefined}
              className={`w-full flex items-center rounded-xl transition-all duration-150 cursor-pointer ${
                isCollapsed
                  ? `h-10 justify-center ${
                      item.isActive
                        ? 'bg-[#E8F3EE] text-[#0F5132] dark:bg-[#1A2B23] dark:text-[#7CC9A3] dark:border dark:border-[#294236]'
                        : 'text-[#4B5563] dark:text-[#969E9A] hover:bg-[#F1F4F2] dark:hover:bg-[#202422] hover:text-[#111827] dark:hover:text-[#ECEEED]'
                    }`
                  : `h-9 px-3 gap-3 ${
                      item.isActive
                        ? 'bg-[#E8F3EE] text-[#0F5132] dark:bg-[#1A2B23] dark:text-[#7CC9A3] dark:border dark:border-[#294236] font-semibold'
                        : 'text-[#4B5563] dark:text-[#969E9A] hover:bg-[#F1F4F2] dark:hover:bg-[#202422] hover:text-[#111827] dark:hover:text-[#ECEEED] font-medium'
                    }`
              }`}
            >
              <Icon
                className={`w-4 h-4 shrink-0 transition-colors ${
                  item.isActive ? 'text-[#0F5132] dark:text-[#7CC9A3]' : 'text-[#6B7280] dark:text-[#68706C]'
                }`}
              />
              {!isCollapsed && (
                <span className="text-xs truncate flex-1 text-left">{item.label}</span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Recent Papers (expanded only) */}
      {!isCollapsed && (
        <div className="px-3 pb-2 flex-1 overflow-y-auto">
          <p className="text-[10px] font-bold uppercase tracking-wider text-[#6B7280] dark:text-[#68706C] mb-1.5 px-1">
            Recent Papers
          </p>
          {papersLoading ? (
            <div className="space-y-1.5">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="h-6 rounded-lg bg-[#F1F4F2] dark:bg-[#202422] animate-pulse"
                />
              ))}
            </div>
          ) : recentPapers.length === 0 ? (
            <p className="text-[11px] text-[#6B7280] dark:text-[#68706C] italic px-1">No papers yet</p>
          ) : (
            <ul className="space-y-0.5">
              {recentPapers
                .filter((p) => !searchQuery.trim() || p.title.toLowerCase().includes(searchQuery.toLowerCase()))
                .map((paper) => (
                <li key={paper.id}>
                  <a
                    href="#/upload"
                    onClick={() => store.setStep('upload')}
                    className="block text-[11px] text-[#4B5563] dark:text-[#969E9A] hover:text-[#0F5132] dark:hover:text-[#7CC9A3] hover:bg-[#E8F3EE] dark:hover:bg-[#1A2B23] px-2 py-1 rounded-lg truncate transition-colors"
                    title={paper.title}
                  >
                    {paper.title}
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Theme Appearance Toggle Row (Above Backend Status Indicator) */}
      {!isCollapsed ? (
        <div className="px-3 pb-2 shrink-0">
          <button
            type="button"
            onClick={toggleTheme}
            className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs font-medium text-[#4B5563] dark:text-[#969E9A] hover:bg-[#F1F4F2] dark:hover:bg-[#202422] hover:text-[#111827] dark:hover:text-[#ECEEED] transition-colors cursor-pointer border border-transparent hover:border-[#E2E8E4] dark:hover:border-[#2F3532]"
            title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            aria-label="Toggle theme appearance"
          >
            <div className="flex items-center gap-2">
              {theme === 'dark' ? (
                <Sun className="w-3.5 h-3.5 text-[#E5B567]" />
              ) : (
                <Moon className="w-3.5 h-3.5 text-[#4B5563]" />
              )}
              <span>{theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>
            </div>
            <span className="text-[10px] font-mono uppercase tracking-wider text-[#6B7280] dark:text-[#68706C]">
              {theme === 'dark' ? 'Dark' : 'Light'}
            </span>
          </button>
        </div>
      ) : (
        <div className="px-2 pb-2 flex justify-center shrink-0">
          <button
            type="button"
            onClick={toggleTheme}
            className="w-10 h-8 flex items-center justify-center rounded-xl text-[#4B5563] dark:text-[#969E9A] hover:bg-[#F1F4F2] dark:hover:bg-[#202422] hover:text-[#111827] dark:hover:text-[#ECEEED] transition-colors cursor-pointer border border-transparent hover:border-[#E2E8E4] dark:hover:border-[#2F3532]"
            title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            aria-label="Toggle theme appearance"
          >
            {theme === 'dark' ? (
              <Sun className="w-4 h-4 text-[#E5B567]" />
            ) : (
              <Moon className="w-4 h-4 text-[#4B5563]" />
            )}
          </button>
        </div>
      )}

      {/* Backend Health Pill */}
      <div className="px-3 pb-2 shrink-0">
        {backendOnline !== null && (
          <div className="flex items-center gap-1.5 text-[10px] text-[#6B7280] dark:text-[#68706C]">
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                backendOnline ? 'bg-emerald-500' : 'bg-rose-500'
              }`}
            />
            <span>{backendOnline ? 'Online' : 'Offline'}</span>
          </div>
        )}
      </div>

      {/* Sidebar Footer */}
      <div className="p-2 border-t border-[#E2E8E4] dark:border-[#2A2F2C] text-center shrink-0">
        {!isCollapsed ? (
          <div className="px-2 py-1.5 rounded-lg bg-[#F1F4F2] dark:bg-[#202422] border border-[#E2E8E4] dark:border-[#2F3532] text-[10px] text-[#6B7280] dark:text-[#68706C] flex items-center justify-between">
            <span className="font-medium">EvalDesk v2.4</span>
            <kbd className="px-1 py-0.2 rounded bg-white dark:bg-[#181B19] border border-[#E2E8E4] dark:border-[#2F3532] font-mono text-[9px] text-[#6B7280] dark:text-[#68706C]">
              [
            </kbd>
          </div>
        ) : (
          <div className="w-7 h-7 mx-auto rounded-lg bg-[#F1F4F2] dark:bg-[#202422] border border-[#E2E8E4] dark:border-[#2F3532] flex items-center justify-center font-bold text-[10px] text-[#0F5132] dark:text-[#7CC9A3]">
            ED
          </div>
        )}
      </div>
    </aside>
  );
};
