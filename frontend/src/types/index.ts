export type JobStatus = 'pending' | 'running' | 'completed' | 'failed';
export type StepStatus = 'pending' | 'running' | 'completed' | 'failed';

export interface ArtefactsConfig {
  epics_and_stories: boolean;
  functional_tests: boolean;
  gherkin_tests: boolean;
  data_model: boolean;
  code_skeleton: boolean;
}

export interface GenerateRequest {
  instructions: string;
  artefacts: ArtefactsConfig;
}

export interface Step {
  name: string;
  status: StepStatus;
  duration_ms?: number;
}

export interface AcceptanceCriterion {
  id: string;
  text: string;
  source_chunks?: string[];
}

export interface UserStory {
  id: string;
  epic_id: string;
  title: string;
  role: string;
  goal: string;
  benefit: string;
  acceptance_criteria: AcceptanceCriterion[];
  source_chunks?: string[];
  edited_at?: string;
  regeneration_needed?: boolean;
}

export interface Epic {
  id: string;
  name: string;
  description: string;
  edited_at?: string;
}

export interface FunctionalTest {
  id: string;
  story_id: string;
  title: string;
  objective: string;
  preconditions: string[];
  test_steps: string[];
  expected_results: string[];
  source_chunks?: string[];
}

export interface GherkinScenario {
  id: string;
  story_id: string;
  feature_name: string;
  scenario_name: string;
  given: string[];
  when: string[];
  then: string[];
  source_chunks?: string[];
}

export interface EntityField {
  name: string;
  type: string;
  required: boolean;
}

export interface Entity {
  name: string;
  description: string;
  fields: EntityField[];
}

export interface CodeTreeNode {
  name: string;
  type: 'file' | 'folder';
  path?: string;
  content?: string;
  children?: CodeTreeNode[];
}

export interface GenerationResults {
  project_name?: string;
  epics: Epic[];
  user_stories: UserStory[];
  functional_tests: FunctionalTest[];
  gherkin_tests: GherkinScenario[];
  entities: Entity[];
  mermaid?: string;
  code_tree: CodeTreeNode[];
}

export interface StatusResponse {
  status: JobStatus;
  error?: string;
  steps: Step[];
  results: GenerationResults;
  artefacts: ArtefactsConfig;
}
