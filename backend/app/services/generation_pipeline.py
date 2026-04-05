import asyncio
import time
from typing import Dict, Any
from app.services.job_manager import job_manager
from app.services.brd_parser import BRDParser
from app.services.llm_client import BedrockLLMClient
from app.models import (
    JobStatus, StepStatus, Epic, UserStory, AcceptanceCriterion,
    FunctionalTest, GherkinScenario, Entity, EntityField
)
from app.utils import log_info, log_error, extract_applied_gap_fixes


class GenerationPipeline:
    """Stage-by-stage generation orchestrator."""

    def __init__(self, job_id: str, file_path: str):
        self.job_id = job_id
        self.file_path = file_path
        self.parser = BRDParser()
        self.llm_client = BedrockLLMClient()

        job = job_manager.get_job(job_id)
        self.gap_fixes = extract_applied_gap_fixes(job.results.gap_fixes if job and job.results else [])

    async def _parse_brd(self):
        job = job_manager.get_job(self.job_id)
        start_time = time.time()
        try:
            job.update_step("Parsing documents", StepStatus.RUNNING)
            brd_data = self.parser.parse(self.file_path)
            job.brd_data = brd_data
            duration_ms = int((time.time() - start_time) * 1000)
            job.update_step("Parsing documents", StepStatus.COMPLETED, duration_ms)
        except Exception as e:
            job.update_step("Parsing documents", StepStatus.FAILED)
            raise RuntimeError(f"Failed to parse BRD: {str(e)}")

    async def _generate_epics_and_stories(self):
        """BRD → project name + epics + user stories in one call."""
        job = job_manager.get_job(self.job_id)
        start_time = time.time()

        try:
            job.update_step("Generating EPICs & User Stories", StepStatus.RUNNING)

            result = await asyncio.to_thread(
                self.llm_client.generate_epics_and_stories,
                job.brd_data,
                job.instructions,
                self.gap_fixes,
                job_id=self.job_id
            )

            job.results.project_name = result.get('project_name', 'Untitled Project')

            for epic_data in result.get('epics', []):
                job.results.epics.append(Epic(**epic_data))

            for story_data in result.get('user_stories', []):
                acs = [AcceptanceCriterion(**ac) for ac in story_data.get('acceptance_criteria', [])]
                story_data['acceptance_criteria'] = acs
                job.results.user_stories.append(UserStory(**story_data))

            duration_ms = int((time.time() - start_time) * 1000)
            job.update_step("Generating EPICs & User Stories", StepStatus.COMPLETED, duration_ms)

        except Exception as e:
            job.update_step("Generating EPICs & User Stories", StepStatus.FAILED)
            raise RuntimeError(f"Failed to generate EPICs and stories: {str(e)}")

    async def _generate_functional_tests(self):
        """User stories + BRD tables → functional tests."""
        job = job_manager.get_job(self.job_id)
        start_time = time.time()

        try:
            job.update_step("Generating Functional Tests", StepStatus.RUNNING)

            result = await asyncio.to_thread(
                self.llm_client.generate_functional_tests,
                job.results.user_stories,
                job.instructions,
                job.brd_data,
                self.gap_fixes,
                job_id=self.job_id
            )

            for test_data in result.get('functional_tests', []):
                job.results.functional_tests.append(FunctionalTest(**test_data))

            if not job.results.functional_tests:
                raise RuntimeError("LLM returned 0 functional tests.")

            duration_ms = int((time.time() - start_time) * 1000)
            job.update_step("Generating Functional Tests", StepStatus.COMPLETED, duration_ms)

        except Exception as e:
            job.update_step("Generating Functional Tests", StepStatus.FAILED)
            raise RuntimeError(f"Failed to generate functional tests: {str(e)}")

    async def _generate_gherkin_tests(self):
        """User stories + functional tests → Gherkin BDD scenarios."""
        job = job_manager.get_job(self.job_id)
        start_time = time.time()

        try:
            job.update_step("Generating Gherkin Tests", StepStatus.RUNNING)

            result = await asyncio.to_thread(
                self.llm_client.generate_gherkin_tests,
                job.results.user_stories,
                job.results.functional_tests,
                job.instructions,
                self.job_id
            )

            for scenario_data in result.get('gherkin_tests', []):
                job.results.gherkin_tests.append(GherkinScenario(**scenario_data))

            if not job.results.gherkin_tests:
                raise RuntimeError("LLM returned 0 Gherkin scenarios.")

            duration_ms = int((time.time() - start_time) * 1000)
            job.update_step("Generating Gherkin Tests", StepStatus.COMPLETED, duration_ms)

        except Exception as e:
            job.update_step("Generating Gherkin Tests", StepStatus.FAILED)
            raise RuntimeError(f"Failed to generate Gherkin tests: {str(e)}")

    async def _generate_data_model(self):
        """BRD tables + section summaries + stories → entities + Mermaid diagram."""
        job = job_manager.get_job(self.job_id)
        start_time = time.time()

        try:
            job.update_step("Generating Data Model", StepStatus.RUNNING)

            result = await asyncio.to_thread(
                self.llm_client.generate_data_model,
                job.brd_data,
                job.results.user_stories,
                self.gap_fixes,
                job_id=self.job_id
            )

            for entity_data in result.get('entities', []):
                fields = [EntityField(**f) for f in entity_data.get('fields', [])]
                entity_data['fields'] = fields
                job.results.entities.append(Entity(**entity_data))

            job.results.mermaid = result.get('mermaid', '')

            duration_ms = int((time.time() - start_time) * 1000)
            job.update_step("Generating Data Model", StepStatus.COMPLETED, duration_ms)

        except Exception as e:
            job.update_step("Generating Data Model", StepStatus.FAILED)
            raise RuntimeError(f"Failed to generate data model: {str(e)}")
