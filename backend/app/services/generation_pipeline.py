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
    """
    Stage-by-stage generation orchestrator.

    Methods are called by staged_endpoints.py for the staged workflow.
    """

    def __init__(self, job_id: str, file_path: str):
        self.job_id = job_id
        self.file_path = file_path
        self.parser = BRDParser()
        self.llm_client = BedrockLLMClient()

        job = job_manager.get_job(job_id)
        self.gap_fixes = extract_applied_gap_fixes(job.results.gap_fixes if job and job.results else [])

    async def _parse_brd(self):
        """Parse the BRD document"""
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
        """Generate project name, EPICs (phase 1), then User Stories in batches (phase 2)."""
        EPIC_BATCH_SIZE = 5  # Generate stories for 5 epics per LLM call to stay within output budget

        job = job_manager.get_job(self.job_id)
        start_time = time.time()
        job.update_step("Generating project name", StepStatus.RUNNING)

        try:
            # Phase 1: Generate project name + epics only
            result = self.llm_client.generate_epics_and_stories(
                job.brd_data,
                job.instructions,
                self.gap_fixes,
                job_id=self.job_id
            )

            job.results.project_name = result.get('project_name', 'Untitled Project')

            epics_data = result.get('epics', [])
            for epic_data in epics_data:
                epic = Epic(**epic_data)
                job.results.epics.append(epic)

            duration_ms = int((time.time() - start_time) * 1000)
            job.update_step("Generating project name", StepStatus.COMPLETED, duration_ms)

            # Phase 2: Generate user stories in batches of EPIC_BATCH_SIZE
            job.update_step("Generating EPICs & User Stories", StepStatus.RUNNING)
            story_id_offset = 0

            for i in range(0, len(epics_data), EPIC_BATCH_SIZE):
                epic_batch = epics_data[i:i + EPIC_BATCH_SIZE]
                batch_result = self.llm_client.generate_user_stories_for_epics(
                    epic_batch,
                    job.brd_data,
                    job.instructions,
                    self.gap_fixes,
                    story_id_offset=story_id_offset,
                    job_id=self.job_id
                )

                for story_data in batch_result.get('user_stories', []):
                    acs = []
                    for ac_data in story_data.get('acceptance_criteria', []):
                        ac = AcceptanceCriterion(**ac_data)
                        acs.append(ac)
                    story_data['acceptance_criteria'] = acs
                    story = UserStory(**story_data)
                    job.results.user_stories.append(story)

                story_id_offset += len(batch_result.get('user_stories', []))

            job.update_step("Generating EPICs & User Stories", StepStatus.COMPLETED, 0)

        except Exception as e:
            job.update_step("Generating project name", StepStatus.FAILED)
            raise RuntimeError(f"Failed to generate EPICs and stories: {str(e)}")

    async def _generate_functional_tests(self):
        """Generate functional test cases in batches of 20 stories."""
        STORY_BATCH_SIZE = 20

        job = job_manager.get_job(self.job_id)
        start_time = time.time()

        try:
            job.update_step("Generating Functional Tests", StepStatus.RUNNING)

            all_chunks = job.brd_data.get('chunks', []) if job.brd_data else []

            # Collect chunk IDs referenced by stories/ACs
            chunk_ids = set()
            for story in job.results.user_stories:
                if story.source_chunks:
                    chunk_ids.update(story.source_chunks)
                for ac in story.acceptance_criteria:
                    if ac.source_chunks:
                        chunk_ids.update(ac.source_chunks)

            # If stories have no source_chunks tracking, fall back to all chunks
            if chunk_ids:
                brd_chunks = [c for c in all_chunks if c['id'] in chunk_ids]
            else:
                brd_chunks = all_chunks  # fallback: full BRD context

            stories = job.results.user_stories
            for i in range(0, len(stories), STORY_BATCH_SIZE):
                batch = stories[i:i + STORY_BATCH_SIZE]
                result = self.llm_client.generate_functional_tests(
                    batch,
                    job.instructions,
                    brd_chunks if brd_chunks else None,
                    self.gap_fixes,
                    job_id=self.job_id
                )

                batch_tests = result.get('functional_tests', [])
                for test_data in batch_tests:
                    test = FunctionalTest(**test_data)
                    job.results.functional_tests.append(test)

            if not job.results.functional_tests:
                raise RuntimeError(
                    "LLM returned 0 functional tests across all story batches. "
                    "Enable LOG_LLM_RESPONSES=true and check logs/llm_responses for the raw response."
                )

            duration_ms = int((time.time() - start_time) * 1000)
            job.update_step("Generating Functional Tests", StepStatus.COMPLETED, duration_ms)

        except Exception as e:
            job.update_step("Generating Functional Tests", StepStatus.FAILED)
            raise RuntimeError(f"Failed to generate functional tests: {str(e)}")

    async def _generate_gherkin_tests(self):
        """Generate Gherkin BDD scenarios"""
        job = job_manager.get_job(self.job_id)
        start_time = time.time()

        try:
            job.update_step("Generating Gherkin Tests", StepStatus.RUNNING)

            # Reuse the same BRD chunks that were used for functional tests
            all_chunks = job.brd_data.get('chunks', []) if job.brd_data else []
            chunk_ids = set()
            for story in job.results.user_stories:
                if story.source_chunks:
                    chunk_ids.update(story.source_chunks)
            brd_chunks = [c for c in all_chunks if c['id'] in chunk_ids] if chunk_ids else all_chunks

            result = self.llm_client.generate_gherkin_tests(
                job.results.user_stories,
                job.results.functional_tests,
                job.instructions,   # was hardcoded ""
                brd_chunks=brd_chunks if brd_chunks else None,
                job_id=self.job_id
            )

            for scenario_data in result.get('gherkin_tests', []):
                scenario = GherkinScenario(**scenario_data)
                job.results.gherkin_tests.append(scenario)

            if not job.results.gherkin_tests:
                raise RuntimeError(
                    "LLM returned 0 Gherkin scenarios. "
                    "Enable LOG_LLM_RESPONSES=true and check logs/llm_responses for the raw response."
                )

            duration_ms = int((time.time() - start_time) * 1000)
            job.update_step("Generating Gherkin Tests", StepStatus.COMPLETED, duration_ms)

        except Exception as e:
            job.update_step("Generating Gherkin Tests", StepStatus.FAILED)
            raise RuntimeError(f"Failed to generate Gherkin tests: {str(e)}")

    async def _generate_data_model(self):
        """Generate entities and Mermaid diagram"""
        job = job_manager.get_job(self.job_id)
        start_time = time.time()

        try:
            job.update_step("Generating Data Model", StepStatus.RUNNING)

            result = self.llm_client.generate_data_model(
                job.brd_data,
                job.results.user_stories,
                self.gap_fixes,
                job_id=self.job_id
            )

            for entity_data in result.get('entities', []):
                fields = []
                for field_data in entity_data.get('fields', []):
                    field = EntityField(**field_data)
                    fields.append(field)

                entity_data['fields'] = fields
                entity = Entity(**entity_data)
                job.results.entities.append(entity)

            job.results.mermaid = result.get('mermaid', '')

            duration_ms = int((time.time() - start_time) * 1000)
            job.update_step("Generating Data Model", StepStatus.COMPLETED, duration_ms)

        except Exception as e:
            job.update_step("Generating Data Model", StepStatus.FAILED)
            raise RuntimeError(f"Failed to generate data model: {str(e)}")

