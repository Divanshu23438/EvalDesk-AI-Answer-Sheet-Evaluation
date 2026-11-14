import { useMemo, useState } from 'react';
import {
  Check,
  Copy,
  Download,
  KeyRound,
  Plus,
  RefreshCw,
  Search,
  Shield,
  Upload,
  UserCheck,
  UserX,
  X,
} from 'lucide-react';
import { useEval } from '../../store/EvalContext';
import type { User } from '../../types/eval';
import {
  generateCsvDownload,
  generateTemporaryPassword,
  parseUsersCsv,
} from '../../utils/gradingEngine';

export function AdminUsers() {
  const {
    state,
    currentUser,
    addUser,
    updateUser,
    toggleUserStatus,
    resetUserPassword,
    importUsersFromCsv,
  } = useEval();

  const [tab, setTab] = useState<'teacher' | 'student' | 'admin'>('teacher');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [classFilter, setClassFilter] = useState('all');
  const [page, setPage] = useState(1);
  const pageSize = 8;

  // Add/Edit Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [formName, setFormName] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formRoll, setFormRoll] = useState('');
  const [formClassId, setFormClassId] = useState('');
  const [formSection, setFormSection] = useState('A');
  const [formSubjects, setFormSubjects] = useState<string[]>([]);
  const [formTempPwd, setFormTempPwd] = useState(() => generateTemporaryPassword());
  const [formError, setFormError] = useState('');

  // Issued credential notice (copyable)
  const [credentialBanner, setCredentialBanner] = useState<{
    name: string;
    identifier: string;
    tempPwd: string;
    kind: 'created' | 'reset';
  } | null>(null);
  const [copiedCred, setCopiedCred] = useState(false);

  // CSV Import Modal
  const [csvOpen, setCsvOpen] = useState(false);
  const [csvDefaultPwd, setCsvDefaultPwd] = useState(() => generateTemporaryPassword());
  const [csvText, setCsvText] = useState('');
  const [csvMessage, setCsvMessage] = useState('');
  const [bannerMsg, setBannerMsg] = useState('');

  const defaultClassId = state.classes[0]?.id || '';
  const defaultSubjectIds = state.subjects[0]?.id ? [state.subjects[0].id] : [];

  const buildSampleCsv = () => {
    const cls = state.classes[0]?.id || 'CLASS_ID';
    const subj = state.subjects[0]?.id || 'SUBJECT_ID';
    return [
      'name,email,role,rollOrSubjects,classId,section',
      `Riya Patel,riya.patel@institution.edu,student,2026CS106,${cls},A`,
      `Prof. Sunita Rao,sunita@institution.edu,teacher,${subj},${cls},`,
    ].join('\n');
  };

  const filtered = useMemo(() => {
    return state.users.filter((u) => {
      if (u.role !== tab) return false;
      if (statusFilter !== 'all' && u.status !== statusFilter) return false;
      if (tab !== 'admin' && classFilter !== 'all' && u.classId !== classFilter) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        const match =
          u.name.toLowerCase().includes(q) ||
          u.email.toLowerCase().includes(q) ||
          (u.rollNumber && u.rollNumber.toLowerCase().includes(q));
        if (!match) return false;
      }
      return true;
    });
  }, [state.users, tab, statusFilter, classFilter, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paged = filtered.slice((page - 1) * pageSize, page * pageSize);

  const openAdd = () => {
    setEditingUser(null);
    setFormName('');
    setFormEmail('');
    setFormRoll('');
    setFormClassId(defaultClassId);
    setFormSection('A');
    setFormSubjects(defaultSubjectIds);
    setFormTempPwd(generateTemporaryPassword());
    setFormError('');
    setModalOpen(true);
  };

  const openEdit = (u: User) => {
    setEditingUser(u);
    setFormName(u.name);
    setFormEmail(u.email);
    setFormRoll(u.rollNumber || '');
    setFormClassId(u.classId || defaultClassId);
    setFormSection(u.section || 'A');
    setFormSubjects(u.subjects || []);
    setFormError('');
    setModalOpen(true);
  };

  const handleSaveUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || !formEmail.includes('@')) {
      setFormError('Valid name and email are required.');
      return;
    }
    if (tab === 'student' && !formRoll.trim()) {
      setFormError('Roll number is required for students.');
      return;
    }

    const emailNormalized = formEmail.trim().toLowerCase();
    const duplicateEmail = state.users.find(
      (u) => u.id !== editingUser?.id && u.email.toLowerCase() === emailNormalized
    );
    if (duplicateEmail) {
      setFormError(`An account with email "${formEmail.trim()}" already exists.`);
      return;
    }

    if (tab === 'student') {
      const rollNormalized = formRoll.trim().toLowerCase();
      const duplicateRoll = state.users.find(
        (u) =>
          u.id !== editingUser?.id &&
          u.rollNumber &&
          u.rollNumber.toLowerCase() === rollNormalized
      );
      if (duplicateRoll) {
        setFormError(`Roll number "${formRoll.trim()}" is already assigned to another student.`);
        return;
      }
    }

    if (!editingUser && formTempPwd.trim().length < 6) {
      setFormError('Temporary password must be at least 6 characters.');
      return;
    }

    const resolvedClassId = state.classes.some((c) => c.id === formClassId)
      ? formClassId
      : defaultClassId;

    if (editingUser) {
      updateUser(editingUser.id, {
        name: formName.trim(),
        email: formEmail.trim(),
        rollNumber: tab === 'student' ? formRoll.trim() : undefined,
        classId: tab === 'admin' ? undefined : resolvedClassId || undefined,
        section: tab === 'student' ? formSection : undefined,
        subjects: tab === 'teacher' ? formSubjects : undefined,
      });
      setBannerMsg(`Updated ${formName.trim()}.`);
    } else {
      const issuedPwd = formTempPwd.trim();
      addUser({
        name: formName.trim(),
        email: formEmail.trim(),
        passwordHash: issuedPwd,
        role: tab,
        status: 'active',
        mustChangePassword: true,
        rollNumber: tab === 'student' ? formRoll.trim() : undefined,
        classId: tab === 'admin' ? undefined : resolvedClassId || undefined,
        section: tab === 'student' ? formSection : undefined,
        subjects: tab === 'teacher' ? formSubjects : undefined,
      });
      setCredentialBanner({
        name: formName.trim(),
        identifier: tab === 'student' ? `${formRoll.trim()} / ${formEmail.trim()}` : formEmail.trim(),
        tempPwd: issuedPwd,
        kind: 'created',
      });
      setCopiedCred(false);
    }
    setModalOpen(false);
  };

  const csvPreview = useMemo(
    () => parseUsersCsv(csvText, csvDefaultPwd, defaultClassId),
    [csvText, csvDefaultPwd, defaultClassId]
  );

  const handleImportCsv = () => {
    const count = importUsersFromCsv(csvPreview.rows);
    setCsvMessage(
      `Imported ${count} user(s) with temporary password "${csvDefaultPwd}". ${csvPreview.errorCount} row(s) skipped.`
    );
    if (count > 0) {
      setBannerMsg(
        `Imported ${count} user(s) from CSV (temporary password: ${csvDefaultPwd}; users must change on first login).`
      );
    }
  };

  const handleCopyCredentials = async () => {
    if (!credentialBanner) return;
    const text = `EvalDesk Login\nUser: ${credentialBanner.name}\nID / Email: ${credentialBanner.identifier}\nTemporary Password: ${credentialBanner.tempPwd}\n(You will be prompted to set a new password on first login.)`;
    try {
      await navigator.clipboard.writeText(text);
      setCopiedCred(true);
      window.setTimeout(() => setCopiedCred(false), 2000);
    } catch {
      // clipboard unavailable
    }
  };

  const roleSingular = tab === 'teacher' ? 'Teacher' : tab === 'student' ? 'Student' : 'Admin';

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto w-full space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-[#0b1c30]">Users Directory</h1>
          <p className="text-xs text-[#64748b] mt-0.5">
            Provision teachers, students, and examination admins with one-time temporary passwords or CSV import.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => {
              setCsvMessage('');
              setCsvDefaultPwd(generateTemporaryPassword());
              if (!csvText.trim()) setCsvText(buildSampleCsv());
              setCsvOpen(true);
            }}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded border border-[#c1c6d4] bg-white hover:bg-slate-50 text-xs font-semibold text-[#0b1c30] whitespace-nowrap"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Import CSV</span>
          </button>
          <button
            type="button"
            onClick={() =>
              generateCsvDownload(
                `evaldesk-${tab}s.csv`,
                ['Name', 'Email', 'Role', 'RollNumber', 'Status'],
                filtered.map((u) => [u.name, u.email, u.role, u.rollNumber || '', u.status])
              )
            }
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded border border-[#c1c6d4] bg-white hover:bg-slate-50 text-xs font-semibold text-[#0b1c30] whitespace-nowrap"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>
          <button
            type="button"
            onClick={openAdd}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded bg-[#005dac] hover:bg-[#004786] text-white text-xs font-semibold whitespace-nowrap"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add {roleSingular}</span>
          </button>
        </div>
      </div>

      {credentialBanner && (
        <div className="p-3.5 rounded-lg border border-[#88d982] bg-[#e8f5e9] text-xs text-[#0b1c30] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-0.5">
            <div className="font-semibold text-[#196b22]">
              {credentialBanner.kind === 'created' ? 'Account Provisioned' : 'Temporary Password Reset'} —{' '}
              {credentialBanner.name}
            </div>
            <div className="text-[#414752]">
              Login ID: <span className="font-mono font-semibold text-[#0b1c30]">{credentialBanner.identifier}</span>
              <span className="mx-2">·</span>
              Temp Password:{' '}
              <span className="font-mono font-semibold bg-white px-2 py-0.5 rounded border border-[#88d982] text-[#0b1c30]">
                {credentialBanner.tempPwd}
              </span>
              <span className="ml-2 text-[#64748b]">(forced change on first sign-in)</span>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleCopyCredentials}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded border border-[#88d982] bg-white text-[#196b22] font-semibold hover:bg-slate-50"
            >
              {copiedCred ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedCred ? 'Copied' : 'Copy Credentials'}</span>
            </button>
            <button
              type="button"
              onClick={() => setCredentialBanner(null)}
              aria-label="Dismiss credentials banner"
              className="p-1 text-[#414752]"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {bannerMsg && (
        <div className="p-3 rounded border border-[#88d982] bg-[#e8f5e9] text-xs text-[#196b22] flex items-center justify-between">
          <span>{bannerMsg}</span>
          <button type="button" onClick={() => setBannerMsg('')} aria-label="Dismiss message">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Tabs + Filters */}
      <div className="bg-white border border-[#e2e8f0] rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-[#e2e8f0] flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="inline-flex p-1 bg-slate-100 rounded-md self-start">
            <button
              type="button"
              onClick={() => {
                setTab('teacher');
                setPage(1);
              }}
              className={`px-3.5 py-1.5 rounded text-xs font-semibold transition-colors ${
                tab === 'teacher' ? 'bg-white text-[#005dac] shadow-xs' : 'text-[#414752] hover:text-[#0b1c30]'
              }`}
            >
              Teachers ({state.users.filter((u) => u.role === 'teacher').length})
            </button>
            <button
              type="button"
              onClick={() => {
                setTab('student');
                setPage(1);
              }}
              className={`px-3.5 py-1.5 rounded text-xs font-semibold transition-colors ${
                tab === 'student' ? 'bg-white text-[#005dac] shadow-xs' : 'text-[#414752] hover:text-[#0b1c30]'
              }`}
            >
              Students ({state.users.filter((u) => u.role === 'student').length})
            </button>
            <button
              type="button"
              onClick={() => {
                setTab('admin');
                setPage(1);
              }}
              className={`px-3.5 py-1.5 rounded text-xs font-semibold transition-colors inline-flex items-center gap-1 ${
                tab === 'admin' ? 'bg-white text-[#005dac] shadow-xs' : 'text-[#414752] hover:text-[#0b1c30]'
              }`}
            >
              <Shield className="w-3 h-3" />
              <span>Admins ({state.users.filter((u) => u.role === 'admin').length})</span>
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-[#64748b] absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="search"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                placeholder="Search name, email, roll..."
                className="pl-8 pr-3 py-1.5 text-xs border border-[#c1c6d4] rounded focus:outline-none focus:border-[#005dac]"
              />
            </div>

            {tab !== 'admin' && (
              <select
                value={classFilter}
                onChange={(e) => {
                  setClassFilter(e.target.value);
                  setPage(1);
                }}
                aria-label="Filter by class"
                className="px-2.5 py-1.5 text-xs border border-[#c1c6d4] rounded bg-white"
              >
                <option value="all">All Classes</option>
                {state.classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            )}

            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value as 'all' | 'active' | 'inactive');
                setPage(1);
              }}
              aria-label="Filter by status"
              className="px-2.5 py-1.5 text-xs border border-[#c1c6d4] rounded bg-white"
            >
              <option value="all">All Statuses</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-[#e2e8f0] text-[11px] font-semibold text-[#64748b] uppercase tracking-wider">
                <th className="py-2.5 px-4">Name</th>
                <th className="py-2.5 px-4">
                  {tab === 'student' ? 'Roll Number' : tab === 'teacher' ? 'Subjects' : 'Access'}
                </th>
                <th className="py-2.5 px-4">{tab === 'admin' ? 'Password State' : 'Class / Section'}</th>
                <th className="py-2.5 px-4">Status</th>
                <th className="py-2.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e2e8f0] text-xs">
              {paged.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-10 text-center text-[#64748b]">
                    {state.users.filter((u) => u.role === tab).length === 0
                      ? `No ${tab}s added yet. Click "Add ${roleSingular}" or "Import CSV" to create accounts.`
                      : `No ${tab}s match the active filters.`}
                  </td>
                </tr>
              ) : (
                paged.map((u) => {
                  const cls = state.classes.find((c) => c.id === u.classId);
                  const subjLabels = (u.subjects || [])
                    .map((sid) => state.subjects.find((s) => s.id === sid)?.code || sid)
                    .join(', ');
                  const isSelf = currentUser?.id === u.id;
                  return (
                    <tr key={u.id} className="hover:bg-[#f8f9ff]">
                      <td className="py-2.5 px-4">
                        <div className="font-semibold text-[#0b1c30]">
                          {u.name} {isSelf && <span className="text-[10px] text-[#005dac] font-normal">(You)</span>}
                        </div>
                        <div className="text-[11px] text-[#64748b]">{u.email}</div>
                      </td>
                      <td className="py-2.5 px-4 font-mono text-[#0b1c30]">
                        {tab === 'student' ? (
                          <span>
                            {u.rollNumber}{' '}
                            <span className="text-[11px] text-[#64748b]">({u.rollCode})</span>
                          </span>
                        ) : tab === 'teacher' ? (
                          <span>{subjLabels || '—'}</span>
                        ) : (
                          <span>Examination Cell</span>
                        )}
                      </td>
                      <td className="py-2.5 px-4 text-[#414752]">
                        {tab === 'admin' ? (
                          <span>{u.mustChangePassword ? 'Temporary (pending)' : 'Active'}</span>
                        ) : (
                          <span>
                            {cls?.name || '—'} {u.section ? `· Sec ${u.section}` : ''}
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-4">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded border text-[11px] font-medium ${
                            u.status === 'active'
                              ? 'bg-[#e8f5e9] text-[#196b22] border-[#88d982]'
                              : 'bg-slate-100 text-slate-600 border-slate-300'
                          }`}
                        >
                          {u.status === 'active' ? 'Active' : 'Deactivated'}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 text-right space-x-1.5 whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => openEdit(u)}
                          className="px-2 py-1 rounded border border-[#c1c6d4] text-[#0b1c30] hover:bg-slate-50 font-medium"
                        >
                          Edit
                        </button>
                        {!isSelf && (
                          <>
                            <button
                              type="button"
                              onClick={() => {
                                const newTemp = resetUserPassword(u.id);
                                setCredentialBanner({
                                  name: u.name,
                                  identifier: u.rollNumber ? `${u.rollNumber} / ${u.email}` : u.email,
                                  tempPwd: newTemp,
                                  kind: 'reset',
                                });
                                setCopiedCred(false);
                              }}
                              title="Issue a new one-time temporary password"
                              className="inline-flex items-center gap-1 px-2 py-1 rounded border border-[#c1c6d4] text-[#414752] hover:bg-slate-50 font-medium"
                            >
                              <KeyRound className="w-3 h-3" />
                              <span>Reset Pwd</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => toggleUserStatus(u.id)}
                              className="inline-flex items-center gap-1 px-2 py-1 rounded border border-[#c1c6d4] text-[#414752] hover:bg-slate-50 font-medium"
                            >
                              {u.status === 'active' ? (
                                <>
                                  <UserX className="w-3 h-3 text-[#ba1a1a]" />
                                  <span>Deactivate</span>
                                </>
                              ) : (
                                <>
                                  <UserCheck className="w-3 h-3 text-[#196b22]" />
                                  <span>Activate</span>
                                </>
                              )}
                            </button>
                          </>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="px-4 py-2.5 border-t border-[#e2e8f0] flex items-center justify-between text-xs text-[#64748b]">
          <span className="tabular-nums">
            Showing {paged.length} of {filtered.length}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
              className="px-2.5 py-1 rounded border border-[#c1c6d4] disabled:opacity-40 bg-white text-[#0b1c30]"
            >
              Prev
            </button>
            <span className="tabular-nums">
              Page {page} of {totalPages}
            </span>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
              className="px-2.5 py-1 rounded border border-[#c1c6d4] disabled:opacity-40 bg-white text-[#0b1c30]"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {/* Add/Edit User Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-md bg-white border border-[#e2e8f0] rounded-lg shadow-xl overflow-hidden">
            <div className="px-5 py-3.5 border-b border-[#e2e8f0] flex items-center justify-between">
              <h2 className="text-sm font-semibold text-[#0b1c30]">
                {editingUser ? 'Edit User' : `Add New ${roleSingular}`}
              </h2>
              <button type="button" onClick={() => setModalOpen(false)} aria-label="Close">
                <X className="w-4 h-4 text-slate-500" />
              </button>
            </div>
            <form onSubmit={handleSaveUser} className="p-5 space-y-3.5">
              {formError && (
                <div className="p-2.5 rounded bg-[#ffdad6] text-xs text-[#93000a]">{formError}</div>
              )}
              <div>
                <label className="block text-xs font-semibold text-[#0b1c30] mb-1">Full Name *</label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder={tab === 'teacher' ? 'Prof. Kiran Verma' : tab === 'student' ? 'Rohan Das' : 'Examination Officer'}
                  className="w-full rounded border border-[#c1c6d4] px-3 py-1.5 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#0b1c30] mb-1">Email *</label>
                <input
                  type="email"
                  value={formEmail}
                  onChange={(e) => setFormEmail(e.target.value)}
                  placeholder="user@institution.edu"
                  className="w-full rounded border border-[#c1c6d4] px-3 py-1.5 text-sm"
                />
              </div>

              {tab === 'student' && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-[#0b1c30] mb-1">Roll Number *</label>
                    <input
                      type="text"
                      value={formRoll}
                      onChange={(e) => setFormRoll(e.target.value)}
                      placeholder="2026CS201"
                      className="w-full rounded border border-[#c1c6d4] px-3 py-1.5 text-sm font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#0b1c30] mb-1">Section</label>
                    <input
                      type="text"
                      value={formSection}
                      onChange={(e) => setFormSection(e.target.value)}
                      className="w-full rounded border border-[#c1c6d4] px-3 py-1.5 text-sm"
                    />
                  </div>
                </div>
              )}

              {tab === 'teacher' && (
                <div>
                  <label className="block text-xs font-semibold text-[#0b1c30] mb-1">Assigned Subjects</label>
                  {state.subjects.length === 0 ? (
                    <div className="text-[11px] text-[#875200] bg-[#fff8e1] border border-[#ffb865] rounded px-2.5 py-1.5">
                      No subjects created yet. You can still create the teacher and map subjects later.
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {state.subjects.map((s) => {
                        const checked = formSubjects.includes(s.id);
                        return (
                          <label key={s.id} className="inline-flex items-center gap-1.5 text-xs text-[#414752]">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={(e) =>
                                setFormSubjects((prev) =>
                                  e.target.checked ? [...prev, s.id] : prev.filter((id) => id !== s.id)
                                )
                              }
                            />
                            <span>{s.code}</span>
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {tab !== 'admin' && (
                <div>
                  <label className="block text-xs font-semibold text-[#0b1c30] mb-1">Class</label>
                  {state.classes.length === 0 ? (
                    <div className="text-[11px] text-[#875200] bg-[#fff8e1] border border-[#ffb865] rounded px-2.5 py-1.5">
                      No classes created yet under Subjects & Classes.
                    </div>
                  ) : (
                    <select
                      value={state.classes.some((c) => c.id === formClassId) ? formClassId : defaultClassId}
                      onChange={(e) => setFormClassId(e.target.value)}
                      className="w-full rounded border border-[#c1c6d4] px-3 py-1.5 text-sm bg-white"
                    >
                      {state.classes.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              )}

              {!editingUser && (
                <div>
                  <label className="block text-xs font-semibold text-[#0b1c30] mb-1">
                    One-Time Temporary Password *
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={formTempPwd}
                      onChange={(e) => setFormTempPwd(e.target.value)}
                      className="flex-1 rounded border border-[#c1c6d4] px-3 py-1.5 text-sm font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => setFormTempPwd(generateTemporaryPassword())}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded border border-[#c1c6d4] text-xs font-medium text-[#0b1c30] hover:bg-slate-50 whitespace-nowrap"
                    >
                      <RefreshCw className="w-3 h-3" />
                      <span>Regenerate</span>
                    </button>
                  </div>
                  <p className="text-[11px] text-[#64748b] mt-1">
                    User will be required to change this temporary password on first sign-in.
                  </p>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-3.5 py-2 rounded border border-[#c1c6d4] text-xs font-semibold text-[#414752]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded bg-[#005dac] text-white text-xs font-semibold"
                >
                  {editingUser ? 'Save Changes' : 'Create User'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CSV Import Modal */}
      {csvOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-2xl bg-white border border-[#e2e8f0] rounded-lg shadow-xl overflow-hidden">
            <div className="px-5 py-3.5 border-b border-[#e2e8f0] flex items-center justify-between">
              <h2 className="text-sm font-semibold text-[#0b1c30]">Bulk Import Users from CSV</h2>
              <button type="button" onClick={() => setCsvOpen(false)} aria-label="Close">
                <X className="w-4 h-4 text-slate-500" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
                <p className="text-xs text-[#414752]">
                  Format:{' '}
                  <code className="font-mono bg-slate-100 px-1">
                    name,email,role,rollOrSubjects,classId,section[,tempPassword]
                  </code>
                </p>
                <div className="flex items-center gap-2 shrink-0">
                  <label className="text-[11px] font-semibold text-[#0b1c30] whitespace-nowrap">
                    Default Temp Pwd:
                  </label>
                  <input
                    type="text"
                    value={csvDefaultPwd}
                    onChange={(e) => setCsvDefaultPwd(e.target.value)}
                    className="w-28 rounded border border-[#c1c6d4] px-2 py-1 text-xs font-mono"
                  />
                </div>
              </div>
              <textarea
                value={csvText}
                onChange={(e) => setCsvText(e.target.value)}
                rows={5}
                className="w-full rounded border border-[#c1c6d4] p-2.5 text-xs font-mono"
              />

              <div className="border border-[#e2e8f0] rounded max-h-44 overflow-y-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-[#e2e8f0]">
                    <tr>
                      <th className="py-1.5 px-3">Line</th>
                      <th className="py-1.5 px-3">Result</th>
                      <th className="py-1.5 px-3">Details</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#e2e8f0]">
                    {csvPreview.rows.map((r) => (
                      <tr key={r.lineNumber}>
                        <td className="py-1.5 px-3 font-mono">{r.lineNumber}</td>
                        <td className="py-1.5 px-3">
                          {r.valid ? (
                            <span className="text-[#196b22] font-semibold">Valid</span>
                          ) : (
                            <span className="text-[#ba1a1a] font-semibold">Error</span>
                          )}
                        </td>
                        <td className="py-1.5 px-3 text-[#414752]">
                          {r.valid ? `${r.user?.name} (${r.user?.role})` : r.error}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {csvMessage && (
                <div className="p-2.5 rounded bg-[#e8f5e9] text-xs text-[#196b22]">{csvMessage}</div>
              )}

              <div className="flex items-center justify-between pt-1">
                <span className="text-xs text-[#64748b] tabular-nums">
                  {csvPreview.validUsers.length} ready · {csvPreview.errorCount} error(s)
                </span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setCsvOpen(false)}
                    className="px-3.5 py-2 rounded border border-[#c1c6d4] text-xs font-semibold text-[#414752]"
                  >
                    Close
                  </button>
                  <button
                    type="button"
                    disabled={csvPreview.validUsers.length === 0}
                    onClick={handleImportCsv}
                    className="px-4 py-2 rounded bg-[#005dac] disabled:opacity-40 text-white text-xs font-semibold"
                  >
                    Import Valid Rows
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
