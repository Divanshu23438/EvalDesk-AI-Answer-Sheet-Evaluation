import React, { useEffect, useState } from 'react';
import {
  MousePointer,
  PenTool,
  Highlighter,
  Check,
  X as CrossIcon,
  Type,
  Eraser,
  Undo2,
  Redo2,
  Eye,
  EyeOff,
  Trash2,
  Lock,
  Globe,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Menu,
} from 'lucide-react';
import type { SaveStatus } from '../utils/useAnnotations';

export type AnnotationTool =
  | 'select'
  | 'pen'
  | 'highlight'
  | 'tick'
  | 'cross'
  | 'text'
  | 'eraser';

export interface AnnotationToolbarProps {
  activeTool: AnnotationTool;
  onSelectTool: (tool: AnnotationTool) => void;
  activeColor: string;
  onChangeColor: (color: string) => void;
  activeWidth: number;
  onChangeWidth: (width: number) => void;
  visibility: 'student' | 'private';
  onChangeVisibility: (v: 'student' | 'private') => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  isVisible: boolean;
  onToggleVisible: () => void;
  onClearPage: () => void;
  saveStatus?: SaveStatus;
  currentPage?: number;
  className?: string;
}

const COLORS = [
  { value: '#ef4444', label: 'Red (Default)' },
  { value: '#3b82f6', label: 'Blue' },
  { value: '#10b981', label: 'Green' },
  { value: '#1e293b', label: 'Black' },
];

const WIDTHS = [
  { value: 1.5, label: 'Fine' },
  { value: 3.0, label: 'Medium' },
  { value: 6.0, label: 'Thick' },
];

