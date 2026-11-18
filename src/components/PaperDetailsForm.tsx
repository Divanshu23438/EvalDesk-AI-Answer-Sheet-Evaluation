import React, { useState, useEffect } from 'react';
import { AlertCircle, BookOpen, Layers, Check, Info } from 'lucide-react';
import { StrictnessPicker } from './StrictnessPicker';

export interface PaperMeta {
  title: string;
  subject: string;
  subject_code: string;
  exam_name: string;
  strictness_level: number;
  subject_domain: string;
}

export interface PaperDetailsFormProps {
  meta?: PaperMeta | null;
  hasTeacherKey?: boolean;
  onSave: (patch: Partial<PaperMeta>) => Promise<void> | void;
}

export const SUBJECT_DOMAINS = [
  { id: 'general', label: 'General / Multi-disciplinary' },
  { id: 'cs_it', label: 'Computer Science, IT & Systems' },
  { id: 'math_quant', label: 'Mathematics & Quantitative Engineering' },
  { id: 'science_bio_chem', label: 'Life Sciences, Chemistry & Physics' },
  { id: 'humanities_law', label: 'Humanities, Commerce & Law' },
  { id: 'languages', label: 'Languages & Literature' },
];

export const PaperDetailsForm: React.FC<PaperDetailsFormProps> = ({ meta, hasTeacherKey = false, onSave }) => {
  const [title, setTitle] = useState(meta?.title || '');
  const [subject, setSubject] = useState(meta?.subject || '');
  const [subjectCode, setSubjectCode] = useState(meta?.subject_code || '');
  const [examName, setExamName] = useState(meta?.exam_name || '');
  const [strictnessLevel, setStrictnessLevel] = useState<number>(meta?.strictness_level || 3);
  const [subjectDomain, setSubjectDomain] = useState(meta?.subject_domain || 'general');

  useEffect(() => {
    setTitle(meta?.title || '');
    setSubject(meta?.subject || '');
    setSubjectCode(meta?.subject_code || '');
    setExamName(meta?.exam_name || '');
    setStrictnessLevel(meta?.strictness_level || 3);
    setSubjectDomain(meta?.subject_domain || 'general');
  }, [meta]);

  const handleBlurField = (field: keyof PaperMeta, currentVal: any, originalVal: any) => {
    if (currentVal !== originalVal) {
      onSave({ [field]: currentVal });
    }
  };

  const handleDomainChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    setSubjectDomain(val);
    onSave({ subject_domain: val });
  };

  const handleStrictnessChange = (level: number) => {
    setStrictnessLevel(level);
    onSave({ strictness_level: level });
  };

  const showTeacherKeyTip = strictnessLevel >= 4 && !hasTeacherKey;

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-2 space-y-2">
      {/* Grid of Inputs */}
      <div className="grid grid-cols-2 gap-1.5 text-xs">
        {/* Title */}
        <div className="space-y-0.5">
          <div className="flex items-center justify-between">
            <label className="text-[10px] font-semibold text-slate-700">Title</label>
            {!title.trim() && (
              <span className="text-[8px] px-1 rounded bg-amber-100 text-amber-800 font-medium">
                Not detected
              </span>
            )}
          </div>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={() => handleBlurField('title', title.trim(), meta?.title)}
            placeholder={!title.trim() ? "Not detected — enter manually" : "Assessment Title"}
            className={`w-full px-2 py-1 rounded border text-xs bg-white text-slate-800 focus:outline-none focus:border-indigo-500 transition ${
              !title.trim() ? 'border-amber-400 bg-amber-50/20 placeholder:text-amber-700/70 font-medium' : 'border-slate-300'
            }`}
          />
        </div>

        {/* Subject */}
        <div className="space-y-0.5">
          <div className="flex items-center justify-between">
            <label className="text-[10px] font-semibold text-slate-700">Subject</label>
            {!subject.trim() && (
              <span className="text-[8px] px-1 rounded bg-amber-100 text-amber-800 font-medium">
                Not detected
              </span>
            )}
          </div>
          <input
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            onBlur={() => handleBlurField('subject', subject.trim(), meta?.subject)}
            placeholder={!subject.trim() ? "Not detected — enter manually" : "e.g. Computer Science"}
            className={`w-full px-2 py-1 rounded border text-xs bg-white text-slate-800 focus:outline-none focus:border-indigo-500 transition ${
              !subject.trim() ? 'border-amber-400 bg-amber-50/20 placeholder:text-amber-700/70 font-medium' : 'border-slate-300'
            }`}
          />
        </div>

        {/* Subject Code */}
        <div className="space-y-0.5">
          <div className="flex items-center justify-between">
            <label className="text-[10px] font-semibold text-slate-700">Subject Code</label>
            {!subjectCode.trim() && (
              <span className="text-[8px] px-1 rounded bg-amber-100 text-amber-800 font-medium">
                Not detected
              </span>
            )}
          </div>
          <input
            type="text"
            value={subjectCode}
            onChange={(e) => setSubjectCode(e.target.value)}
            onBlur={() => handleBlurField('subject_code', subjectCode.trim(), meta?.subject_code)}
            placeholder={!subjectCode.trim() ? "Not detected — enter manually" : "e.g. CS-402"}
            className={`w-full px-2 py-1 rounded border text-xs bg-white text-slate-800 focus:outline-none focus:border-indigo-500 uppercase font-mono transition ${
              !subjectCode.trim() ? 'border-amber-400 bg-amber-50/20 placeholder:text-amber-700/70 font-medium' : 'border-slate-300'
            }`}
          />
        </div>

        {/* Exam Name */}
        <div className="space-y-0.5">
          <div className="flex items-center justify-between">
            <label className="text-[10px] font-semibold text-slate-700">Exam / Term</label>
            {!examName.trim() && (
              <span className="text-[8px] px-1 rounded bg-amber-100 text-amber-800 font-medium">
                Not detected
              </span>
            )}
          </div>
          <input
            type="text"
            value={examName}
            onChange={(e) => setExamName(e.target.value)}
            onBlur={() => handleBlurField('exam_name', examName.trim(), meta?.exam_name)}
            placeholder={!examName.trim() ? "Not detected — enter manually" : "e.g. End Semester 2026"}
            className={`w-full px-2 py-1 rounded border text-xs bg-white text-slate-800 focus:outline-none focus:border-indigo-500 transition ${
              !examName.trim() ? 'border-amber-400 bg-amber-50/20 placeholder:text-amber-700/70 font-medium' : 'border-slate-300'
            }`}
          />
        </div>
      </div>

      {/* Domain Selection */}
      <div className="space-y-0.5 text-xs">
        <label className="text-[10px] font-semibold text-slate-700 flex items-center gap-1">
          <Layers className="w-2.5 h-2.5 text-slate-500" />
          <span>Subject Domain Calibration</span>
        </label>
        <select
          value={subjectDomain}
          onChange={handleDomainChange}
          className="w-full px-2 py-1 rounded border border-slate-300 text-xs bg-white text-slate-800 focus:outline-none focus:border-indigo-500"
        >
          {SUBJECT_DOMAINS.map((d) => (
            <option key={d.id} value={d.id}>
              {d.label}
            </option>
          ))}
        </select>
      </div>

      {/* Strictness Picker 1-5 */}
      <div className="space-y-0.5 text-xs pt-1 border-t border-slate-200">
        <label className="text-[10px] font-semibold text-slate-700 flex items-center justify-between">
          <span>Strictness (1 = Lenient, 5 = Strict)</span>
        </label>
        <StrictnessPicker
          value={strictnessLevel}
          onChange={handleStrictnessChange}
        />
      </div>

      {/* Amber Tip for Level 4-5 without Teacher Key */}
      {showTeacherKeyTip && (
        <div className="p-1.5 rounded bg-amber-50 border border-amber-300 text-[10px] text-amber-900 flex items-start gap-1">
          <Info className="w-3 h-3 text-amber-600 shrink-0 mt-0.5" />
          <span>
            Upload a Teacher Key for exact keyword matching at Level {strictnessLevel}.
          </span>
        </div>
      )}
    </div>
  );
};
