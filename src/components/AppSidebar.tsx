import React from 'react';
import { useSheetStore } from '../state/useSheetStore';
import {
  LayoutDashboard,
  FileCheck2,
  History,
  FileSpreadsheet,
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
  ];

  return (
    <aside
      className={`h-full bg-white border-r border-slate-200 transition-all duration-200 flex flex-col shrink-0 select-none ${
        isCollapsed ? 'w-16' : 'w-60'
      }`}
      aria-label="Application Navigation Sidebar"
    >
      {/* Sidebar Header */}
      <div className="h-12 border-b border-slate-200 flex items-center justify-between px-3 shrink-0">
        {!isCollapsed ? (
          <>
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-7 h-7 rounded-lg bg-indigo-600 text-white font-bold flex items-center justify-center text-xs shadow-xs shrink-0">
                ED
              </div>
              <span className="font-bold text-sm tracking-tight text-slate-900 truncate">
                EvalDesk
              </span>
              <span className="text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-600 border border-slate-300 px-1 py-0.2 rounded leading-none">
                PRO
              </span>
            </div>
            <button
              type="button"
              onClick={() => store.toggleSidebar()}
              className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
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
              className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
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
                        ? 'bg-indigo-50 text-indigo-600 shadow-2xs ring-1 ring-indigo-200'
                        : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'
                    }`
                  : `h-9 px-3 gap-3 ${
                      item.isActive
                        ? 'bg-indigo-50 text-indigo-700 font-semibold border border-indigo-100 shadow-2xs'
                        : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 font-medium'
                    }`
              }`}
            >
              <Icon
                className={`w-4 h-4 shrink-0 transition-colors ${
                  item.isActive ? 'text-indigo-600' : 'text-slate-400 group-hover:text-slate-600'
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
      <div className="p-2 border-t border-slate-200 text-center shrink-0">
        {!isCollapsed ? (
          <div className="px-2 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-[10px] text-slate-500 flex items-center justify-between">
            <span className="font-medium">EvalDesk v2.4</span>
            <kbd className="px-1 py-0.2 rounded bg-white border border-slate-300 font-mono text-[9px]">
              [
            </kbd>
          </div>
        ) : (
          <div className="w-7 h-7 mx-auto rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center font-bold text-[10px] text-indigo-600">
            ED
          </div>
        )}
      </div>
    </aside>
  );
};
