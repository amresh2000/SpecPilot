import React from 'react';
import { Loader2, CheckCircle2, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import type { WorkspacePhase } from '@/types';

interface GenerationBannerProps {
  phase: WorkspacePhase;
  onGenerateGherkin: () => void;
  isTriggering: boolean;
  functionalTestsCount: number;
  storiesWithNoTests: number;
}

export const GenerationBanner: React.FC<GenerationBannerProps> = ({
  phase,
  onGenerateGherkin,
  isTriggering,
  functionalTestsCount,
  storiesWithNoTests,
}) => {
  if (phase === 'complete') return null;

  if (phase === 'generating_functional_tests') {
    return (
      <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 flex items-center gap-3">
        <Loader2 className="w-4 h-4 text-blue-600 animate-spin shrink-0" />
        <p className="text-sm text-blue-800">Generating functional tests...</p>
      </div>
    );
  }

  if (phase === 'functional_tests_ready') {
    const noTestsText = storiesWithNoTests > 0
      ? ` ${storiesWithNoTests} ${storiesWithNoTests === 1 ? 'story has' : 'stories have'} no tests.`
      : '';

    return (
      <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3 flex items-center justify-between gap-4">
        <div className="flex items-center gap-2 min-w-0">
          <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
          <p className="text-sm text-green-800">
            <span className="font-medium">{functionalTestsCount} functional tests ready.</span>
            {noTestsText && <span className="text-green-700">{noTestsText}</span>}
            <span className="text-green-700"> Review them, then generate Gherkin scenarios.</span>
          </p>
        </div>
        <Button
          size="sm"
          onClick={onGenerateGherkin}
          disabled={isTriggering}
          className="flex items-center gap-2 shrink-0"
        >
          {isTriggering
            ? <Loader2 className="w-3 h-3 animate-spin" />
            : <ArrowRight className="w-3 h-3" />
          }
          Generate Gherkin & Data Model
        </Button>
      </div>
    );
  }

  // phase === 'generating_gherkin'
  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 flex items-center gap-3">
      <Loader2 className="w-4 h-4 text-blue-600 animate-spin shrink-0" />
      <p className="text-sm text-blue-800">Generating Gherkin scenarios and data model...</p>
    </div>
  );
};
