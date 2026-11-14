import { useState } from 'react';
import {
  Bell,
  BookOpen,
  CheckCircle2,
  ClipboardCheck,
  FileCheck2,
  FileSpreadsheet,
  FileText,
  Home,
  Inbox,
  LayoutDashboard,
  LogOut,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  RefreshCw,
  ScanLine,
  Search,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  UserCheck,
  Users,
  X,
} from 'lucide-react';
import { STRINGS } from '../../i18n/strings';
import { useEval } from '../../store/EvalContext';

const NAV_ICONS: Record<string, typeof LayoutDashboard> = {
  admin_dashboard: LayoutDashboard,
  admin_users: Users,
  admin_subjects: BookOpen,
  admin_exams: FileText,
  admin_intake: ScanLine,
  admin_assignments: UserCheck,
  admin_requests: Inbox,
  admin_results: FileCheck2,
  admin_audit: ShieldCheck,
  admin_settings: Settings,

  teacher_dashboard: LayoutDashboard,
  teacher_papers: FileSpreadsheet,
  teacher_queue: ClipboardCheck,
  teacher_ocr: ScanLine,
  teacher_reeval: RefreshCw,
  teacher_reports: FileText,
  teacher_profile: SlidersHorizontal,

  student_home: Home,
  student_results: FileCheck2,
  student_requests: Inbox,
  student_notifications: Bell,
};

