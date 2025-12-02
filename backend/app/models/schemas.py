from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from enum import Enum


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


class Epic(BaseModel):
    id: str
    name: str
    description: str


class FunctionalTest(BaseModel):
    id: str
    story_id: str
    title: str
    objective: str
    preconditions: List[str]
    test_steps: List[str]
    expected_results: List[str]
    source_chunks: Optional[List[str]] = None


class GherkinScenario(BaseModel):
    id: str
    story_id: str
    feature_name: str
    scenario_name: str
    given: List[str]
    when: List[str]
    then: List[str]
    source_chunks: Optional[List[str]] = None


class EntityField(BaseModel):
    name: str
    type: str
    required: bool


class Entity(BaseModel):
    name: str
    description: str
    fields: List[EntityField]


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


class StatusResponse(BaseModel):
    status: JobStatus
    error: Optional[str] = None
    steps: List[Step]
    results: GenerationResults
    artefacts: ArtefactsConfig
