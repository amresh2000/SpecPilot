import type { ArtefactsConfig } from '@/types';

export interface StepDefinition {
  id: number;
  name: string;
  path: string;
}

/**
 * Generate dynamic steps based on selected artefacts
 */
export function getSteps(artefacts?: ArtefactsConfig): StepDefinition[] {
  const steps: StepDefinition[] = [
    { id: 1, name: 'Configuration', path: '/' },
    { id: 2, name: 'Generation', path: '/progress' },
  ];

  // Always include Results if any artefact is selected
  if (artefacts && (
    artefacts.epics_and_stories ||
    artefacts.functional_tests ||
    artefacts.gherkin_tests ||
    artefacts.data_model
  )) {
    steps.push({ id: 3, name: 'Results', path: '/results' });
  }

  // Only include Code Skeleton if it's selected
  if (artefacts?.code_skeleton) {
    steps.push({ id: 4, name: 'Code Skeleton', path: '/code' });
  }

  return steps;
}

/**
 * Get the step number for a given path based on artefacts
 */
export function getCurrentStep(path: string, artefacts?: ArtefactsConfig): number {
  const steps = getSteps(artefacts);
  const step = steps.find(s => path.startsWith(s.path));
  return step?.id || 1;
}
