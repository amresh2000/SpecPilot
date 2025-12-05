import React from 'react';
import { CheckCircle2, Circle, Loader2 } from 'lucide-react';
import type { PipelineStage, StageState } from '@/types';

interface StageProgressIndicatorProps {
  currentStage: PipelineStage;
  stageHistory: StageState[];
}

const stageConfig = [
  { id: 'validation' as PipelineStage, label: 'Validation' },
  { id: 'epics' as PipelineStage, label: 'Epics & Stories' },
  { id: 'functional_tests' as PipelineStage, label: 'Functional Tests' },
  { id: 'gherkin_tests' as PipelineStage, label: 'Gherkin Tests' },
  { id: 'data_model' as PipelineStage, label: 'Data Model' },
  { id: 'code_generation' as PipelineStage, label: 'Code' },
  { id: 'completed' as PipelineStage, label: 'Completed' },
];

export const StageProgressIndicator: React.FC<StageProgressIndicatorProps> = ({
  currentStage,
  stageHistory,
}) => {
  const getStageStatus = (stageId: PipelineStage): 'completed' | 'current' | 'pending' => {
    // Find stage index in config
    const stageIndex = stageConfig.findIndex(s => s.id === stageId);
    const currentIndex = stageConfig.findIndex(s => s.id === currentStage);

    // Check stage history for this stage
    const stageState = stageHistory.find(s => s.stage === stageId);

    // If stage is completed in history, show as completed
    if (stageState && stageState.status === 'completed') return 'completed';

    // If we've moved past this stage (current index is higher), show as completed
    if (stageIndex < currentIndex) return 'completed';

    // Only show as current if it's the current stage
    if (stageId === currentStage) return 'current';

    return 'pending';
  };

  return (
    <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
      <h3 className="text-sm font-medium text-gray-700 mb-4">Pipeline Progress</h3>
      <div className="flex items-center justify-between">
        {stageConfig.map((stage, index) => {
          const status = getStageStatus(stage.id);
          const isLast = index === stageConfig.length - 1;

          return (
            <React.Fragment key={stage.id}>
              <div className="flex flex-col items-center">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center ${
                    status === 'completed'
                      ? 'bg-green-500 text-white'
                      : status === 'current'
                      ? 'bg-blue-500 text-white'
                      : 'bg-gray-200 text-gray-400'
                  }`}
                >
                  {status === 'completed' ? (
                    <CheckCircle2 className="w-6 h-6" />
                  ) : status === 'current' ? (
                    <Loader2 className="w-6 h-6 animate-spin" />
                  ) : (
                    <Circle className="w-6 h-6" />
                  )}
                </div>
                <span
                  className={`mt-2 text-xs font-medium ${
                    status === 'current'
                      ? 'text-blue-600'
                      : status === 'completed'
                      ? 'text-green-600'
                      : 'text-gray-400'
                  }`}
                >
                  {stage.label}
                </span>
              </div>
              {!isLast && (
                <div
                  className={`flex-1 h-1 mx-2 ${
                    status === 'completed' ? 'bg-green-500' : 'bg-gray-200'
                  }`}
                />
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
};