export function AppShell({ children }: { children: React.ReactNode }) {
  const {
    state,
    currentUser,
    activeView,
    setActiveView,
    globalSearch,
    setGlobalSearch,
    logout,
    markNotificationRead,
    markAllNotificationsRead,
    processingQueue,
  } = useEval();

  const [collapsed, setCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  if (!currentUser) return null;

  const navItems = STRINGS.nav[currentUser.role];
  const myNotifications = state.notifications.filter((n) => n.userId === currentUser.id);
  const unreadCount = myNotifications.filter((n) => !n.read).length;

  const activeLabel = navItems.find((n) => n.id === activeView)?.label || 'Workspace';

  const handleNavClick = (id: string) => {
    setActiveView(id);
    setMobileMenuOpen(false);
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#f8f9ff] text-[#0b1c30]">
      {/* Fixed 48px Dense Top App Bar */}
      <header className="h-12 bg-white border-b border-[#e2e8f0] px-4 flex items-center justify-between gap-4 sticky top-0 z-30 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={() => setMobileMenuOpen((v) => !v)}
            aria-label="Toggle navigation menu"
            className="lg:hidden p-1.5 rounded text-[#414752] hover:bg-slate-100"
          >
            {mobileMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
          </button>

          <button
            type="button"
            onClick={() => setCollapsed((v) => !v)}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className="hidden lg:inline-flex p-1.5 rounded text-[#414752] hover:bg-slate-100"
          >
            {collapsed ? <PanelLeftOpen className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
          </button>

          <div className="flex items-center gap-2 min-w-0">
            <span className="font-semibold text-sm tracking-tight text-[#0b1c30] whitespace-nowrap">
              {STRINGS.appName}
            </span>
            <span className="text-[#c1c6d4]" aria-hidden="true">
              /
            </span>
            <span className="text-xs font-medium text-[#414752] truncate">
              {STRINGS.roles[currentUser.role]}
            </span>
            <span className="text-[#c1c6d4] hidden sm:inline" aria-hidden="true">
              /
            </span>
            <span className="text-xs font-semibold text-[#005dac] truncate hidden sm:inline">
              {activeLabel}
            </span>
          </div>
        </div>

        {/* Global Search + Notifications + User Menu */}
        <div className="flex items-center gap-2.5 shrink-0">
          <div className="relative hidden md:block">
            <Search className="w-3.5 h-3.5 text-[#64748b] absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="search"
              value={globalSearch}
              onChange={(e) => setGlobalSearch(e.target.value)}
              aria-label="Search papers, students, or sheets"
              placeholder="Search papers, roll no..."
              className="w-56 pl-8 pr-3 py-1.5 text-xs bg-[#f8f9ff] border border-[#e2e8f0] rounded focus:outline-none focus:bg-white focus:border-[#005dac]"
            />
          </div>

          {/* Notifications button & popover */}
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setNotifOpen((v) => !v);
                setUserMenuOpen(false);
              }}
              aria-label={`Notifications (${unreadCount} unread)`}
              className="relative p-1.5 rounded border border-transparent hover:border-[#e2e8f0] hover:bg-slate-50 text-[#414752]"
            >
              <Bell className="w-4 h-4" />
              {unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-[#ba1a1a] text-white text-[10px] font-semibold flex items-center justify-center tabular-nums">
                  {unreadCount}
                </span>
              )}
            </button>

            {notifOpen && (
              <div className="absolute right-0 mt-1.5 w-80 bg-white border border-[#e2e8f0] rounded-lg shadow-lg z-40 overflow-hidden">
                <div className="px-3.5 py-2.5 border-b border-[#e2e8f0] flex items-center justify-between">
                  <span className="text-xs font-semibold text-[#0b1c30]">Notifications</span>
                  {unreadCount > 0 && (
                    <button
                      type="button"
                      onClick={markAllNotificationsRead}
                      className="text-[11px] font-medium text-[#005dac] hover:underline"
                    >
                      Mark all read
                    </button>
                  )}
                </div>
                <div className="max-h-72 overflow-y-auto divide-y divide-[#e2e8f0]">
                  {myNotifications.length === 0 ? (
                    <div className="p-4 text-xs text-[#64748b] text-center">No notifications yet.</div>
                  ) : (
                    myNotifications.slice(0, 8).map((n) => (
                      <button
                        key={n.id}
                        type="button"
                        onClick={() => {
                          markNotificationRead(n.id);
                          if (n.linkView) setActiveView(n.linkView);
                          setNotifOpen(false);
                        }}
                        className={`w-full text-left px-3.5 py-2.5 hover:bg-[#eff4ff] transition-colors ${
                          n.read ? 'bg-white' : 'bg-[#f8f9ff]'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-semibold text-[#0b1c30]">{n.title}</span>
                          {!n.read && <span className="text-[10px] font-semibold text-[#005dac]">New</span>}
                        </div>
                        <p className="text-xs text-[#414752] mt-0.5 line-clamp-2">{n.message}</p>
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* User menu */}
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setUserMenuOpen((v) => !v);
                setNotifOpen(false);
              }}
              className="flex items-center gap-2 px-2.5 py-1 rounded border border-[#e2e8f0] bg-white hover:bg-slate-50 text-xs font-medium text-[#0b1c30]"
            >
              <span className="w-5 h-5 rounded bg-[#d4e3ff] text-[#004786] text-[11px] font-semibold flex items-center justify-center shrink-0">
                {currentUser.name
                  .split(' ')
                  .map((p) => p[0])
                  .slice(0, 2)
                  .join('')}
              </span>
              <span className="hidden sm:inline truncate max-w-[140px]">{currentUser.name}</span>
            </button>

            {userMenuOpen && (
              <div className="absolute right-0 mt-1.5 w-60 bg-white border border-[#e2e8f0] rounded-lg shadow-lg z-40 py-1.5">
                <div className="px-3.5 py-2 border-b border-[#e2e8f0]">
                  <p className="text-xs font-semibold text-[#0b1c30] truncate">{currentUser.name}</p>
                  <p className="text-[11px] text-[#64748b] truncate">
                    {currentUser.rollNumber || currentUser.email}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setUserMenuOpen(false);
                    logout();
                  }}
                  className="w-full text-left px-3.5 py-2 text-xs text-[#ba1a1a] hover:bg-[#ffdad6]/40 flex items-center gap-2"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Sign out</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Background processing queue bar (docked below App Bar per design system) */}
      {processingQueue.length > 0 && (
        <div className="bg-[#eff4ff] border-b border-[#a5c8ff] px-4 py-1.5 flex items-center justify-between gap-4 text-xs">
          <div className="flex items-center gap-2 text-[#004786] font-medium">
            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            <span>
              Processing sheet 1 of {processingQueue.length}: {processingQueue[0].fileName} (
              {processingQueue[0].progressPct}%)
            </span>
          </div>
          <div className="w-40 h-1.5 bg-[#d4e3ff] rounded overflow-hidden">
            <div
              className="h-full bg-[#005dac] transition-all duration-300"
              style={{ width: `${processingQueue[0].progressPct}%` }}
            />
          </div>
        </div>
      )}

      <div className="flex flex-1 min-h-0">
        {/* Desktop Permanent Sidebar (240px or 64px collapsed) */}
        <aside
          className={`hidden lg:flex flex-col bg-white border-r border-[#e2e8f0] shrink-0 transition-all duration-150 ${
            collapsed ? 'w-16' : 'w-60'
          }`}
        >
          <nav aria-label="Role navigation" className="flex-1 p-2.5 space-y-1 overflow-y-auto">
            {navItems.map((item) => {
              const Icon = NAV_ICONS[item.id] || CheckCircle2;
              const isActive =
                activeView === item.id ||
                (item.id === 'teacher_papers' &&
                  (activeView === 'teacher_paper_sheets' || activeView === 'teacher_workspace')) ||
                (item.id === 'student_results' && activeView === 'student_result_detail') ||
                (item.id === 'student_requests' && activeView === 'student_sheet_viewer');

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleNavClick(item.id)}
                  title={collapsed ? item.label : undefined}
                  aria-label={item.label}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded text-xs font-medium transition-colors whitespace-nowrap ${
                    isActive
                      ? 'bg-[#e3f2fd] text-[#005dac] font-semibold'
                      : 'text-[#414752] hover:bg-slate-100 hover:text-[#0b1c30]'
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" aria-hidden="true" />
                  {!collapsed && <span className="truncate">{item.label}</span>}
                </button>
              );
            })}
          </nav>

          {!collapsed && (
            <div className="p-3 border-t border-[#e2e8f0] text-[11px] text-[#64748b] space-y-0.5">
              <div className="font-medium text-[#0b1c30] truncate">
                {state.settings.institutionName || 'Local College Server'}
              </div>
              <div>AY {state.settings.academicYear} · Local storage</div>
            </div>
          )}
        </aside>

        {/* Mobile/Tablet Temporary Drawer */}
        {mobileMenuOpen && (
          <div className="fixed inset-0 z-40 lg:hidden flex">
            <div className="w-64 bg-white border-r border-[#e2e8f0] h-full flex flex-col p-3 space-y-1 shadow-xl">
              <div className="flex items-center justify-between pb-2 mb-2 border-b border-[#e2e8f0]">
                <span className="text-sm font-semibold text-[#0b1c30]">{STRINGS.appName}</span>
                <button
                  type="button"
                  onClick={() => setMobileMenuOpen(false)}
                  aria-label="Close navigation menu"
                  className="p-1 rounded text-slate-500 hover:bg-slate-100"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              {navItems.map((item) => {
                const Icon = NAV_ICONS[item.id] || CheckCircle2;
                const isActive = activeView === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleNavClick(item.id)}
                    className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded text-xs font-medium whitespace-nowrap ${
                      isActive ? 'bg-[#e3f2fd] text-[#005dac] font-semibold' : 'text-[#414752] hover:bg-slate-100'
                    }`}
                  >
                    <Icon className="w-4 h-4 shrink-0" aria-hidden="true" />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </div>
            <div
              className="flex-1 bg-slate-900/35"
              onClick={() => setMobileMenuOpen(false)}
              aria-hidden="true"
            />
          </div>
        )}

        {/* Main Viewport */}
        <main className="flex-1 min-w-0 flex flex-col">{children}</main>
      </div>
    </div>
  );
}
