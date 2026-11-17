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
  meta: PaperMeta;
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
  const [title, setTitle] = useState(meta.title || '');
  const [subject, setSubject] = useState(meta.subject || '');
  const [subjectCode, setSubjectCode] = useState(meta.subject_code || '');
  const [examName, setExamName] = useState(meta.exam_name || '');
  const [strictnessLevel, setStrictnessLevel] = useState<number>(meta.strictness_level || 3);
  const [subjectDomain, setSubjectDomain] = useState(meta.subject_domain || 'general');

  useEffect(() => {
    setTitle(meta.title || '');
    setSubject(meta.subject || '');
    setSubjectCode(meta.subject_code || '');
    setExamName(meta.exam_name || '');
    setStrictnessLevel(meta.strictness_level || 3);
    setSubjectDomain(meta.subject_domain || 'general');
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
    <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-3 space-y-3">
      <div className="flex items-center justify-between gap-2 border-b border-slate-200 pb-2">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-800 uppercase tracking-wider">
          <BookOpen className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
          <span>Paper & Subject Details</span>
        </div>
        <span className="text-[10px] text-slate-500 font-medium">Editable at any time</span>
      </div>

      {/* Grid of Inputs */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
        {/* Title */}
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <label className="text-[11px] font-medium text-slate-700">Assessment Title</label>
            {!title.trim() && (
              <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 font-medium">
                Not detected
              </span>
            )}
          </div>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={() => handleBlurField('title', title.trim(), meta.title)}
            placeholder="e.g. Operating Systems Final Exam"
            className={`w-full px-2 py-1.5 rounded-md border text-xs bg-white text-slate-800 focus:outline-none focus:border-indigo-500 ${
              !title.trim() ? 'border-amber-300' : 'border-slate-300'
            }`}
          />
        </div>

        {/* Exam Name */}
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <label className="text-[11px] font-medium text-slate-700">Exam / Term Name</label>
            {!examName.trim() && (
              <span className="text-[9px] px-1.5 py-0.2 rounded bg-slate-200 text-slate-600 font-medium">
                Optional
              </span>
            )}
          </div>
          <input
            type="text"
            value={examName}
            onChange={(e) => setExamName(e.target.value)}
            onBlur={() => handleBlurField('exam_name', examName.trim(), meta.exam_name)}
            placeholder="e.g. End Semester Exam 2026"
            className="w-full px-2 py-1.5 rounded-md border border-slate-300 text-xs bg-white text-slate-800 focus:outline-none focus:border-indigo-500"
          />
        </div>

        {/* Subject */}
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <label className="text-[11px] font-medium text-slate-700">Subject Name</label>
            {!subject.trim() && (
              <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 font-medium">
                Not detected
              </span>
            )}
          </div>
          <input
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            onBlur={() => handleBlurField('subject', subject.trim(), meta.subject)}
            placeholder="e.g. Linux Architecture & Administration"
            className={`w-full px-2 py-1.5 rounded-md border text-xs bg-white text-slate-800 focus:outline-none focus:border-indigo-500 ${
              !subject.trim() ? 'border-amber-300' : 'border-slate-300'
            }`}
          />
        </div>

        {/* Subject Code */}
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <label className="text-[11px] font-medium text-slate-700">Subject Code</label>
            {!subjectCode.trim() && (
              <span className="text-[9px] px-1.5 py-0.2 rounded bg-slate-200 text-slate-600 font-medium">
                Optional
              </span>
            )}
          </div>
          <input
            type="text"
            value={subjectCode}
            onChange={(e) => setSubjectCode(e.target.value)}
            onBlur={() => handleBlurField('subject_code', subjectCode.trim(), meta.subject_code)}
            placeholder="e.g. CS-402 / IT-301"
            className="w-full px-2 py-1.5 rounded-md border border-slate-300 text-xs bg-white text-slate-800 focus:outline-none focus:border-indigo-500 uppercase font-mono"
          />
        </div>
      </div>

      {/* Domain Selection */}
      <div className="space-y-1 text-xs">
        <label className="text-[11px] font-medium text-slate-700 flex items-center gap-1">
          <Layers className="w-3 h-3 text-slate-500" />
          <span>Subject Domain Calibration</span>
        </label>
        <select
          value={subjectDomain}
          onChange={handleDomainChange}
          className="w-full px-2 py-1.5 rounded-md border border-slate-300 text-xs bg-white text-slate-800 focus:outline-none focus:border-indigo-500"
        >
          {SUBJECT_DOMAINS.map((d) => (
            <option key={d.id} value={d.id}>
              {d.label}
            </option>
          ))}
        </select>
      </div>

      {/* Strictness Picker 1-5 */}
      <div className="space-y-1 text-xs pt-1 border-t border-slate-200">
        <label className="text-[11px] font-medium text-slate-700 flex items-center justify-between">
          <span>Grading Strictness (1 = Lenient, 5 = Strict)</span>
        </label>
        <StrictnessPicker
          value={strictnessLevel}
          onChange={handleStrictnessChange}
        />
      </div>

      {/* Amber Tip for Level 4-5 without Teacher Key */}
      {showTeacherKeyTip && (
        <div className="p-2 rounded-md bg-amber-50 border border-amber-300 text-[11px] text-amber-900 flex items-start gap-1.5">
          <Info className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
          <span>
            <strong>Tip:</strong> Upload a Teacher Answer Key for exact keyword enforcement at Level {strictnessLevel},
            or borderline keyword matches will be flagged for your review.
          </span>
        </div>
      )}
    </div>
  );
};