export const AnnotationToolbar: React.FC<AnnotationToolbarProps> = ({
  activeTool,
  onSelectTool,
  activeColor,
  onChangeColor,
  activeWidth,
  onChangeWidth,
  visibility,
  onChangeVisibility,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  isVisible,
  onToggleVisible,
  onClearPage,
  saveStatus = 'idle',
  currentPage = 1,
  className = '',
}) => {
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [isCollapsedMobile, setIsCollapsedMobile] = useState(false);

  // Global Keyboard Shortcuts (V, P, H, T, X, N, E, Ctrl+Z, Ctrl+Y, Esc)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger when inside inputs or textareas
      const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || (e.target as HTMLElement)?.isContentEditable) {
        return;
      }

      // Undo / Redo
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          onRedo();
        } else {
          onUndo();
        }
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        onRedo();
        return;
      }

      // Tool switches
      switch (e.key.toLowerCase()) {
        case 'v':
          e.preventDefault();
          onSelectTool('select');
          break;
        case 'p':
          e.preventDefault();
          onSelectTool('pen');
          break;
        case 'h':
          e.preventDefault();
          onSelectTool('highlight');
          break;
        case 't':
          e.preventDefault();
          onSelectTool('tick');
          break;
        case 'x':
          e.preventDefault();
          onSelectTool('cross');
          break;
        case 'n':
          e.preventDefault();
          onSelectTool('text');
          break;
        case 'e':
          e.preventDefault();
          onSelectTool('eraser');
          break;
        case 'escape':
          e.preventDefault();
          onSelectTool('select');
          setShowClearConfirm(false);
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onSelectTool, onUndo, onRedo, canUndo, canRedo]);

  const handleClearClick = () => {
    if (showClearConfirm) {
      onClearPage();
      setShowClearConfirm(false);
    } else {
      setShowClearConfirm(true);
      // Auto-revert confirm state after 5 seconds
      setTimeout(() => setShowClearConfirm(false), 5000);
    }
  };

  return (
    <div
      data-testid="annotation-toolbar"
      className={`flex flex-col items-center gap-1.5 p-1.5 bg-white/95 backdrop-blur-md rounded-xl shadow-lg border border-slate-200 select-none z-30 transition-all ${className}`}
      style={{ minWidth: '44px' }}
    >
      {/* Mobile Collapse Toggle Button */}
      <button
        type="button"
        data-testid="btn-collapse-toolbar"
        onClick={() => setIsCollapsedMobile((prev) => !prev)}
        className="md:hidden p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-800"
        title="Toggle Toolbar"
      >
        <Menu className="w-4 h-4" />
      </button>

      {/* Main Tool Palette */}
      <div className={`flex flex-col items-center gap-1 w-full ${isCollapsedMobile ? 'hidden md:flex' : 'flex'}`}>
        {/* 1. Select Tool (V) */}
        <button
          type="button"
          data-testid="tool-select"
          onClick={() => onSelectTool('select')}
          className={`p-2 rounded-lg text-xs transition flex items-center justify-center ${
            activeTool === 'select'
              ? 'bg-indigo-600 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
          }`}
          title="Select / Pick (V)"
        >
          <MousePointer className="w-4 h-4" />
        </button>

        {/* 2. Pen Tool (P) */}
        <button
          type="button"
          data-testid="tool-pen"
          onClick={() => onSelectTool('pen')}
          className={`p-2 rounded-lg text-xs transition flex items-center justify-center ${
            activeTool === 'pen'
              ? 'bg-indigo-600 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
          }`}
          title="Pen (P)"
        >
          <PenTool className="w-4 h-4" />
        </button>

        {/* 3. Highlighter Tool (H) */}
        <button
          type="button"
          data-testid="tool-highlight"
          onClick={() => onSelectTool('highlight')}
          className={`p-2 rounded-lg text-xs transition flex items-center justify-center ${
            activeTool === 'highlight'
              ? 'bg-indigo-600 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
          }`}
          title="Highlighter (H)"
        >
          <Highlighter className="w-4 h-4" />
        </button>

        {/* 4. Tick Tool (T) */}
        <button
          type="button"
          data-testid="tool-tick"
          onClick={() => onSelectTool('tick')}
          className={`p-2 rounded-lg text-xs transition flex items-center justify-center ${
            activeTool === 'tick'
              ? 'bg-emerald-600 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100 hover:text-emerald-700'
          }`}
          title="Tick Mark (T)"
        >
          <Check className="w-4 h-4 font-bold stroke-[3]" />
        </button>

        {/* 5. Cross Tool (X) */}
        <button
          type="button"
          data-testid="tool-cross"
          onClick={() => onSelectTool('cross')}
          className={`p-2 rounded-lg text-xs transition flex items-center justify-center ${
            activeTool === 'cross'
              ? 'bg-rose-600 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100 hover:text-rose-700'
          }`}
          title="Cross Mark (X)"
        >
          <CrossIcon className="w-4 h-4 font-bold stroke-[3]" />
        </button>

        {/* 6. Text Note Tool (N) */}
        <button
          type="button"
          data-testid="tool-text"
          onClick={() => onSelectTool('text')}
          className={`p-2 rounded-lg text-xs transition flex items-center justify-center ${
            activeTool === 'text'
              ? 'bg-indigo-600 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
          }`}
          title="Text Note (N)"
        >
          <Type className="w-4 h-4" />
        </button>

        {/* 7. Eraser Tool (E) */}
        <button
          type="button"
          data-testid="tool-eraser"
          onClick={() => onSelectTool('eraser')}
          className={`p-2 rounded-lg text-xs transition flex items-center justify-center ${
            activeTool === 'eraser'
              ? 'bg-slate-700 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
          }`}
          title="Eraser (E)"
        >
          <Eraser className="w-4 h-4" />
        </button>

        <div className="w-full h-px bg-slate-200 my-1" />

        {/* Color Palette (Red, Blue, Green, Black) */}
        <div className="flex flex-col items-center gap-1.5 py-0.5">
          {COLORS.map((c) => (
            <button
              key={c.value}
              type="button"
              data-testid={`color-picker-${c.value.replace('#', '')}`}
              onClick={() => onChangeColor(c.value)}
              className={`w-5 h-5 rounded-full border-2 transition-transform ${
                activeColor === c.value ? 'scale-125 border-slate-900 shadow-sm' : 'border-transparent hover:scale-110'
              }`}
              style={{ backgroundColor: c.value }}
              title={c.label}
            />
          ))}
        </div>

        <div className="w-full h-px bg-slate-200 my-1" />

        {/* Line Widths (3 options) */}
        <div className="flex flex-col items-center gap-1 py-0.5">
          {WIDTHS.map((w) => (
            <button
              key={w.value}
              type="button"
              data-testid={`width-picker-${w.value}`}
              onClick={() => onChangeWidth(w.value)}
              className={`w-7 h-5 flex items-center justify-center rounded hover:bg-slate-100 transition ${
                activeWidth === w.value ? 'bg-slate-200/80 font-bold' : ''
              }`}
              title={`Stroke: ${w.label}`}
            >
              <div
                className="w-4 rounded-full bg-slate-700"
                style={{ height: `${Math.max(1, w.value)}px` }}
              />
            </button>
          ))}
        </div>

        <div className="w-full h-px bg-slate-200 my-1" />

        {/* Visibility Switch: For Student vs Private */}
        <button
          type="button"
          data-testid="btn-toggle-visibility"
          onClick={() => onChangeVisibility(visibility === 'student' ? 'private' : 'student')}
          className={`p-2 rounded-lg text-xs transition flex items-center justify-center ${
            visibility === 'private'
              ? 'bg-amber-100 text-amber-800 border border-amber-300 shadow-xs'
              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
          }`}
          title={visibility === 'private' ? 'Visibility: Private (Hidden from student)' : 'Visibility: For student'}
        >
          {visibility === 'private' ? <Lock className="w-4 h-4 text-amber-700" /> : <Globe className="w-4 h-4" />}
        </button>

        {/* Show / Hide Toggle */}
        <button
          type="button"
          data-testid="btn-toggle-show-ink"
          onClick={onToggleVisible}
          className={`p-2 rounded-lg text-xs transition flex items-center justify-center ${
            !isVisible ? 'bg-slate-200 text-slate-500' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
          }`}
          title={isVisible ? 'Hide ink layer' : 'Show ink layer'}
        >
          {isVisible ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
        </button>

        <div className="w-full h-px bg-slate-200 my-1" />

        {/* Undo (Ctrl+Z) */}
        <button
          type="button"
          data-testid="btn-undo"
          onClick={onUndo}
          disabled={!canUndo}
          className="p-2 rounded-lg text-xs transition flex items-center justify-center text-slate-600 hover:bg-slate-100 disabled:opacity-30 disabled:pointer-events-none"
          title="Undo (Ctrl+Z)"
        >
          <Undo2 className="w-4 h-4" />
        </button>

        {/* Redo (Ctrl+Y) */}
        <button
          type="button"
          data-testid="btn-redo"
          onClick={onRedo}
          disabled={!canRedo}
          className="p-2 rounded-lg text-xs transition flex items-center justify-center text-slate-600 hover:bg-slate-100 disabled:opacity-30 disabled:pointer-events-none"
          title="Redo (Ctrl+Y)"
        >
          <Redo2 className="w-4 h-4" />
        </button>

        {/* Clear Page with Confirmation */}
        <button
          type="button"
          data-testid="btn-clear-page"
          onClick={handleClearClick}
          className={`p-2 rounded-lg text-xs transition flex items-center justify-center ${
            showClearConfirm
              ? 'bg-rose-600 text-white animate-pulse'
              : 'text-slate-500 hover:bg-rose-50 hover:text-rose-600'
          }`}
          title={showClearConfirm ? `Confirm Clear Page ${currentPage}?` : 'Clear page annotations'}
        >
          <Trash2 className="w-4 h-4" />
        </button>

        {/* Small Autosave Status Pill */}
        <div
          data-testid="autosave-status"
          className="mt-1 pt-1 border-t border-slate-100 flex flex-col items-center text-[10px]"
          title={
            saveStatus === 'saving'
              ? 'Saving annotations to server...'
              : saveStatus === 'saved'
              ? 'Annotations saved'
              : saveStatus === 'error'
              ? 'Save failed - retry available'
              : 'Ready'
          }
        >
          {saveStatus === 'saving' && (
            <span className="flex items-center gap-0.5 text-indigo-600 font-medium">
              <Loader2 className="w-3 h-3 animate-spin" />
            </span>
          )}
          {saveStatus === 'saved' && (
            <span className="flex items-center gap-0.5 text-emerald-600 font-medium">
              <CheckCircle2 className="w-3 h-3" />
            </span>
          )}
          {saveStatus === 'error' && (
            <span className="flex items-center gap-0.5 text-rose-600 font-medium">
              <AlertCircle className="w-3 h-3" />
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
