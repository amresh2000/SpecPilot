export type JobStatus = 'pending' | 'running' | 'completed' | 'failed';
export type StepStatus = 'pending' | 'running' | 'completed' | 'failed';

export type PipelineStage =
  | 'validation'
  | 'requirement_map'
  | 'epics'
  | 'functional_tests'
  | 'gherkin_tests'
  | 'data_model'
  | 'completed';

export type AtomicRequirementType =
  | 'functional'
  | 'business_rule'
  | 'exception'
  | 'validation'
  | 'nfr'
  | 'constraint';

export type AtomicRequirementStatus =
  | 'generated'
  | 'reviewed'
  | 'edited'
  | 'out_of_scope';

export interface AtomicRequirement {
  id: string;
  chunk_id: string;
  text: string;
  type: AtomicRequirementType;
  derived_from_table: boolean;
  status: AtomicRequirementStatus;
  edited_at?: string;
}

export interface RequirementChunk {
  chunk_id: string;
  title: string;
  semantic_type: string;
  summary: string;
  confidence: number;
  has_table: boolean;
  atomic_requirement_ids: string[];
}

export interface BrdChunk {
  id: string;
  type: 'section' | 'table';
  section_id: string;
  section_title: string;
  heading_level: number;
  parent_section_id: string | null;
  text: string;
  table_ref?: string;
}

export interface StageState {
  stage: PipelineStage;
  status: StepStatus;
  completed_at?: string;
  user_approved: boolean;
}

export interface GenerateMoreRequest {
  stage: PipelineStage;
  instructions: string;
  context_ids?: string[];
}

export interface ArtefactsConfig {
  epics_and_stories: boolean;
  functional_tests: boolean;
  gherkin_tests: boolean;
  data_model: boolean;
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
  atomic_requirement_ids?: string[];
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
  atomic_requirement_ids?: string[];
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
  atomic_requirement_ids?: string[];
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

export interface CTQScore {
  score: number;
  findings: string[];
  recommendations: string[];
}

export interface ValidationReport {
  ctq_scores: Record<string, number>;
  overall_score: number;
  key_gaps: string[];
  remediation_actions: string[];
  detailed_findings: Record<string, CTQScore>;
  timestamp: string;
}

export interface CoverageReport {
  total: number;
  covered_req_ids: string[];
  uncovered_req_ids: string[];
  coverage_pct: number;
}

export interface GapFix {
  gap_id: string;
  gap_description: string;
  affected_section: string;
  current_text: string;
  suggested_fix: string;
  rationale: string;
  confidence: 'high' | 'medium' | 'low';
  user_action?: string;
  final_text?: string;
}

export interface GenerationResults {
  project_name?: string;
  requirement_chunks: RequirementChunk[];
  atomic_requirements: AtomicRequirement[];
  epics: Epic[];
  user_stories: UserStory[];
  functional_tests: FunctionalTest[];
  gherkin_tests: GherkinScenario[];
  entities: Entity[];
  mermaid?: string;
  validation_report?: ValidationReport;
  gap_fixes: GapFix[];
}

export interface StatusResponse {
  status: JobStatus;
  current_stage?: PipelineStage;
  stage_history: StageState[];
  error?: string;
  steps: Step[];
  results: GenerationResults;
  artefacts: ArtefactsConfig;
}

export type WorkspacePhase =
  | 'generating_functional_tests'
  | 'functional_tests_ready'
  | 'generating_gherkin'
  | 'complete';
