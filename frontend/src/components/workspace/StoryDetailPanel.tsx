import React, { useState } from 'react';
import { Loader2, FlaskConical, Code2 } from 'lucide-react';
import { EditableStory } from '@/components/EditableStory';
import { EditableFunctionalTest } from '@/components/EditableFunctionalTest';
import { EditableGherkinTest } from '@/components/EditableGherkinTest';
import { GenerateMorePanel } from '@/components/GenerateMorePanel';
import { cn } from '@/lib/utils';
import type { Epic, UserStory, FunctionalTest, GherkinScenario, WorkspacePhase } from '@/types';

interface StoryDetailPanelProps {
  story: UserStory | null;
  epic: Epic | null;
  functionalTests: FunctionalTest[];
  gherkinTests: GherkinScenario[];
  jobId: string;
  onUpdate: () => void;
  phase: WorkspacePhase;
}

type ActiveTab = 'functional' | 'gherkin';

const TabButton: React.FC<{
  label: string;
  count: number;
  icon: React.ElementType;
  active: boolean;
  onClick: () => void;
}> = ({ label, count, icon: Icon, active, onClick }) => (
  <button
    onClick={onClick}
    className={cn(
      'flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors',
      active
        ? 'border-indigo-600 text-indigo-600'
        : 'border-transparent text-neutral-500 hover:text-neutral-700 hover:border-neutral-300'
    )}
  >
    <Icon className="w-3.5 h-3.5" />
    {label}
    <span className={cn('text-xs rounded-full px-1.5 py-0.5 font-medium',
      active ? 'bg-indigo-100 text-indigo-700' : 'bg-neutral-100 text-neutral-500'
    )}>{count}</span>
  </button>
);

export const StoryDetailPanel: React.FC<StoryDetailPanelProps> = ({
  story, epic, functionalTests, gherkinTests, jobId, onUpdate, phase,
}) => {
  const [activeTab, setActiveTab] = useState<ActiveTab>('functional');

  if (!story || !epic) {
    return (
      <div className="flex-1 flex items-center justify-center text-neutral-400">
        <p className="text-sm">Select a story from the sidebar</p>
      </div>
    );
  }

  const renderFunctionalTab = () => {
    if (phase === 'generating_functional_tests') {
      return (
        <div className="flex items-center gap-2 text-sm text-neutral-500 py-6">
          <Loader2 className="w-4 h-4 animate-spin text-indigo-500" />
          <span>Generating tests for this story…</span>
        </div>
      );
    }
    return (
      <div className="space-y-4">
        {functionalTests.length === 0 ? (
          <div className="py-8 text-center">
            <FlaskConical className="w-8 h-8 text-neutral-300 mx-auto mb-2" />
            <p className="text-sm text-neutral-400">No tests generated for this story yet</p>
          </div>
        ) : (
          functionalTests.map(test => (
            <div key={test.id}>
              <EditableFunctionalTest test={test} jobId={jobId} onUpdate={onUpdate} />
              {test.atomic_requirement_ids && test.atomic_requirement_ids.length > 0 && (
                <div className="mt-1.5 mb-2 flex flex-wrap gap-1 pl-1">
                  {test.atomic_requirement_ids.map(id => (
                    <span key={id} className="px-1.5 py-0.5 text-[10px] font-mono rounded bg-violet-50 text-violet-700 border border-violet-100">
                      {id}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))
        )}
        <GenerateMorePanel
          jobId={jobId}
          stage="functional_tests"
          contextIds={[story.id]}
          onGenerated={onUpdate}
          placeholder="Generate additional tests for this story…"
        />
      </div>
    );
  };

  const renderGherkinTab = () => {
    if (phase === 'generating_functional_tests') {
      return <p className="text-sm text-neutral-400 py-6">Generate functional tests first.</p>;
    }
    if (phase === 'functional_tests_ready') {
      return <p className="text-sm text-neutral-400 py-6">Gherkin scenarios will be generated in the next step.</p>;
    }
    if (phase === 'generating_gherkin' && gherkinTests.length === 0) {
      return (
        <div className="flex items-center gap-2 text-sm text-neutral-500 py-6">
          <Loader2 className="w-4 h-4 animate-spin text-indigo-500" />
          <span>Generating scenarios for this story…</span>
        </div>
      );
    }
    return (
      <div className="space-y-4">
        {gherkinTests.length === 0 ? (
          <div className="py-8 text-center">
            <Code2 className="w-8 h-8 text-neutral-300 mx-auto mb-2" />
            <p className="text-sm text-neutral-400">No scenarios generated for this story yet</p>
          </div>
        ) : (
          gherkinTests.map(scenario => (
            <div key={scenario.id}>
              <EditableGherkinTest scenario={scenario} jobId={jobId} onUpdate={onUpdate} />
              {scenario.atomic_requirement_ids && scenario.atomic_requirement_ids.length > 0 && (
                <div className="mt-1.5 mb-2 flex flex-wrap gap-1 pl-1">
                  {scenario.atomic_requirement_ids.map(id => (
                    <span key={id} className="px-1.5 py-0.5 text-[10px] font-mono rounded bg-emerald-50 text-emerald-700 border border-emerald-100">
                      {id}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))
        )}
        <GenerateMorePanel
          jobId={jobId}
          stage="gherkin_tests"
          contextIds={[story.id]}
          onGenerated={onUpdate}
          placeholder="Generate additional Gherkin scenarios…"
        />
      </div>
    );
  };

  return (
    <div className="flex-1 overflow-y-auto p-5">
      {/* Breadcrumb */}
      <div className="text-xs text-neutral-400 mb-4">
        <span>{epic.name}</span>
        <span className="mx-1.5 text-neutral-300">›</span>
        <span className="text-neutral-700 font-medium">{story.title}</span>
      </div>

      {/* Story */}
      <div className="mb-5">
        <EditableStory story={story} jobId={jobId} onUpdate={onUpdate} />
      </div>

      {/* Tab bar */}
      <div className="border-b border-neutral-200 mb-4">
        <div className="flex">
          <TabButton
            label="Functional Tests"
            count={functionalTests.length}
            icon={FlaskConical}
            active={activeTab === 'functional'}
            onClick={() => setActiveTab('functional')}
          />
          <TabButton
            label="Gherkin Scenarios"
            count={gherkinTests.length}
            icon={Code2}
            active={activeTab === 'gherkin'}
            onClick={() => setActiveTab('gherkin')}
          />
        </div>
      </div>

      {activeTab === 'functional' ? renderFunctionalTab() : renderGherkinTab()}
    </div>
  );
};
