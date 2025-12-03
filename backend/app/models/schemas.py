from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from enum import Enum
from datetime import datetime


class JobStatus(str, Enum):
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"


class StepStatus(str, Enum):
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"


class ArtefactsConfig(BaseModel):
    epics_and_stories: bool = True
    functional_tests: bool = True
    gherkin_tests: bool = True
    data_model: bool = True
    code_skeleton: bool = True


class GenerateRequest(BaseModel):
    instructions: str = ""
    artefacts: ArtefactsConfig


class GenerateResponse(BaseModel):
    job_id: str


class Step(BaseModel):
    name: str
    status: StepStatus
    duration_ms: Optional[int] = None


class AcceptanceCriterion(BaseModel):
    id: str
    text: str
    source_chunks: Optional[List[str]] = None


class UserStory(BaseModel):
    id: str
    epic_id: str
    title: str
    role: str
    goal: str
    benefit: str
    acceptance_criteria: List[AcceptanceCriterion]
    source_chunks: Optional[List[str]] = None
    edited_at: Optional[datetime] = None
    regeneration_needed: bool = False


class Epic(BaseModel):
    id: str
    name: str
    description: str
    edited_at: Optional[datetime] = None


class FunctionalTest(BaseModel):
    id: str
    story_id: str
    title: str
    objective: str
    preconditions: List[str]
    test_steps: List[str]
    expected_results: List[str]
    source_chunks: Optional[List[str]] = None
    regenerated_at: Optional[datetime] = None


class GherkinScenario(BaseModel):
    id: str
    story_id: str
    feature_name: str
    scenario_name: str
    given: List[str]
    when: List[str]
    then: List[str]
    source_chunks: Optional[List[str]] = None
    regenerated_at: Optional[datetime] = None


class EntityField(BaseModel):
    name: str
    type: str
    required: bool


class Entity(BaseModel):
    name: str
    description: str
    fields: List[EntityField]
    regenerated_at: Optional[datetime] = None
    source_story_ids: Optional[List[str]] = []


class CodeFile(BaseModel):
    name: str
    content: str


class CodeFolder(BaseModel):
    path: str
    files: List[CodeFile]


class CodeSkeleton(BaseModel):
    language: str = "dotnet"
    root_folder: str
    folders: List[CodeFolder]


# Validation Models
class CTQScore(BaseModel):
    score: int  # 0-5
    findings: List[str]
    recommendations: List[str]


class ValidationReport(BaseModel):
    ctq_scores: Dict[str, int]  # {"completeness": 4, "clarity": 3, ...}
    overall_score: float
    key_gaps: List[str]
    remediation_actions: List[str]
    detailed_findings: Dict[str, CTQScore]
    timestamp: datetime = Field(default_factory=datetime.now)


class GapFix(BaseModel):
    gap_id: str
    gap_description: str
    affected_section: str
    current_text: str
    suggested_fix: str
    rationale: str
    confidence: str  # "high" | "medium" | "low"
    user_action: Optional[str] = None  # "accepted" | "edited" | "rejected" | "pending"
    final_text: Optional[str] = None


class GenerationResults(BaseModel):
    project_name: Optional[str] = None
    epics: List[Epic] = []
    user_stories: List[UserStory] = []
    functional_tests: List[FunctionalTest] = []
    gherkin_tests: List[GherkinScenario] = []
    entities: List[Entity] = []
    mermaid: Optional[str] = None
    code_tree: List[Dict[str, Any]] = []
    code_skeleton: Optional[CodeSkeleton] = None
    validation_report: Optional[ValidationReport] = None
    gap_fixes: List[GapFix] = Field(default_factory=list)


class DependencyImpact(BaseModel):
    affected_tests: int = 0
    affected_entities: int = 0
    affected_code: int = 0
    estimated_time_seconds: int = 0
    risk_level: str = "low"  # low, medium, high


class StatusResponse(BaseModel):
    status: JobStatus
    error: Optional[str] = None
    steps: List[Step]
    results: GenerationResults
    artefacts: ArtefactsConfig
