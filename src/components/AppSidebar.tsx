import React from 'react';
import { useSheetStore } from '../state/useSheetStore';
import {
  LayoutDashboard,
  FileCheck2,
  History,
  FileSpreadsheet,
  BookOpen,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react';

export const AppSidebar: React.FC = () => {
  const [state, store] = useSheetStore();
  const isCollapsed = state.isSidebarCollapsed;

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
      label: 'Reports',
      icon: FileSpreadsheet,
      path: '#/reports',
      isActive: state.step === 'reports',
      onClick: () => store.setStep('reports'),
    },
    {
      id: 'guide',
      label: 'Guide',
      icon: BookOpen,
      path: '#/guide',
      isActive: state.step === 'guide',
      onClick: () => store.setStep('guide'),
    },
  ];

  return (
    <aside
      className={`h-full bg-white border-r border-[#E2E8E4] transition-all duration-200 flex flex-col shrink-0 select-none ${
        isCollapsed ? 'w-20' : 'w-64'
      }`}
      aria-label="Application Navigation Sidebar"
    >
      {/* Sidebar Header */}
      <div className="h-12 border-b border-[#E2E8E4] flex items-center justify-between px-3 shrink-0">
        {!isCollapsed ? (
          <>
            <a
              href="#/home"
              onClick={() => store.setStep('home')}
              className="flex items-center gap-2 min-w-0 hover:opacity-80 transition-opacity"
              title="Return to Home Landing"
            >
              <div className="w-7 h-7 rounded-lg bg-[#0F5132] text-white font-bold flex items-center justify-center text-xs shadow-xs shrink-0">
                ED
              </div>
              <span className="font-bold text-sm tracking-tight text-[#111827] truncate">
                EvalDesk
              </span>
              <span className="text-[10px] font-bold uppercase tracking-wider bg-[#E8F3EE] text-[#0F5132] border border-[#0F5132]/20 px-1 py-0.2 rounded leading-none">
                PRO
              </span>
            </a>
            <button
              type="button"
              onClick={() => store.toggleSidebar()}
              className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-[#0F5132] hover:bg-[#E8F3EE] transition-colors"
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
              onClick={() => store.toggleSidebar()}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 hover:text-[#0F5132] hover:bg-[#E8F3EE] transition-colors"
              title="Expand sidebar ([)"
              aria-label="Expand sidebar"
            >
              <PanelLeftOpen className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* Navigation Menu */}
      <nav className="flex-1 py-3 px-2 space-y-1.5 overflow-y-auto overflow-x-hidden">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              type="button"
              onClick={item.onClick}
              title={isCollapsed ? item.label : undefined}
              className={`w-full flex items-center rounded-xl transition-all duration-150 ${
                isCollapsed
                  ? `h-10 justify-center ${
                      item.isActive
                        ? 'bg-[#E8F3EE] text-[#0F5132] font-semibold shadow-2xs ring-1 ring-[#0F5132]/30'
                        : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'
                    }`
                  : `h-9 px-3 gap-3 ${
                      item.isActive
                        ? 'bg-[#E8F3EE] text-[#0F5132] font-semibold border border-[#0F5132]/20 shadow-2xs'
                        : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 font-medium'
                    }`
              }`}
            >
              <Icon
                className={`w-4 h-4 shrink-0 transition-colors ${
                  item.isActive ? 'text-[#0F5132]' : 'text-slate-400 group-hover:text-slate-600'
                }`}
              />
              {!isCollapsed && (
                <span className="text-xs truncate flex-1 text-left">{item.label}</span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Sidebar Footer */}
      <div className="p-2 border-t border-[#E2E8E4] text-center shrink-0">
        {!isCollapsed ? (
          <div className="px-2 py-1.5 rounded-lg bg-slate-50 border border-[#E2E8E4] text-[10px] text-slate-500 flex items-center justify-between">
            <span className="font-medium">EvalDesk v2.4</span>
            <kbd className="px-1 py-0.2 rounded bg-white border border-slate-300 font-mono text-[9px]">
              [
            </kbd>
          </div>
        ) : (
          <div className="w-8 h-8 mx-auto rounded-lg bg-[#E8F3EE] border border-[#0F5132]/20 flex items-center justify-center font-bold text-[10px] text-[#0F5132]">
            ED
          </div>
        )}
      </div>
    </aside>
  );
};
