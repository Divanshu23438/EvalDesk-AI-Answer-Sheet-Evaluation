import { useMemo, useState } from 'react';
import { BarChart3, Download, RotateCcw, Search, Settings, ShieldCheck } from 'lucide-react';
import { useEval } from '../../store/EvalContext';
import { computeWorkspaceMetrics, generateCsvDownload } from '../../utils/gradingEngine';
import { ConfirmDialog } from '../ui/ConfirmDialog';

export function AdminSettingsAudit() {
  const { state, updateSettings, resolveProblemReport, resetInstitutionWorkspace } = useEval();
  const [tab, setTab] = useState<'settings' | 'audit' | 'reports'>('settings');
  const [auditSearch, setAuditSearch] = useState('');
  const [savedNotice, setSavedNotice] = useState('');
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false);

  const metrics = useMemo(
    () => computeWorkspaceMetrics(state.sheets, state.papers),
    [state.sheets, state.papers]
  );

  const filteredAudit = state.auditLogs.filter((a) => {
    if (!auditSearch.trim()) return true;
    const q = auditSearch.toLowerCase();
    return (
      a.actorName.toLowerCase().includes(q) ||
      a.action.toLowerCase().includes(q) ||
      a.target.toLowerCase().includes(q)
    );
  });

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    setSavedNotice('Settings saved and logged.');
    window.setTimeout(() => setSavedNotice(''), 3000);
  };

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto w-full space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-[#0b1c30]">Settings, Audit Log & Reports</h1>
          <p className="text-xs text-[#64748b] mt-0.5">
            Configure institution details, grading thresholds, retention, timeouts, and inspect immutable audit entries.
          </p>
        </div>

        <div className="inline-flex p-1 bg-slate-100 rounded-md self-start">
          {[
            { id: 'settings', label: 'Settings (A10)', Icon: Settings },
            { id: 'audit', label: 'Audit Log (A11)', Icon: ShieldCheck },
            { id: 'reports', label: 'Reports', Icon: BarChart3 },
          ].map(({ id, label, Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id as typeof tab)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold ${
                tab === id ? 'bg-white text-[#005dac] shadow-xs' : 'text-[#414752] hover:text-[#0b1c30]'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{label}</span>
            </button>
          ))}
        </div>
      </div>

      {tab === 'settings' && (
        <div className="space-y-5">
          <form onSubmit={handleSaveSettings} className="bg-white border border-[#e2e8f0] rounded-lg p-5 space-y-5">
            {savedNotice && (
              <div className="p-2.5 rounded bg-[#e8f5e9] border border-[#88d982] text-xs text-[#196b22]">
                {savedNotice}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs pb-4 border-b border-[#e2e8f0]">
              <div>
                <label className="block font-semibold text-[#0b1c30] mb-1">Institution Name</label>
                <input
                  type="text"
                  value={state.settings.institutionName}
                  onChange={(e) => updateSettings({ institutionName: e.target.value })}
                  className="w-full rounded border border-[#c1c6d4] px-3 py-1.5"
                />
              </div>
              <div>
                <label className="block font-semibold text-[#0b1c30] mb-1">Academic Year</label>
                <input
                  type="text"
                  value={state.settings.academicYear}
                  onChange={(e) => updateSettings({ academicYear: e.target.value })}
                  className="w-full rounded border border-[#c1c6d4] px-3 py-1.5 font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
              <div>
                <label className="block font-semibold text-[#0b1c30] mb-1">Strict Mode Profile</label>
                <textarea
                  rows={2}
                  value={state.settings.strictProfileNote}
                  onChange={(e) => updateSettings({ strictProfileNote: e.target.value })}
                  className="w-full rounded border border-[#c1c6d4] p-2"
                />
              </div>
              <div>
                <label className="block font-semibold text-[#0b1c30] mb-1">Lenient Mode Profile</label>
                <textarea
                  rows={2}
                  value={state.settings.lenientProfileNote}
                  onChange={(e) => updateSettings({ lenientProfileNote: e.target.value })}
                  className="w-full rounded border border-[#c1c6d4] p-2"
                />
              </div>
              <div>
                <label className="block font-semibold text-[#0b1c30] mb-1">Maths Mode Profile</label>
                <textarea
                  rows={2}
                  value={state.settings.mathsProfileNote}
                  onChange={(e) => updateSettings({ mathsProfileNote: e.target.value })}
                  className="w-full rounded border border-[#c1c6d4] p-2"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 text-xs">
              <div>
                <label className="block font-semibold text-[#414752] mb-1">High Conf. (%)</label>
                <input
                  type="number"
                  value={state.settings.highConfidenceThreshold}
                  onChange={(e) => updateSettings({ highConfidenceThreshold: Number(e.target.value) })}
                  className="w-full rounded border border-[#c1c6d4] px-2.5 py-1.5 tabular-nums"
                />
              </div>
              <div>
                <label className="block font-semibold text-[#414752] mb-1">Medium Conf. (%)</label>
                <input
                  type="number"
                  value={state.settings.mediumConfidenceThreshold}
                  onChange={(e) => updateSettings({ mediumConfidenceThreshold: Number(e.target.value) })}
                  className="w-full rounded border border-[#c1c6d4] px-2.5 py-1.5 tabular-nums"
                />
              </div>
              <div>
                <label className="block font-semibold text-[#414752] mb-1">Default Spot-Check %</label>
                <input
                  type="number"
                  value={state.settings.defaultSpotCheckPct}
                  onChange={(e) => updateSettings({ defaultSpotCheckPct: Number(e.target.value) })}
                  className="w-full rounded border border-[#c1c6d4] px-2.5 py-1.5 tabular-nums"
                />
              </div>
              <div>
                <label className="block font-semibold text-[#414752] mb-1">Scan Retention (Days)</label>
                <input
                  type="number"
                  value={state.settings.scanRetentionDays}
                  onChange={(e) => updateSettings({ scanRetentionDays: Number(e.target.value) })}
                  className="w-full rounded border border-[#c1c6d4] px-2.5 py-1.5 tabular-nums"
                />
              </div>
              <div>
                <label className="block font-semibold text-[#414752] mb-1">Request View (Days)</label>
                <input
                  type="number"
                  value={state.settings.defaultRequestViewDays}
                  onChange={(e) => updateSettings({ defaultRequestViewDays: Number(e.target.value) })}
                  className="w-full rounded border border-[#c1c6d4] px-2.5 py-1.5 tabular-nums"
                />
              </div>
              <div>
                <label className="block font-semibold text-[#414752] mb-1">Session Timeout (Min)</label>
                <input
                  type="number"
                  value={state.settings.sessionTimeoutMinutes}
                  onChange={(e) => updateSettings({ sessionTimeoutMinutes: Number(e.target.value) })}
                  className="w-full rounded border border-[#c1c6d4] px-2.5 py-1.5 tabular-nums"
                />
              </div>
            </div>

            <div className="pt-3 border-t border-[#e2e8f0] space-y-2.5 text-xs">
              <label className="flex items-start gap-2.5 text-[#0b1c30]">
                <input
                  type="checkbox"
                  checked={state.settings.allowTrainingDataConsent}
                  onChange={(e) => updateSettings({ allowTrainingDataConsent: e.target.checked })}
                  className="mt-0.5"
                />
                <span>
                  <strong>Allow teacher OCR corrections as local training data</strong> (Teachers are informed that verified line edits remain strictly on the college server to improve local handwriting recognition).
                </span>
              </label>
              <label className="flex items-center gap-2.5 text-[#0b1c30]">
                <input
                  type="checkbox"
                  checked={state.settings.showClassAverageToStudents}
                  onChange={(e) => updateSettings({ showClassAverageToStudents: e.target.checked })}
                />
                <span>Show optional class average on Student Result Detail (S3)</span>
              </label>
              <label className="flex items-center gap-2.5 text-[#0b1c30]">
                <input
                  type="checkbox"
                  checked={state.settings.showQuestionFeedbackToStudents}
                  onChange={(e) => updateSettings({ showQuestionFeedbackToStudents: e.target.checked })}
                />
                <span>Show teacher per-question feedback to students (S3)</span>
              </label>
            </div>

            {/* Open Problem Reports from Teachers */}
            {state.problemReports.length > 0 && (
              <div className="pt-4 border-t border-[#e2e8f0] space-y-2">
                <div className="text-xs font-semibold text-[#0b1c30]">Reported Sheet Problems</div>
                {state.problemReports.map((r) => (
                  <div key={r.id} className="p-3 rounded border border-[#e2e8f0] bg-[#f8f9ff] flex items-center justify-between gap-3 text-xs">
                    <div>
                      <span className="font-semibold text-[#0b1c30]">{r.sheetId}</span>
                      <span className="mx-1.5 text-[#c1c6d4]">·</span>
                      <span className="text-[#875200] font-medium">{r.category.replace('_', ' ')}</span>
                      <span className="mx-1.5 text-[#c1c6d4]">·</span>
                      <span className="text-[#414752]">{r.description}</span>
                    </div>
                    {r.resolved ? (
                      <span className="text-[#196b22] font-semibold">Resolved</span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => resolveProblemReport(r.id)}
                        className="px-2.5 py-1 rounded border border-[#c1c6d4] bg-white hover:bg-slate-50 font-semibold"
                      >
                        Mark Resolved
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}

            <div className="flex justify-end">
              <button type="submit" className="px-4 py-2 rounded bg-[#005dac] text-white text-xs font-semibold">
                Save Settings
              </button>
            </div>
          </form>

          {/* Danger Zone: Reset Institution Workspace */}
          <div className="bg-white border border-[#ffdad6] rounded-lg p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-sm font-semibold text-[#93000a]">Reset Institution Workspace</h2>
              <p className="text-xs text-[#64748b] mt-0.5">
                Clears all institution records, accounts, papers, and answer sheets from local browser storage and returns to initial Institution Setup.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setResetConfirmOpen(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded border border-[#ba1a1a] text-[#ba1a1a] hover:bg-[#ffdad6]/40 text-xs font-semibold whitespace-nowrap shrink-0"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset Institution Workspace</span>
            </button>
          </div>
        </div>
      )}

      {tab === 'audit' && (
        <div className="bg-white border border-[#e2e8f0] rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b border-[#e2e8f0] flex flex-wrap items-center justify-between gap-3">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-[#64748b] absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="search"
                value={auditSearch}
                onChange={(e) => setAuditSearch(e.target.value)}
                placeholder="Search actor, action, or target..."
                className="pl-8 pr-3 py-1.5 text-xs border border-[#c1c6d4] rounded"
              />
            </div>
            <button
              type="button"
              onClick={() =>
                generateCsvDownload(
                  'evaldesk-audit-log.csv',
                  ['Timestamp', 'Actor', 'Role', 'Action', 'Target', 'Old Value', 'New Value'],
                  filteredAudit.map((a) => [
                    a.timestamp,
                    a.actorName,
                    a.actorRole,
                    a.action,
                    a.target,
                    a.oldValue || '',
                    a.newValue || '',
                  ])
                )
              }
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded border border-[#c1c6d4] text-xs font-semibold text-[#0b1c30]"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export Audit CSV</span>
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-[#e2e8f0] text-[#64748b] uppercase text-[11px]">
                <tr>
                  <th className="py-2.5 px-4">When</th>
                  <th className="py-2.5 px-4">Who</th>
                  <th className="py-2.5 px-4">What</th>
                  <th className="py-2.5 px-4">Target</th>
                  <th className="py-2.5 px-4">Old → New</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#e2e8f0]">
                {filteredAudit.map((a) => (
                  <tr key={a.id} className="hover:bg-[#f8f9ff]">
                    <td className="py-2.5 px-4 font-mono text-[11px] text-[#64748b] whitespace-nowrap">
                      {new Date(a.timestamp).toLocaleString()}
                    </td>
                    <td className="py-2.5 px-4 font-medium text-[#0b1c30]">
                      {a.actorName} <span className="text-[#64748b]">({a.actorRole})</span>
                    </td>
                    <td className="py-2.5 px-4 font-semibold text-[#005dac]">{a.action}</td>
                    <td className="py-2.5 px-4 text-[#0b1c30]">{a.target}</td>
                    <td className="py-2.5 px-4 text-[#414752]">
                      {a.oldValue || '—'} → {a.newValue || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'reports' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white border border-[#e2e8f0] rounded-lg p-4">
              <div className="text-xs text-[#64748b]">Evaluation Progress</div>
              <div className="text-2xl font-semibold text-[#0b1c30] tabular-nums mt-1">
                {metrics.evaluatedSheets} / {metrics.totalSheets}
              </div>
              <div className="text-[11px] text-[#64748b] mt-0.5">Sheets finalized</div>
            </div>
            <div className="bg-white border border-[#e2e8f0] rounded-lg p-4">
              <div className="text-xs text-[#64748b]">AI vs Teacher Agreement</div>
              <div className="text-2xl font-semibold text-[#196b22] tabular-nums mt-1">
                {metrics.aiAgreementPct}%
              </div>
              <div className="text-[11px] text-[#64748b] mt-0.5">Within ±0.5 marks</div>
            </div>
            <div className="bg-white border border-[#e2e8f0] rounded-lg p-4">
              <div className="text-xs text-[#64748b]">Teacher Override Rate</div>
              <div className="text-2xl font-semibold text-[#875200] tabular-nums mt-1">
                {metrics.overrideRatePct}%
              </div>
              <div className="text-[11px] text-[#64748b] mt-0.5">Questions manually edited</div>
            </div>
            <div className="bg-white border border-[#e2e8f0] rounded-lg p-4">
              <div className="text-xs text-[#64748b]">Avg Time per Sheet</div>
              <div className="text-2xl font-semibold text-[#005dac] tabular-nums mt-1">
                {metrics.avgTimeSeconds}s
              </div>
              <div className="text-[11px] text-[#64748b] mt-0.5">Evaluated sheets</div>
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="button"
              onClick={() =>
                generateCsvDownload(
                  'evaldesk-pilot-metrics.csv',
                  ['Metric', 'Value'],
                  [
                    ['Total Sheets', metrics.totalSheets],
                    ['Evaluated Sheets', metrics.evaluatedSheets],
                    ['AI Agreement (%)', metrics.aiAgreementPct],
                    ['Teacher Override Rate (%)', metrics.overrideRatePct],
                    ['Avg Time Per Sheet (s)', metrics.avgTimeSeconds],
                  ]
                )
              }
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded border border-[#c1c6d4] bg-white text-xs font-semibold text-[#0b1c30]"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export Pilot Report CSV</span>
            </button>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={resetConfirmOpen}
        title="Reset Institution Workspace"
        description="This permanently wipes all local institution users, subjects, papers, sheets, and audit entries from this browser so you can initialize a fresh institution."
        confirmLabel="Wipe & Reset"
        danger
        requireReason
        reasonPlaceholder="e.g., End of academic term / fresh server setup"
        onCancel={() => setResetConfirmOpen(false)}
        onConfirm={() => {
          setResetConfirmOpen(false);
          resetInstitutionWorkspace();
        }}
      />
    </div>
  );
}
