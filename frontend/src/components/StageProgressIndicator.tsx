import React from 'react';
import {
  CheckCircle2, Loader2,
  ShieldCheck, Map, Layers, FlaskConical, Code2, Database, PartyPopper, Upload,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { PipelineStage, StageState } from '@/types';

interface StageProgressIndicatorProps {
  currentStage: PipelineStage;
  stageHistory: StageState[];
}

const stageConfig = [
  { id: 'validation'       as PipelineStage, label: 'Validation',     Icon: ShieldCheck    },
  { id: 'requirement_map'  as PipelineStage, label: 'Req Map',        Icon: Map            },
  { id: 'epics'            as PipelineStage, label: 'Epics & Stories', Icon: Layers         },
  { id: 'functional_tests' as PipelineStage, label: 'Func Tests',     Icon: FlaskConical   },
  { id: 'gherkin_tests'    as PipelineStage, label: 'Gherkin',        Icon: Code2          },
  { id: 'data_model'       as PipelineStage, label: 'Data Model',     Icon: Database       },
  { id: 'completed'        as PipelineStage, label: 'Done',           Icon: PartyPopper    },
];

export const StageProgressIndicator: React.FC<StageProgressIndicatorProps> = ({
  currentStage,
  stageHistory,
}) => {
  const getStatus = (stageId: PipelineStage): 'completed' | 'current' | 'pending' => {
    const stageIndex   = stageConfig.findIndex(s => s.id === stageId);
    const currentIndex = stageConfig.findIndex(s => s.id === currentStage);
    const stageState   = stageHistory.find(s => s.stage === stageId);

    if (stageState?.status === 'completed') return 'completed';
    if (stageIndex < currentIndex)          return 'completed';
    if (stageId === currentStage)           return 'current';
    return 'pending';
  };

  const currentConfig = stageConfig.find(s => s.id === currentStage);

  return (
    <div className="bg-white border border-neutral-200 rounded-xl shadow-card px-6 py-4 mb-6">
      {/* Stage name label */}
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-semibold uppercase tracking-widest text-neutral-400">
          Pipeline Progress
        </p>
        {currentConfig && (
          <span className="flex items-center gap-1.5 text-xs font-medium text-indigo-600">
            <currentConfig.Icon className="w-3.5 h-3.5" />
            {currentConfig.label}
          </span>
        )}
      </div>

      {/* Steps */}
      <div className="flex items-center">
        {stageConfig.map((stage, index) => {
          const status = getStatus(stage.id);
          const isLast = index === stageConfig.length - 1;
          const { Icon } = stage;

          return (
            <React.Fragment key={stage.id}>
              {/* Step node */}
              <div className="flex flex-col items-center gap-1.5 shrink-0">
                <div
                  className={cn(
                    'w-8 h-8 rounded-full flex items-center justify-center transition-colors',
                    status === 'completed' && 'bg-emerald-500 text-white',
                    status === 'current'   && 'bg-indigo-600 text-white ring-4 ring-indigo-100',
                    status === 'pending'   && 'bg-neutral-100 text-neutral-400',
                  )}
                >
                  {status === 'completed' ? (
                    <CheckCircle2 className="w-4 h-4" />
                  ) : status === 'current' ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Icon className="w-4 h-4" />
                  )}
                </div>
                <span
                  className={cn(
                    'text-[10px] font-medium whitespace-nowrap',
                    status === 'completed' && 'text-emerald-600',
                    status === 'current'   && 'text-indigo-600',
                    status === 'pending'   && 'text-neutral-400',
                  )}
                >
                  {stage.label}
                </span>
              </div>

              {/* Connector line */}
              {!isLast && (
                <div
                  className={cn(
                    'flex-1 h-0.5 mx-1 mb-4 rounded-full transition-colors',
                    status === 'completed' ? 'bg-emerald-400' : 'bg-neutral-200',
                  )}
                />
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
};
