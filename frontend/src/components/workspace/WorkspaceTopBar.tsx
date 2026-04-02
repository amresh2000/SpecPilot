import React from 'react';
import { ChevronRight, Download } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { api } from '@/lib/api';

interface WorkspaceTopBarProps {
  projectName: string | undefined;
  jobId: string;
  isComplete: boolean;
}

export const WorkspaceTopBar: React.FC<WorkspaceTopBarProps> = ({ projectName, jobId, isComplete }) => {
  const handleDownload = () => {
    window.open(api.getDownloadUrl(jobId), '_blank');
  };

  return (
    <div className="h-14 bg-white border-b border-gray-200 flex items-center justify-between px-6 shrink-0">
      <div className="flex items-center gap-1 min-w-0">
        <span className="font-semibold text-gray-900 shrink-0">SpecPilot</span>
        <ChevronRight className="w-4 h-4 text-gray-400 shrink-0" />
        <span className="text-gray-600 truncate">{projectName ?? 'Loading...'}</span>
      </div>
      <Button
        variant="outline"
        size="sm"
        onClick={handleDownload}
        disabled={!isComplete}
        className="flex items-center gap-2 shrink-0 ml-4"
      >
        <Download className="w-4 h-4" />
        Download ZIP
      </Button>
    </div>
  );
};
