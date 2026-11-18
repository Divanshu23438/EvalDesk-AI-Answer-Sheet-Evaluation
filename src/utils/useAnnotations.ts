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
    (item: Partial<AnnotationItem> & { id: string; page_no: number; kind: AnnotationKind; data: any }) => {
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

      // Buffer in pending changes
      pendingChangesRef.current.set(fullItem.id, fullItem);
      scheduleAutosave();
    },
    [annotations, sheetId, scheduleAutosave]
  );

  // 5. Delete annotation (soft delete)
  const deleteAnnotation = useCallback(
    (id: string) => {
      const existing = annotations.find((a) => a.id === id);
      if (!existing) return;

      const deletedItem: AnnotationItem = {
        ...existing,
        deleted: true,
      };

      // Optimistic local update
      setAnnotations((prev) => prev.filter((a) => a.id !== id));
      pendingChangesRef.current.set(id, deletedItem);
      scheduleAutosave();
    },
    [annotations, scheduleAutosave]
  );

  // 6. Clear page annotations
  const clearPage = useCallback(
    async (pageNo: number) => {
      if (!sheetId) return;
      try {
        await apiClient.post(`/api/sheets/${sheetId}/annotations/clear?page=${pageNo}`);
        // Remove cleared page items locally
        setAnnotations((prev) => prev.filter((a) => a.page_no !== pageNo));
        // Also remove any pending items for this page
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
    [sheetId, onError]
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

  return {
    annotations,
    saveStatus,
    saveError,
    hasUnsavedChanges: pendingChangesRef.current.size > 0,
    upsertAnnotation,
    deleteAnnotation,
    clearPage,
    retrySave: executeSave,
    reload: loadAnnotations,
  };
}
