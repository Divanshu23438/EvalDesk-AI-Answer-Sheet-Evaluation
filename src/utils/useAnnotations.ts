import { useState, useEffect, useRef, useCallback } from 'react';
import { apiClient } from '../api/client';

export type AnnotationKind = 'pen' | 'highlight' | 'tick' | 'cross' | 'text';
export type AnnotationVisibility = 'student' | 'private';

export interface AnnotationItem {
  id: string;
  sheet_id: string;
  page_no: number;
  question_key?: string | null;
  kind: AnnotationKind;
  data: any;
  color: string;
  width: number;
  visibility: AnnotationVisibility;
  created_by?: string;
  created_at?: string;
  updated_at?: string;
  deleted_at?: string | null;
  version: number;
  deleted?: boolean;
}

export interface UseAnnotationsOptions {
  sheetId: string;
  autosaveDelay?: number; // default 600ms
  onError?: (err: any) => void;
}

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

export type HistoryAction =
  | { type: 'add'; item: AnnotationItem }
  | { type: 'delete'; item: AnnotationItem }
  | { type: 'update'; prev: AnnotationItem; next: AnnotationItem }
  | { type: 'clear'; items: AnnotationItem[] };

export function useAnnotations({
  sheetId,
  autosaveDelay = 600,
  onError,
}: UseAnnotationsOptions) {
  const [annotations, setAnnotations] = useState<AnnotationItem[]>([]);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [saveError, setSaveError] = useState<{
    code: string;
    message: string;
    stage: string;
    retryable: boolean;
  } | null>(null);

  // Client-side Undo/Redo history stacks with instant refs
  const undoStackRef = useRef<HistoryAction[]>([]);
  const redoStackRef = useRef<HistoryAction[]>([]);
  const [historyVersion, setHistoryVersion] = useState<number>(0);

  // Pending unsaved queue (id -> item)
  const pendingChangesRef = useRef<Map<string, AnnotationItem>>(new Map());
  const autosaveTimerRef = useRef<any>(null);
  const isSavingRef = useRef<boolean>(false);

  // 1. Fetch initial annotations from server
  const loadAnnotations = useCallback(async () => {
    if (!sheetId) return;
    try {
      const res = await apiClient.get<{ annotations: AnnotationItem[] }>(
        `/api/sheets/${sheetId}/annotations`
      );
      setAnnotations(res.annotations || []);
      setSaveStatus('idle');
      setSaveError(null);
    } catch (err: any) {
      onError?.(err);
    }
  }, [sheetId, onError]);

  useEffect(() => {
    loadAnnotations();
  }, [loadAnnotations]);

  // 2. Perform save operation
  const executeSave = useCallback(async () => {
    if (!sheetId || pendingChangesRef.current.size === 0 || isSavingRef.current) {
      return;
    }

    isSavingRef.current = true;
    setSaveStatus('saving');

    const batchToSave = Array.from(pendingChangesRef.current.values());

    try {
      const res = await apiClient.put<{
        success: boolean;
        annotations: AnnotationItem[];
      }>(`/api/sheets/${sheetId}/annotations`, {
        annotations: batchToSave,
      });

      // Clear saved changes from pending map
      for (const item of batchToSave) {
        pendingChangesRef.current.delete(item.id);
      }

      setAnnotations(res.annotations || []);
      setSaveStatus('saved');
      setSaveError(null);
    } catch (err: any) {
      const errPayload = {
        code: err?.code || 'ANNOTATION_SAVE_FAILED',
        message: err?.message || 'Failed to save annotations to server.',
        stage: 'annotations',
        retryable: true,
      };
      setSaveStatus('error');
      setSaveError(errPayload);
      onError?.(errPayload);

      // If version conflict, reload latest from server to reconcile
      if (err?.code === 'VERSION_CONFLICT' || err?.status === 409) {
        loadAnnotations();
      }
    } finally {
      isSavingRef.current = false;
    }
  }, [sheetId, onError, loadAnnotations]);

  // 3. Debounced trigger for autosave (~600ms after last change)
  const scheduleAutosave = useCallback(() => {
    setSaveStatus('saving');
    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current);
    }
    autosaveTimerRef.current = setTimeout(() => {
      executeSave();
    }, autosaveDelay);
  }, [executeSave, autosaveDelay]);

  // 4. Add or update annotation
  const upsertAnnotation = useCallback(
    (
      item: Partial<AnnotationItem> & {
        id: string;
        page_no: number;
        kind: AnnotationKind;
        data: any;
      },
      addToHistory = true
    ) => {
      const existing = annotations.find((a) => a.id === item.id);
      const fullItem: AnnotationItem = {
        id: item.id,
        sheet_id: sheetId,
        page_no: item.page_no,
        question_key: item.question_key || null,
        kind: item.kind,
        data: item.data,
        color: item.color || existing?.color || '#ef4444',
        width: item.width || existing?.width || 2.0,
        visibility: item.visibility || existing?.visibility || 'student',
        version: existing?.version || 1,
        deleted: false,
      };

      // Optimistic local update
      setAnnotations((prev) => {
        const idx = prev.findIndex((a) => a.id === item.id);
        if (idx >= 0) {
          const next = [...prev];
          next[idx] = fullItem;
          return next;
        }
        return [...prev, fullItem];
      });

      // Push to client history stack
      if (addToHistory) {
        if (existing) {
          undoStackRef.current.push({ type: 'update', prev: existing, next: fullItem });
        } else {
          undoStackRef.current.push({ type: 'add', item: fullItem });
        }
        redoStackRef.current = []; // Clear redo stack on new action
        setHistoryVersion((v) => v + 1);
      }

      // Buffer in pending changes
      pendingChangesRef.current.set(fullItem.id, fullItem);
      scheduleAutosave();
    },
    [annotations, sheetId, scheduleAutosave]
  );

  // 5. Delete annotation (soft delete)
  const deleteAnnotation = useCallback(
    (id: string, addToHistory = true) => {
      const existing = annotations.find((a) => a.id === id);
      if (!existing) return;

      const deletedItem: AnnotationItem = {
        ...existing,
        deleted: true,
      };

      // Optimistic local update
      setAnnotations((prev) => prev.filter((a) => a.id !== id));

      if (addToHistory) {
        undoStackRef.current.push({ type: 'delete', item: existing });
        redoStackRef.current = [];
        setHistoryVersion((v) => v + 1);
      }

      pendingChangesRef.current.set(id, deletedItem);
      scheduleAutosave();
    },
    [annotations, scheduleAutosave]
  );

  // 6. Undo & Redo Actions
  const undo = useCallback(() => {
    if (undoStackRef.current.length === 0) return;
    const lastAction = undoStackRef.current.pop()!;
    redoStackRef.current.push(lastAction);
    setHistoryVersion((v) => v + 1);

    if (lastAction.type === 'add') {
      // Revert add -> soft delete locally & buffer
      const itemToDelete = lastAction.item;
      setAnnotations((prev) => prev.filter((a) => a.id !== itemToDelete.id));
      pendingChangesRef.current.set(itemToDelete.id, { ...itemToDelete, deleted: true });
      scheduleAutosave();
    } else if (lastAction.type === 'delete') {
      // Revert delete -> restore item
      const itemToRestore = { ...lastAction.item, deleted: false };
      setAnnotations((prev) => [...prev.filter((a) => a.id !== itemToRestore.id), itemToRestore]);
      pendingChangesRef.current.set(itemToRestore.id, itemToRestore);
      scheduleAutosave();
    } else if (lastAction.type === 'update') {
      // Revert update -> restore prev
      const prevItem = lastAction.prev;
      setAnnotations((prev) => prev.map((a) => (a.id === prevItem.id ? prevItem : a)));
      pendingChangesRef.current.set(prevItem.id, prevItem);
      scheduleAutosave();
    } else if (lastAction.type === 'clear') {
      // Restore cleared items
      const itemsToRestore = lastAction.items;
      setAnnotations((prev) => [...prev, ...itemsToRestore]);
      for (const item of itemsToRestore) {
        pendingChangesRef.current.set(item.id, { ...item, deleted: false });
      }
      scheduleAutosave();
    }
  }, [scheduleAutosave]);

  const redo = useCallback(() => {
    if (redoStackRef.current.length === 0) return;
    const lastAction = redoStackRef.current.pop()!;
    undoStackRef.current.push(lastAction);
    setHistoryVersion((v) => v + 1);

    if (lastAction.type === 'add') {
      const itemToAdd = { ...lastAction.item, deleted: false };
      setAnnotations((prev) => [...prev.filter((a) => a.id !== itemToAdd.id), itemToAdd]);
      pendingChangesRef.current.set(itemToAdd.id, itemToAdd);
      scheduleAutosave();
    } else if (lastAction.type === 'delete') {
      const itemToDelete = lastAction.item;
      setAnnotations((prev) => prev.filter((a) => a.id !== itemToDelete.id));
      pendingChangesRef.current.set(itemToDelete.id, { ...itemToDelete, deleted: true });
      scheduleAutosave();
    } else if (lastAction.type === 'update') {
      const nextItem = lastAction.next;
      setAnnotations((prev) => prev.map((a) => (a.id === nextItem.id ? nextItem : a)));
      pendingChangesRef.current.set(nextItem.id, nextItem);
      scheduleAutosave();
    } else if (lastAction.type === 'clear') {
      const itemsToRemove = lastAction.items;
      const idsToRemove = new Set(itemsToRemove.map((a) => a.id));
      setAnnotations((prev) => prev.filter((a) => !idsToRemove.has(a.id)));
      for (const item of itemsToRemove) {
        pendingChangesRef.current.set(item.id, { ...item, deleted: true });
      }
      scheduleAutosave();
    }
  }, [scheduleAutosave]);

  // 7. Clear page annotations (with undo support)
  const clearPage = useCallback(
    async (pageNo: number) => {
      if (!sheetId) return;
      const pageItems = annotations.filter((a) => a.page_no === pageNo && !a.deleted);
      if (pageItems.length > 0) {
        undoStackRef.current.push({ type: 'clear', items: pageItems });
        redoStackRef.current = [];
        setHistoryVersion((v) => v + 1);
      }
      try {
        await apiClient.post(`/api/sheets/${sheetId}/annotations/clear?page=${pageNo}`);
        // Remove cleared page items locally
        setAnnotations((prev) => prev.filter((a) => a.page_no !== pageNo));
        for (const [key, item] of pendingChangesRef.current.entries()) {
          if (item.page_no === pageNo) {
            pendingChangesRef.current.delete(key);
          }
        }
        setSaveStatus('saved');
      } catch (err: any) {
        onError?.(err);
      }
    },
    [sheetId, annotations, onError]
  );

  // 7. Warn before leaving if unsaved changes exist
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (pendingChangesRef.current.size > 0) {
        e.preventDefault();
        e.returnValue = 'You have unsaved annotations.';
        return 'You have unsaved annotations.';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);

  // Flush pending changes immediately
  const flush = useCallback(async () => {
    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current);
      autosaveTimerRef.current = null;
    }
    return executeSave();
  }, [executeSave]);

  return {
    annotations,
    saveStatus,
    saveError,
    hasUnsavedChanges: pendingChangesRef.current.size > 0,
    canUndo: undoStackRef.current.length > 0,
    canRedo: redoStackRef.current.length > 0,
    undo,
    redo,
    upsertAnnotation,
    deleteAnnotation,
    clearPage,
    flush,
    retrySave: executeSave,
    reload: loadAnnotations,
  };
}
