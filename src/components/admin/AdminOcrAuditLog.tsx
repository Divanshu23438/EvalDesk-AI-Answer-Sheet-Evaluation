import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  ArrowUpRight,
  Cpu,
  Download,
  RefreshCw,
  ScanLine,
  Search,
  ShieldCheck,
} from 'lucide-react';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useEval } from '../../store/EvalContext';
import type { OcrAuditRecord, OcrEngineType } from '../../types/eval';
import { fetchServerOcrAudit } from '../../utils/apiOcr';
import { generateCsvDownload } from '../../utils/gradingEngine';
import {
  buildOcrTrendSeries,
  buildUnifiedOcrAuditRows,
  computeOcrAuditStats,
  filterOcrAuditRows,
  type EngineFilterOption,
  type OcrTrendPoint,
} from '../../utils/ocrAudit';
import { ConfidenceBadge } from '../ui/StatusBadge';

interface AdminOcrAuditLogProps {
  embedded?: boolean;
}

function getEngineDotColor(engine: OcrEngineType): string {
  if (engine === 'gemini') return '#005dac';
  if (engine === 'groq') return '#d97706';
  return '#475569';
}

function EngineBadge({ engine, label }: { engine: OcrEngineType; label: string }) {
  const style =
    engine === 'gemini'
      ? 'bg-[#eff4ff] border-[#a5c8ff] text-[#004786]'
      : engine === 'groq'
      ? 'bg-[#fff8e1] border-[#ffb865] text-[#875200]'
      : 'bg-slate-100 border-[#c1c6d4] text-[#414752]';

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border text-[11px] font-semibold whitespace-nowrap ${style}`}>
      <Cpu className="w-3 h-3 shrink-0" />
      <span>{label}</span>
    </span>
  );
}

function OcrTrendTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { payload?: OcrTrendPoint }[];
}) {
  if (!active || !payload || payload.length === 0) return null;
  const pt = payload[0]?.payload;
  if (!pt) return null;

  return (
    <div className="bg-white border border-[#c1c6d4] rounded-lg shadow-md p-3 text-xs space-y-1.5 max-w-[260px]">
      <div className="font-semibold text-[#0b1c30] truncate">{pt.fileName}</div>
      <div className="text-[11px] text-[#64748b] font-mono">
        {new Date(pt.timestamp).toLocaleString()}
      </div>
      <div className="flex items-center justify-between gap-3 pt-1 border-t border-[#e2e8f0]">
        <span className="text-[#414752]">OCR Confidence</span>
        <span className="font-mono font-semibold text-[#005dac] tabular-nums">
          {pt.confidenceScore}%
        </span>
      </div>
      <div className="flex items-center justify-between gap-3">
        <span className="text-[#414752]">Rolling Avg</span>
        <span className="font-mono font-semibold text-[#196b22] tabular-nums">
          {pt.rollingAvg}%
        </span>
      </div>
      <div className="pt-1 border-t border-[#e2e8f0] space-y-0.5">
        <div className="text-[11px] font-semibold text-[#0b1c30]">{pt.engineLabel}</div>
        <div className="text-[11px] font-mono text-[#64748b]">
          {pt.model} · {pt.questionCount} Q(s)
        </div>
      </div>
    </div>
  );
}

export function AdminOcrAuditLog({ embedded = false }: AdminOcrAuditLogProps) {
  const { state, setActiveView } = useEval();
  const [serverLogs, setServerLogs] = useState<OcrAuditRecord[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [engineFilter, setEngineFilter] = useState<EngineFilterOption>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const syncServerLogs = useCallback(async () => {
    setSyncing(true);
    try {
      const records = await fetchServerOcrAudit<OcrAuditRecord>();
      setServerLogs(records);
    } finally {
      setSyncing(false);
    }
  }, []);

  useEffect(() => {
    void syncServerLogs();
  }, [syncServerLogs]);

  const unifiedRows = useMemo(
    () =>
      buildUnifiedOcrAuditRows({
        ocrAuditLogs: state.ocrAuditLogs || [],
        serverAuditLogs: serverLogs,
        sheets: state.sheets,
        papers: state.papers,
        subjects: state.subjects,
        users: state.users,
        settings: state.settings,
      }),
    [state.ocrAuditLogs, serverLogs, state.sheets, state.papers, state.subjects, state.users, state.settings]
  );

  const filteredRows = useMemo(
    () => filterOcrAuditRows(unifiedRows, { engineFilter, searchQuery }),
    [unifiedRows, engineFilter, searchQuery]
  );

  const stats = useMemo(() => computeOcrAuditStats(filteredRows), [filteredRows]);
  const allStats = useMemo(() => computeOcrAuditStats(unifiedRows), [unifiedRows]);
  const trendData = useMemo(() => buildOcrTrendSeries(filteredRows), [filteredRows]);

  const visibleTableRows = embedded ? filteredRows.slice(0, 12) : filteredRows;
  const highTarget = state.settings.highConfidenceThreshold || 85;

  const handleExportCsv = () => {
    generateCsvDownload(
      'evaldesk-ocr-audit-log.csv',
      [
        'Timestamp',
        'Answer Sheet',
        'Student',
        'Subject / Paper',
        'Engine',
        'Model',
        'Confidence (%)',
        'Confidence Level',
        'Questions',
        'Fallback Triggered',
        'Fallback Reason',
        'Rubric Graded',
      ],
      filteredRows.map((r) => [
        r.timestamp,
        r.fileName,
        r.studentLabel || '',
        r.subjectLabel || r.paperId || '',
        r.engineLabel,
        r.model,
        r.confidenceScore,
        r.confidence,
        r.questionCount,
        r.fallbackTriggered ? 'Yes' : 'No',
        r.fallbackReason || '',
        r.evaluatedWithRubric ? 'Yes' : 'No',
      ])
    );
  };

  return (
    <section
      aria-label="OCR Performance & Engine Audit Log"
      className={embedded ? 'space-y-4' : 'p-4 sm:p-6 max-w-7xl mx-auto w-full space-y-5'}
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          {embedded ? (
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-[#005dac]" />
              <h2 className="text-base font-semibold text-[#0b1c30]">
                Audit Log — OCR Confidence & Engine Usage
              </h2>
            </div>
          ) : (
            <h1 className="text-xl font-semibold text-[#0b1c30]">
              Audit Log — OCR Confidence & Engine Usage
            </h1>
          )}
          <p className="text-xs text-[#64748b] mt-0.5">
            Tracks OCR confidence scores, primary vs fallback engine usage, and performance trends across all processed answer sheets.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => void syncServerLogs()}
            disabled={syncing}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded border border-[#c1c6d4] bg-white hover:bg-slate-50 text-xs font-semibold text-[#0b1c30] disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
            <span>{syncing ? 'Syncing...' : 'Refresh'}</span>
          </button>
          <button
            type="button"
            onClick={handleExportCsv}
            disabled={filteredRows.length === 0}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded border border-[#c1c6d4] bg-white hover:bg-slate-50 disabled:opacity-40 text-xs font-semibold text-[#0b1c30]"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>
          {embedded && (
            <button
              type="button"
              onClick={() => setActiveView('admin_audit')}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded bg-[#eff4ff] border border-[#a5c8ff] hover:bg-[#d4e3ff] text-xs font-semibold text-[#004786]"
            >
              <span>Full Audit View</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white border border-[#e2e8f0] rounded-lg p-4">
          <div className="text-xs font-medium text-[#64748b]">Processed Sheets</div>
          <div className="text-2xl font-semibold text-[#0b1c30] tabular-nums mt-1">
            {stats.totalProcessed}
          </div>
          <div className="text-[11px] text-[#64748b] mt-1">
            {filteredRows.filter((r) => r.evaluatedWithRubric).length} evaluated with rubric
          </div>
        </div>

        <div className="bg-white border border-[#e2e8f0] rounded-lg p-4">
          <div className="text-xs font-medium text-[#64748b]">Avg OCR Confidence</div>
          <div
            className={`text-2xl font-semibold tabular-nums mt-1 ${
              stats.avgConfidencePct >= highTarget
                ? 'text-[#196b22]'
                : stats.avgConfidencePct >= (state.settings.mediumConfidenceThreshold || 65)
                ? 'text-[#875200]'
                : stats.totalProcessed === 0
                ? 'text-[#0b1c30]'
                : 'text-[#ba1a1a]'
            }`}
          >
            {stats.totalProcessed > 0 ? `${stats.avgConfidencePct}%` : '—'}
          </div>
          <div className="text-[11px] text-[#64748b] mt-1 tabular-nums">
            {stats.highConfidenceCount} high · {stats.mediumConfidenceCount} med · {stats.lowConfidenceCount} low
          </div>
        </div>

        <div className="bg-white border border-[#e2e8f0] rounded-lg p-4 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-0.5 text-xs font-medium text-[#64748b]">
            <span>Engine Usage Split</span>
            <span className="font-mono text-[11px] text-[#0b1c30] tabular-nums whitespace-nowrap">
              {allStats.geminiCount}G · {allStats.groqCount}Q · {allStats.localCount}L
            </span>
          </div>
          <div className="h-2 w-full rounded bg-slate-100 overflow-hidden flex">
            {allStats.totalProcessed > 0 && (
              <>
                {allStats.geminiSharePct > 0 && (
                  <div
                    className="h-full bg-[#005dac]"
                    style={{ width: `${allStats.geminiSharePct}%` }}
                    title={`Gemini Primary: ${allStats.geminiSharePct}%`}
                  />
                )}
                {allStats.groqSharePct > 0 && (
                  <div
                    className="h-full bg-[#d97706]"
                    style={{ width: `${allStats.groqSharePct}%` }}
                    title={`Groq Fallback: ${allStats.groqSharePct}%`}
                  />
                )}
                {allStats.localSharePct > 0 && (
                  <div
                    className="h-full bg-[#64748b]"
                    style={{ width: `${allStats.localSharePct}%` }}
                    title={`Local Queue: ${allStats.localSharePct}%`}
                  />
                )}
              </>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[11px] text-[#414752]">
            <span className="inline-flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-[#005dac]" /> Gemini ({allStats.geminiSharePct}%)
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-[#d97706]" /> Groq ({allStats.groqSharePct}%)
            </span>
            {allStats.localCount > 0 && (
              <span className="inline-flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-[#64748b]" /> Local ({allStats.localSharePct}%)
              </span>
            )}
          </div>
        </div>

        <div className="bg-white border border-[#e2e8f0] rounded-lg p-4">
          <div className="text-xs font-medium text-[#64748b]">Groq Fallback Rate</div>
          <div
            className={`text-2xl font-semibold tabular-nums mt-1 ${
              stats.fallbackRatePct > 0 ? 'text-[#875200]' : 'text-[#0b1c30]'
            }`}
          >
            {stats.totalProcessed > 0 ? `${stats.fallbackRatePct}%` : '0%'}
          </div>
          <div className="text-[11px] text-[#64748b] mt-1 tabular-nums">
            {stats.fallbackCount} fallback execution(s)
          </div>
        </div>
      </div>

      {/* Recharts Trend Line Chart */}
      <div className="bg-white border border-[#e2e8f0] rounded-lg p-4 sm:p-5 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-[#005dac]" />
              <h3 className="text-sm font-semibold text-[#0b1c30]">
                OCR Performance Trend Over Time
              </h3>
            </div>
            <p className="text-[11px] text-[#64748b] mt-0.5">
              Per-sheet OCR confidence (%) and cumulative rolling average across chronological sheet runs (target threshold: {highTarget}%).
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Filter OCR engine">
            {(
              [
                { id: 'all', label: `All (${allStats.totalProcessed})` },
                { id: 'gemini', label: `Gemini (${allStats.geminiCount})` },
                { id: 'groq', label: `Groq (${allStats.groqCount})` },
                { id: 'local', label: `Local (${allStats.localCount})` },
              ] as const
            ).map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setEngineFilter(opt.id)}
                className={`px-2.5 py-1 rounded text-[11px] font-semibold border transition-colors ${
                  engineFilter === opt.id
                    ? 'bg-[#005dac] border-[#005dac] text-white'
                    : 'bg-[#f8f9ff] border-[#e2e8f0] text-[#414752] hover:bg-slate-100'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {trendData.length === 0 ? (
          <div className="h-56 rounded border border-dashed border-[#c1c6d4] bg-[#f8f9ff] flex flex-col items-center justify-center p-6 text-center space-y-2.5">
            <ScanLine className="w-6 h-6 text-[#64748b]" />
            <div className="text-xs font-semibold text-[#0b1c30]">
              No processed answer sheets recorded yet
            </div>
            <p className="text-xs text-[#64748b] max-w-md">
              Run OCR in Sheet Intake or Teacher Workspace to start tracking confidence trends and Gemini vs Groq engine usage over time.
            </p>
            <button
              type="button"
              onClick={() => setActiveView('admin_intake')}
              className="px-3.5 py-1.5 rounded bg-[#005dac] hover:bg-[#004786] text-white text-xs font-semibold"
            >
              Go to Sheet Intake
            </button>
          </div>
        ) : (
          <div className="h-64 w-full min-w-0" data-testid="ocr-trend-chart">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trendData} margin={{ top: 10, right: 18, left: -12, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis
                  dataKey="shortLabel"
                  tick={{ fontSize: 11, fill: '#64748b' }}
                  stroke="#c1c6d4"
                  minTickGap={20}
                />
                <YAxis
                  domain={[0, 100]}
                  ticks={[0, 25, 50, 75, 100]}
                  tickFormatter={(v) => `${v}%`}
                  tick={{ fontSize: 11, fill: '#64748b' }}
                  stroke="#c1c6d4"
                />
                <Tooltip content={<OcrTrendTooltip />} />
                <Legend
                  wrapperStyle={{ fontSize: '11px', paddingTop: '6px' }}
                />
                <ReferenceLine
                  y={highTarget}
                  stroke="#88d982"
                  strokeDasharray="4 4"
                  label={{
                    value: `Target ${highTarget}%`,
                    position: 'insideBottomLeft',
                    fill: '#196b22',
                    fontSize: 10,
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="confidenceScore"
                  name="Sheet Confidence (%)"
                  stroke="#005dac"
                  strokeWidth={2.5}
                  isAnimationActive={false}
                  dot={(dotProps: {
                    cx?: number;
                    cy?: number;
                    payload?: OcrTrendPoint;
                    index?: number;
                  }) => {
                    if (typeof dotProps.cx !== 'number' || typeof dotProps.cy !== 'number') {
                      return <g key={`empty-${dotProps.index ?? 0}`} />;
                    }
                    const color = dotProps.payload
                      ? getEngineDotColor(dotProps.payload.engine)
                      : '#005dac';
                    return (
                      <circle
                        key={`dot-${dotProps.payload?.id ?? dotProps.index ?? 0}`}
                        cx={dotProps.cx}
                        cy={dotProps.cy}
                        r={4.5}
                        fill={color}
                        stroke="#ffffff"
                        strokeWidth={1.5}
                      />
                    );
                  }}
                  activeDot={{ r: 6, stroke: '#0b1c30', strokeWidth: 1.5 }}
                />
                <Line
                  type="monotone"
                  dataKey="rollingAvg"
                  name="Rolling Avg (%)"
                  stroke="#196b22"
                  strokeWidth={2}
                  strokeDasharray="5 4"
                  dot={false}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Processed Answer Sheets Audit Table */}
      <div className="bg-white border border-[#e2e8f0] rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-[#e2e8f0] flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs font-semibold text-[#0b1c30]">
            Processed Answer Sheets Log ({filteredRows.length})
          </div>
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-[#64748b] absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="search"
              aria-label="Search processed sheets audit log"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search sheet, student, or model..."
              className="pl-8 pr-3 py-1.5 text-xs border border-[#c1c6d4] rounded w-60 focus:outline-none focus:border-[#005dac]"
            />
          </div>
        </div>

        {visibleTableRows.length === 0 ? (
          <div className="p-6 text-center text-xs text-[#64748b]">
            {unifiedRows.length === 0
              ? 'No answer sheets processed yet.'
              : 'No processed sheets match your active engine filter or search query.'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-[#e2e8f0] text-[#64748b] uppercase text-[11px]">
                <tr>
                  <th className="py-2.5 px-3">Processed At</th>
                  <th className="py-2.5 px-3">Answer Sheet</th>
                  <th className="py-2.5 px-3">Subject / Paper</th>
                  <th className="py-2.5 px-3">Engine & Model</th>
                  <th className="py-2.5 px-3">Confidence</th>
                  <th className="py-2.5 px-3 text-right">Qs</th>
                  <th className="py-2.5 px-3">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#e2e8f0]">
                {visibleTableRows.map((row) => (
                  <tr key={row.id} className="hover:bg-[#f8f9ff]">
                    <td className="py-2.5 px-3 font-mono text-[11px] text-[#64748b] whitespace-nowrap">
                      {new Date(row.timestamp).toLocaleString([], {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                      })}
                    </td>
                    <td className="py-2.5 px-3">
                      <div className="font-mono font-medium text-[#0b1c30] truncate max-w-[165px]" title={row.fileName}>
                        {row.fileName}
                      </div>
                      {row.studentLabel && (
                        <div className="text-[11px] text-[#64748b] truncate max-w-[165px]">
                          {row.studentLabel}
                        </div>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-[#414752]">
                      <div className="truncate max-w-[150px]" title={row.subjectLabel || row.paperId || 'Ad-hoc OCR test'}>
                        {row.subjectLabel || row.paperId || 'Ad-hoc OCR test'}
                      </div>
                    </td>
                    <td className="py-2.5 px-3">
                      <div className="space-y-1">
                        <EngineBadge engine={row.engine} label={row.engineLabel} />
                        <div className="font-mono text-[11px] text-[#64748b] truncate max-w-[165px]">
                          {row.model}
                        </div>
                      </div>
                    </td>
                    <td className="py-2.5 px-3">
                      <div className="flex items-center gap-2 whitespace-nowrap">
                        <div className="w-14 h-1.5 bg-slate-100 rounded overflow-hidden shrink-0">
                          <div
                            className={`h-full ${
                              row.confidence === 'high'
                                ? 'bg-[#196b22]'
                                : row.confidence === 'medium'
                                ? 'bg-[#d97706]'
                                : 'bg-[#ba1a1a]'
                            }`}
                            style={{ width: `${Math.min(100, Math.max(0, row.confidenceScore))}%` }}
                          />
                        </div>
                        <ConfidenceBadge level={row.confidence} score={row.confidenceScore} />
                      </div>
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono tabular-nums text-[#0b1c30]">
                      {row.questionCount}
                    </td>
                    <td className="py-2.5 px-3 text-[11px] text-[#64748b] max-w-[180px] truncate" title={row.fallbackReason || (row.evaluatedWithRubric ? 'OCR + Rubric graded' : 'Verbatim OCR only')}>
                      {row.fallbackReason
                        ? row.fallbackReason
                        : row.evaluatedWithRubric
                        ? 'OCR + Rubric graded'
                        : 'Verbatim OCR only'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {embedded && filteredRows.length > 12 && (
          <div className="px-4 py-2.5 bg-[#f8f9ff] border-t border-[#e2e8f0] flex items-center justify-between text-xs">
            <span className="text-[#64748b]">
              Showing latest 12 of {filteredRows.length} processed sheets.
            </span>
            <button
              type="button"
              onClick={() => setActiveView('admin_audit')}
              className="font-semibold text-[#005dac] hover:underline"
            >
              View all {filteredRows.length} entries →
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
