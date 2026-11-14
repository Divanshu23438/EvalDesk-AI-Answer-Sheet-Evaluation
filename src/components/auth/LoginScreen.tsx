import { useState } from 'react';
import { AlertCircle, Building2, KeyRound, Lock, ShieldCheck } from 'lucide-react';
import { STRINGS } from '../../i18n/strings';
import { useEval } from '../../store/EvalContext';

export function LoginScreen() {
  const { state, initializeInstitution, login, sessionLockedMsg } = useEval();

  // First-time Institution Setup state (shown when no users/admin exist yet)
  const needsSetup = state.users.length === 0;
  const [institutionName, setInstitutionName] = useState('');
  const [academicYear, setAcademicYear] = useState('2026–27');
  const [adminName, setAdminName] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [setupPassword, setSetupPassword] = useState('');
  const [setupConfirm, setSetupConfirm] = useState('');
  const [includeStarterCatalog, setIncludeStarterCatalog] = useState(false);

  // Clean Sign-In state (never pre-filled with demo credentials)
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSetupSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!institutionName.trim()) {
      setError('Enter your institution or college name.');
      return;
    }
    if (!adminName.trim() || !adminEmail.includes('@')) {
      setError('Enter the Examination Controller name and a valid official email.');
      return;
    }
    if (setupPassword.length < 6) {
      setError('Administrator password must be at least 6 characters.');
      return;
    }
    if (setupPassword !== setupConfirm) {
      setError('Passwords do not match.');
      return;
    }
    setError('');
    initializeInstitution({
      institutionName,
      academicYear,
      adminName,
      adminEmail,
      password: setupPassword,
      includeStarterCatalog,
    });
  };

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifier.trim() || !password) {
      setError('Enter both email/roll number and password.');
      return;
    }
    const res = login(identifier, password);
    if (!res.ok) {
      setError(res.error || 'Sign-in failed.');
    }
  };

  return (
    <div className="min-h-screen bg-[#f8f9ff] flex items-center justify-center p-4">
      <div className="w-full max-w-4xl grid grid-cols-1 md:grid-cols-12 bg-white border border-[#e2e8f0] rounded-lg shadow-sm overflow-hidden">
        {/* Left institutional context column */}
        <div className="md:col-span-5 bg-[#eff4ff] border-b md:border-b-0 md:border-r border-[#e2e8f0] p-6 sm:p-8 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 text-[#005dac] font-semibold text-sm">
              <ShieldCheck className="w-5 h-5" />
              <span>{STRINGS.appName}</span>
            </div>
            <h1 className="mt-4 text-2xl font-semibold text-[#0b1c30] leading-tight">
              AI Answer Sheet Evaluation System
            </h1>
            <p className="mt-3 text-sm text-[#414752] leading-relaxed">
              Local-first handwritten evaluation workspace. OCR extracts student lines, rubric checks suggest explainable marks, and teachers retain final authority.
            </p>

            {!needsSetup && state.settings.institutionName && (
              <div className="mt-5 p-3 rounded bg-white border border-[#c1c6d4] space-y-0.5">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-[#0b1c30]">
                  <Building2 className="w-3.5 h-3.5 text-[#005dac] shrink-0" />
                  <span className="truncate">{state.settings.institutionName}</span>
                </div>
                <div className="text-[11px] text-[#64748b]">
                  Academic Year {state.settings.academicYear}
                </div>
              </div>
            )}
          </div>

          <div className="mt-6 pt-5 border-t border-[#c1c6d4] space-y-2 text-xs text-[#414752]">
            <div className="font-semibold text-[#0b1c30]">Institutional Access Rules</div>
            <p>Accounts are provisioned by the Examination Cell (no public sign-up).</p>
            <p>Teachers and students update their temporary password on first login.</p>
          </div>
        </div>

        {/* Right setup or sign-in column */}
        <div className="md:col-span-7 p-6 sm:p-8 flex flex-col justify-center">
          {needsSetup ? (
            <>
              <h2 className="text-lg font-semibold text-[#0b1c30]">{STRINGS.auth.setupTitle}</h2>
              <p className="text-xs text-[#64748b] mt-1">{STRINGS.auth.setupSubtitle}</p>

              {error && (
                <div className="mt-4 p-3 rounded border border-[#ba1a1a] bg-[#ffdad6] text-xs text-[#93000a] flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <form onSubmit={handleSetupSubmit} className="mt-5 space-y-3.5">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-2">
                    <label htmlFor="setup-institution" className="block text-xs font-semibold text-[#0b1c30] mb-1">
                      Institution Name *
                    </label>
                    <input
                      id="setup-institution"
                      type="text"
                      value={institutionName}
                      onChange={(e) => {
                        setInstitutionName(e.target.value);
                        setError('');
                      }}
                      placeholder="e.g., St. Xavier's College of Science"
                      className="w-full rounded border border-[#c1c6d4] px-3 py-2 text-sm text-[#0b1c30] focus:outline-none focus:border-[#005dac]"
                    />
                  </div>
                  <div>
                    <label htmlFor="setup-year" className="block text-xs font-semibold text-[#0b1c30] mb-1">
                      Academic Year
                    </label>
                    <input
                      id="setup-year"
                      type="text"
                      value={academicYear}
                      onChange={(e) => setAcademicYear(e.target.value)}
                      className="w-full rounded border border-[#c1c6d4] px-3 py-2 text-sm font-mono text-[#0b1c30] focus:outline-none focus:border-[#005dac]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="setup-admin-name" className="block text-xs font-semibold text-[#0b1c30] mb-1">
                      Controller / Admin Name *
                    </label>
                    <input
                      id="setup-admin-name"
                      type="text"
                      value={adminName}
                      onChange={(e) => {
                        setAdminName(e.target.value);
                        setError('');
                      }}
                      placeholder="Dr. Arvind Mehta"
                      className="w-full rounded border border-[#c1c6d4] px-3 py-2 text-sm text-[#0b1c30] focus:outline-none focus:border-[#005dac]"
                    />
                  </div>
                  <div>
                    <label htmlFor="setup-admin-email" className="block text-xs font-semibold text-[#0b1c30] mb-1">
                      Official Admin Email *
                    </label>
                    <input
                      id="setup-admin-email"
                      type="email"
                      value={adminEmail}
                      onChange={(e) => {
                        setAdminEmail(e.target.value);
                        setError('');
                      }}
                      placeholder="controller@institution.edu"
                      className="w-full rounded border border-[#c1c6d4] px-3 py-2 text-sm text-[#0b1c30] focus:outline-none focus:border-[#005dac]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="setup-password" className="block text-xs font-semibold text-[#0b1c30] mb-1">
                      Admin Password *
                    </label>
                    <input
                      id="setup-password"
                      type="password"
                      value={setupPassword}
                      onChange={(e) => {
                        setSetupPassword(e.target.value);
                        setError('');
                      }}
                      placeholder="Min. 6 characters"
                      className="w-full rounded border border-[#c1c6d4] px-3 py-2 text-sm text-[#0b1c30] focus:outline-none focus:border-[#005dac]"
                    />
                  </div>
                  <div>
                    <label htmlFor="setup-confirm" className="block text-xs font-semibold text-[#0b1c30] mb-1">
                      Confirm Password *
                    </label>
                    <input
                      id="setup-confirm"
                      type="password"
                      value={setupConfirm}
                      onChange={(e) => {
                        setSetupConfirm(e.target.value);
                        setError('');
                      }}
                      placeholder="Re-enter password"
                      className="w-full rounded border border-[#c1c6d4] px-3 py-2 text-sm text-[#0b1c30] focus:outline-none focus:border-[#005dac]"
                    />
                  </div>
                </div>

                <label className="flex items-start gap-2 pt-1 text-xs text-[#414752]">
                  <input
                    type="checkbox"
                    checked={includeStarterCatalog}
                    onChange={(e) => setIncludeStarterCatalog(e.target.checked)}
                    className="mt-0.5"
                  />
                  <span>
                    Pre-configure starter academic catalog (Physics &amp; Maths subjects, Year 1 class, and sample rubric templates — no user accounts)
                  </span>
                </label>

                <button
                  type="submit"
                  className="w-full py-2.5 px-4 rounded bg-[#005dac] hover:bg-[#004786] text-white text-xs font-semibold transition-colors"
                >
                  Create Administrator &amp; Launch Workspace
                </button>
              </form>
            </>
          ) : (
            <>
              <h2 className="text-lg font-semibold text-[#0b1c30]">{STRINGS.auth.signInTitle}</h2>
              <p className="text-xs text-[#64748b] mt-1">{STRINGS.auth.signInSubtitle}</p>

              {sessionLockedMsg && (
                <div className="mt-4 p-3 rounded border border-[#ffb865] bg-[#fff8e1] text-xs text-[#875200] flex items-center gap-2">
                  <Lock className="w-4 h-4 shrink-0" />
                  <span>{sessionLockedMsg}</span>
                </div>
              )}

              {error && (
                <div className="mt-4 p-3 rounded border border-[#ba1a1a] bg-[#ffdad6] text-xs text-[#93000a] flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <form onSubmit={handleLoginSubmit} className="mt-5 space-y-4">
                <div>
                  <label htmlFor="login-identifier" className="block text-xs font-semibold text-[#0b1c30] mb-1">
                    {STRINGS.auth.identifierLabel}
                  </label>
                  <input
                    id="login-identifier"
                    type="text"
                    autoComplete="username"
                    value={identifier}
                    onChange={(e) => {
                      setIdentifier(e.target.value);
                      setError('');
                    }}
                    placeholder={STRINGS.auth.identifierPlaceholder}
                    className="w-full rounded border border-[#c1c6d4] px-3 py-2 text-sm text-[#0b1c30] focus:outline-none focus:border-[#005dac] focus:ring-1 focus:ring-[#005dac]"
                  />
                </div>

                <div>
                  <label htmlFor="login-password" className="block text-xs font-semibold text-[#0b1c30] mb-1">
                    {STRINGS.auth.passwordLabel}
                  </label>
                  <input
                    id="login-password"
                    type="password"
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      setError('');
                    }}
                    placeholder="Enter your password"
                    className="w-full rounded border border-[#c1c6d4] px-3 py-2 text-sm text-[#0b1c30] focus:outline-none focus:border-[#005dac] focus:ring-1 focus:ring-[#005dac]"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-2.5 px-4 rounded bg-[#005dac] hover:bg-[#004786] text-white text-xs font-semibold transition-colors"
                >
                  {STRINGS.auth.signInButton}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export function ForcedPasswordModal() {
  const { currentUser, completeForcedPasswordChange, logout } = useEval();
  const [newPwd, setNewPwd] = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');
  const [error, setError] = useState('');

  if (!currentUser || !currentUser.mustChangePassword) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newPwd.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (newPwd !== confirmPwd) {
      setError('Passwords do not match.');
      return;
    }
    completeForcedPasswordChange(newPwd);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="forced-pwd-title"
    >
      <div className="w-full max-w-md bg-white border border-[#e2e8f0] rounded-lg shadow-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-[#e2e8f0] flex items-center gap-2.5">
          <KeyRound className="w-5 h-5 text-[#005dac]" />
          <h2 id="forced-pwd-title" className="text-base font-semibold text-[#0b1c30]">
            {STRINGS.auth.forcedPasswordTitle}
          </h2>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <p className="text-xs text-[#414752] leading-relaxed">
            Welcome, <strong className="text-[#0b1c30]">{currentUser.name}</strong>.{' '}
            {STRINGS.auth.forcedPasswordBody}
          </p>

          {error && (
            <div className="p-2.5 rounded border border-[#ba1a1a] bg-[#ffdad6] text-xs text-[#93000a]">
              {error}
            </div>
          )}

          <div>
            <label htmlFor="forced-new-pwd" className="block text-xs font-semibold text-[#0b1c30] mb-1">
              {STRINGS.auth.newPasswordLabel}
            </label>
            <input
              id="forced-new-pwd"
              type="password"
              value={newPwd}
              onChange={(e) => {
                setNewPwd(e.target.value);
                setError('');
              }}
              className="w-full rounded border border-[#c1c6d4] px-3 py-2 text-sm focus:outline-none focus:border-[#005dac]"
            />
          </div>

          <div>
            <label htmlFor="forced-confirm-pwd" className="block text-xs font-semibold text-[#0b1c30] mb-1">
              {STRINGS.auth.confirmPasswordLabel}
            </label>
            <input
              id="forced-confirm-pwd"
              type="password"
              value={confirmPwd}
              onChange={(e) => {
                setConfirmPwd(e.target.value);
                setError('');
              }}
              className="w-full rounded border border-[#c1c6d4] px-3 py-2 text-sm focus:outline-none focus:border-[#005dac]"
            />
          </div>

          <div className="flex items-center justify-between pt-2">
            <button
              type="button"
              onClick={logout}
              className="text-xs font-medium text-[#64748b] hover:text-[#0b1c30]"
            >
              Sign out
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded bg-[#005dac] hover:bg-[#004786] text-white text-xs font-semibold"
            >
              {STRINGS.auth.updatePasswordButton}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
