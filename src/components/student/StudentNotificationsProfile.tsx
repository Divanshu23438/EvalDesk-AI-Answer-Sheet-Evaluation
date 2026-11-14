import { useState } from 'react';
import { Bell, KeyRound, User as UserIcon } from 'lucide-react';
import { useEval } from '../../store/EvalContext';

export function StudentNotificationsProfile() {
  const { state, currentUser, markNotificationRead, markAllNotificationsRead, changeOwnPassword } = useEval();
  const [curPwd, setCurPwd] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [pwdMsg, setPwdMsg] = useState('');

  if (!currentUser) return null;
  const myNotifs = state.notifications.filter((n) => n.userId === currentUser.id);

  const handlePwd = (e: React.FormEvent) => {
    e.preventDefault();
    const res = changeOwnPassword(curPwd, newPwd);
    if (res.ok) {
      setPwdMsg('Password updated successfully.');
      setCurPwd('');
      setNewPwd('');
    } else {
      setPwdMsg(res.error || 'Could not update password.');
    }
  };

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto w-full space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-[#0b1c30]">Notifications & Profile</h1>
        <p className="text-xs text-[#64748b] mt-0.5">
          View examination updates, verify your contact details, and manage your password.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        {/* Notifications */}
        <div className="md:col-span-7 bg-white border border-[#e2e8f0] rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b border-[#e2e8f0] flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-semibold text-[#0b1c30]">
              <Bell className="w-4 h-4 text-[#005dac]" />
              <span>Notifications ({myNotifs.length})</span>
            </div>
            <button
              type="button"
              onClick={markAllNotificationsRead}
              className="text-xs font-medium text-[#005dac] hover:underline"
            >
              Mark all read
            </button>
          </div>
          {myNotifs.length === 0 ? (
            <div className="p-6 text-xs text-[#64748b] text-center">No notifications yet.</div>
          ) : (
            <div className="divide-y divide-[#e2e8f0]">
              {myNotifs.map((n) => (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => markNotificationRead(n.id)}
                  className={`w-full text-left p-4 text-xs ${n.read ? 'bg-white' : 'bg-[#eff4ff]/60'}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-[#0b1c30]">{n.title}</span>
                    <span className="text-[11px] text-[#64748b]">
                      {new Date(n.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  <p className="text-[#414752] mt-1">{n.message}</p>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Profile & Password */}
        <div className="md:col-span-5 space-y-5">
          <div className="bg-white border border-[#e2e8f0] rounded-lg p-5 space-y-2.5 text-xs">
            <div className="flex items-center gap-2 text-sm font-semibold text-[#0b1c30]">
              <UserIcon className="w-4 h-4 text-[#005dac]" />
              <span>Student Profile</span>
            </div>
            <div className="flex justify-between pt-1">
              <span className="text-[#64748b]">Name</span>
              <span className="font-medium text-[#0b1c30]">{currentUser.name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#64748b]">Roll Number</span>
              <span className="font-mono font-semibold text-[#0b1c30]">{currentUser.rollNumber}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#64748b]">Email</span>
              <span className="text-[#0b1c30]">{currentUser.email}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#64748b]">Phone</span>
              <span className="text-[#0b1c30]">{currentUser.phone || '—'}</span>
            </div>
          </div>

          <form onSubmit={handlePwd} className="bg-white border border-[#e2e8f0] rounded-lg p-5 space-y-3 text-xs">
            <div className="flex items-center gap-2 text-sm font-semibold text-[#0b1c30]">
              <KeyRound className="w-4 h-4 text-[#005dac]" />
              <span>Change Password</span>
            </div>
            <div>
              <label className="block font-semibold text-[#414752] mb-1">Current Password</label>
              <input
                type="password"
                value={curPwd}
                onChange={(e) => setCurPwd(e.target.value)}
                className="w-full rounded border border-[#c1c6d4] px-3 py-1.5"
              />
            </div>
            <div>
              <label className="block font-semibold text-[#414752] mb-1">New Password</label>
              <input
                type="password"
                value={newPwd}
                onChange={(e) => setNewPwd(e.target.value)}
                className="w-full rounded border border-[#c1c6d4] px-3 py-1.5"
              />
            </div>
            {pwdMsg && <div className="text-[#005dac] font-medium">{pwdMsg}</div>}
            <button type="submit" className="px-4 py-2 rounded bg-[#005dac] text-white font-semibold">
              Update Password
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
