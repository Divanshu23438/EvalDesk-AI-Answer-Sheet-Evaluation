import React, { useCallback } from 'react';
import { useSheetStore } from '../state/useSheetStore';
import { BentoMarksheetView } from '../components/BentoMarksheetView';

export const StudentMarksheetScreen: React.FC = () => {
  const [state] = useSheetStore();

  const getSheetId = useCallback(() => {
    if (state.sheetId) return state.sheetId;
    if (typeof window !== 'undefined' && window.location.hash) {
      const match = window.location.hash.match(/#\/report\/([a-zA-Z0-9_\-]+)/);
      if (match) return match[1];
    }
    return '';
  }, [state.sheetId]);

  const sheetId = getSheetId();

  const handleBack = () => {
    if (state.paperId) {
      window.location.hash = `#/evaluate/${state.paperId}`;
    } else {
      window.location.hash = '#/history';
    }
  };

  return (
    <div className="flex-1 min-h-0 bg-[#F6F7F5] overflow-y-auto">
      <BentoMarksheetView sheetId={sheetId} onBack={handleBack} showTopBar={true} />
    </div>
  );
};
