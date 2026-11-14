import { useState } from 'react';
import { BookOpen, GraduationCap, Plus } from 'lucide-react';
import { useEval } from '../../store/EvalContext';

export function AdminSubjectsClasses() {
  const { state, addSubject, addClassSection } = useEval();

  const [subjName, setSubjName] = useState('');
  const [subjCode, setSubjCode] = useState('');
  const [subjDept, setSubjDept] = useState('');
  const [subjError, setSubjError] = useState('');

  const [clsName, setClsName] = useState('');
  const [clsSections, setClsSections] = useState('A, B');
  const [clsYear, setClsYear] = useState(state.settings.academicYear || '2026–27');
  const [clsError, setClsError] = useState('');

  const handleAddSubject = (e: React.FormEvent) => {
    e.preventDefault();
    setSubjError('');
    const code = subjCode.trim().toUpperCase();
    const name = subjName.trim();
    if (!code || !name) {
      setSubjError('Subject code and name are required.');
      return;
    }
    if (state.subjects.some((s) => s.code.toUpperCase() === code)) {
      setSubjError(`Subject code "${code}" already exists.`);
      return;
    }
    addSubject({
      name,
      code,
      department: subjDept.trim() || 'General',
    });
    setSubjName('');
    setSubjCode('');
    setSubjDept('');
  };

  const handleAddClass = (e: React.FormEvent) => {
    e.preventDefault();
    setClsError('');
    if (!clsName.trim()) {
      setClsError('Class name is required.');
      return;
    }
    const sections = clsSections
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    addClassSection({
      name: clsName.trim(),
      sections: sections.length > 0 ? sections : ['A'],
      academicYear: clsYear.trim() || '2026–27',
    });
    setClsName('');
  };

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto w-full space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-[#0b1c30]">Subjects & Classes</h1>
        <p className="text-xs text-[#64748b] mt-0.5">
          Academic structure driving paper creation, teacher subject eligibility, and student mapping.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Subjects */}
        <div className="bg-white border border-[#e2e8f0] rounded-lg overflow-hidden flex flex-col">
          <div className="px-4 py-3 border-b border-[#e2e8f0] flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-[#005dac]" />
            <h2 className="text-sm font-semibold text-[#0b1c30]">Subjects ({state.subjects.length})</h2>
          </div>

          <div className="divide-y divide-[#e2e8f0] flex-1">
            {state.subjects.length === 0 ? (
              <div className="px-4 py-6 text-xs text-[#64748b] text-center">
                No subjects created yet. Add your first subject below (e.g. PHYS 101, MATH 201).
              </div>
            ) : (
              state.subjects.map((s) => (
                <div key={s.id} className="px-4 py-3 flex items-center justify-between gap-3 text-xs">
                  <div>
                    <span className="font-mono font-semibold text-[#005dac]">{s.code}</span>
                    <span className="mx-2 text-[#c1c6d4]">·</span>
                    <span className="font-medium text-[#0b1c30]">{s.name}</span>
                  </div>
                  <span className="text-[#64748b]">{s.department}</span>
                </div>
              ))
            )}
          </div>

          <form onSubmit={handleAddSubject} className="p-4 bg-slate-50 border-t border-[#e2e8f0] space-y-2.5">
            <div className="text-xs font-semibold text-[#0b1c30]">Add Subject</div>
            {subjError && (
              <div className="p-2 rounded bg-[#ffdad6] text-[11px] text-[#93000a]">{subjError}</div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <input
                type="text"
                value={subjCode}
                onChange={(e) => setSubjCode(e.target.value)}
                placeholder="Code (e.g. CHEM 101)"
                className="rounded border border-[#c1c6d4] bg-white px-2.5 py-1.5 text-xs font-mono"
              />
              <input
                type="text"
                value={subjName}
                onChange={(e) => setSubjName(e.target.value)}
                placeholder="Subject name"
                className="rounded border border-[#c1c6d4] bg-white px-2.5 py-1.5 text-xs"
              />
              <input
                type="text"
                value={subjDept}
                onChange={(e) => setSubjDept(e.target.value)}
                placeholder="Department"
                className="rounded border border-[#c1c6d4] bg-white px-2.5 py-1.5 text-xs"
              />
            </div>
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-[#005dac] text-white text-xs font-semibold"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Subject</span>
            </button>
          </form>
        </div>

        {/* Classes & Sections */}
        <div className="bg-white border border-[#e2e8f0] rounded-lg overflow-hidden flex flex-col">
          <div className="px-4 py-3 border-b border-[#e2e8f0] flex items-center gap-2">
            <GraduationCap className="w-4 h-4 text-[#005dac]" />
            <h2 className="text-sm font-semibold text-[#0b1c30]">Classes & Sections ({state.classes.length})</h2>
          </div>

          <div className="divide-y divide-[#e2e8f0] flex-1">
            {state.classes.length === 0 ? (
              <div className="px-4 py-6 text-xs text-[#64748b] text-center">
                No classes created yet. Add your first class/batch below (e.g. B.Sc. Computer Science — Year 1).
              </div>
            ) : (
              state.classes.map((c) => (
                <div key={c.id} className="px-4 py-3 flex items-center justify-between gap-3 text-xs">
                  <div>
                    <div className="font-semibold text-[#0b1c30]">{c.name}</div>
                    <div className="text-[#64748b] mt-0.5">Sections: {c.sections.join(', ')}</div>
                  </div>
                  <span className="font-mono text-[#414752]">{c.academicYear}</span>
                </div>
              ))
            )}
          </div>

          <form onSubmit={handleAddClass} className="p-4 bg-slate-50 border-t border-[#e2e8f0] space-y-2.5">
            <div className="text-xs font-semibold text-[#0b1c30]">Add Class</div>
            {clsError && (
              <div className="p-2 rounded bg-[#ffdad6] text-[11px] text-[#93000a]">{clsError}</div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <input
                type="text"
                value={clsName}
                onChange={(e) => setClsName(e.target.value)}
                placeholder="Class name"
                className="rounded border border-[#c1c6d4] bg-white px-2.5 py-1.5 text-xs"
              />
              <input
                type="text"
                value={clsSections}
                onChange={(e) => setClsSections(e.target.value)}
                placeholder="Sections (A, B)"
                className="rounded border border-[#c1c6d4] bg-white px-2.5 py-1.5 text-xs"
              />
              <input
                type="text"
                value={clsYear}
                onChange={(e) => setClsYear(e.target.value)}
                placeholder="Academic year"
                className="rounded border border-[#c1c6d4] bg-white px-2.5 py-1.5 text-xs font-mono"
              />
            </div>
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-[#005dac] text-white text-xs font-semibold"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Class</span>
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
