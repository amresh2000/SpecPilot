import uuid
from typing import Dict, Optional
from app.models import (
    JobStatus,
    StepStatus,
    Step,
    GenerationResults,
    ArtefactsConfig,
)


class Job:
    def __init__(self, job_id: str, instructions: str, artefacts: ArtefactsConfig):
        self.job_id = job_id
        self.instructions = instructions
        self.artefacts = artefacts
        self.status = JobStatus.PENDING
        self.error: Optional[str] = None
        self.steps: list[Step] = []
        self.results = GenerationResults()
        self.brd_data: Optional[Dict] = None
        self.uploaded_filename: Optional[str] = None

    def add_step(self, name: str) -> Step:
        step = Step(name=name, status=StepStatus.PENDING)
        self.steps.append(step)
        return step

    def update_step(self, name: str, status: StepStatus, duration_ms: Optional[int] = None):
        for step in self.steps:
            if step.name == name:
                step.status = status
                if duration_ms is not None:
                    step.duration_ms = duration_ms
                break

    def mark_failed(self, error: str):
        self.status = JobStatus.FAILED
        self.error = error


class JobManager:
    def __init__(self):
        self.jobs: Dict[str, Job] = {}

    def create_job(self, instructions: str, artefacts: ArtefactsConfig) -> str:
        job_id = str(uuid.uuid4())
        job = Job(job_id, instructions, artefacts)
        self.jobs[job_id] = job
        return job_id

    def get_job(self, job_id: str) -> Optional[Job]:
        return self.jobs.get(job_id)

    def update_job_status(self, job_id: str, status: JobStatus):
        if job_id in self.jobs:
            self.jobs[job_id].status = status


# Global job manager instance
job_manager = JobManager()
