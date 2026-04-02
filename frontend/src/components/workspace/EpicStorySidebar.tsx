import React, { useState, useEffect } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import type { Epic, UserStory, FunctionalTest, GherkinScenario, WorkspacePhase } from '@/types';

function cn(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(' ');
}

interface EpicStorySidebarProps {
  epics: Epic[];
  stories: UserStory[];
  functionalTests: FunctionalTest[];
  gherkinTests: GherkinScenario[];
  selectedStoryId: string | null;
  onSelectStory: (storyId: string) => void;
  phase: WorkspacePhase;
}

export const EpicStorySidebar: React.FC<EpicStorySidebarProps> = ({
  epics,
  stories,
  functionalTests,
  gherkinTests,
  selectedStoryId,
  onSelectStory,
  phase,
}) => {
  const [expandedEpics, setExpandedEpics] = useState<Set<string>>(new Set());

  // Auto-expand new epics as they arrive without collapsing ones the user toggled
  useEffect(() => {
    setExpandedEpics(prev => {
      const next = new Set(prev);
      epics.forEach(e => next.add(e.id));
      return next;
    });
  }, [epics]);

  const toggleEpic = (epicId: string) => {
    setExpandedEpics(prev => {
      const next = new Set(prev);
      if (next.has(epicId)) {
        next.delete(epicId);
      } else {
        next.add(epicId);
      }
      return next;
    });
  };

  return (
    <div className="w-72 shrink-0 border-r border-gray-200 bg-white flex flex-col overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100">
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Epics</span>
      </div>
      <div className="flex-1 overflow-y-auto">
        {epics.length === 0 ? (
          <div className="px-4 py-6 text-xs text-gray-400 text-center">Loading epics...</div>
        ) : (
          epics.map(epic => {
            const epicStories = stories.filter(s => s.epic_id === epic.id);
            const isExpanded = expandedEpics.has(epic.id);

            return (
              <div key={epic.id}>
                {/* Epic header */}
                <button
                  onClick={() => toggleEpic(epic.id)}
                  className="w-full flex items-center gap-2 px-4 py-2 hover:bg-gray-50 text-left"
                >
                  {isExpanded
                    ? <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />
                    : <ChevronRight className="w-4 h-4 text-gray-400 shrink-0" />
                  }
                  <span className="text-sm font-medium text-gray-700 truncate">{epic.name}</span>
                  <span className="ml-auto text-xs text-gray-400 shrink-0">{epicStories.length}</span>
                </button>

                {/* Stories under epic */}
                {isExpanded && epicStories.map(story => {
                  const ftCount = functionalTests.filter(t => t.story_id === story.id).length;
                  const ghCount = gherkinTests.filter(t => t.story_id === story.id).length;
                  const showWarning = ftCount === 0 && ghCount === 0 && phase !== 'generating_functional_tests';
                  const isSelected = story.id === selectedStoryId;

                  return (
                    <button
                      key={story.id}
                      onClick={() => onSelectStory(story.id)}
                      className={cn(
                        'w-full flex items-center justify-between pl-10 pr-4 py-2 text-left hover:bg-gray-50 border-l-2 transition-colors',
                        isSelected ? 'bg-blue-50 border-blue-500' : 'border-transparent'
                      )}
                    >
                      <span className={cn(
                        'text-sm truncate flex-1',
                        isSelected ? 'text-blue-700 font-medium' : 'text-gray-700'
                      )}>
                        {story.title}
                      </span>
                      <div className="flex items-center gap-1.5 ml-2 shrink-0">
                        {showWarning && (
                          <span className="w-2 h-2 rounded-full bg-amber-400" title="No tests generated" />
                        )}
                        <span className="text-xs text-gray-400">{ftCount}f {ghCount}g</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
