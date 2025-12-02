import time
import asyncio
from typing import Dict, Any
from app.services.job_manager import job_manager
from app.services.brd_parser import BRDParser
from app.services.llm_client import BedrockLLMClient
from app.models import (
    JobStatus, StepStatus, Epic, UserStory, AcceptanceCriterion,
    FunctionalTest, GherkinScenario, Entity, EntityField, CodeSkeleton
)


class GenerationPipeline:
    """Orchestrates the entire generation process"""

    def __init__(self, job_id: str, file_path: str):
        self.job_id = job_id
        self.file_path = file_path
        self.parser = BRDParser()
        self.llm_client = BedrockLLMClient()

    async def run(self):
        """Execute the complete generation pipeline"""
        job = job_manager.get_job(self.job_id)
        if not job:
            return

        try:
            job_manager.update_job_status(self.job_id, JobStatus.RUNNING)

            # Step 1: Parse BRD
            await self._parse_brd()

            # Step 2: Generate EPICs and User Stories
            if job.artefacts.epics_and_stories:
                await self._generate_epics_and_stories()
                await asyncio.sleep(10)  # Rate limiting delay (increased to 10 seconds)

            # Step 3: Generate Data Model
            if job.artefacts.data_model and job.results.user_stories:
                await self._generate_data_model()
                await asyncio.sleep(10)  # Rate limiting delay (increased to 10 seconds)

            # Step 4: Generate Functional Tests
            if job.artefacts.functional_tests and job.results.user_stories:
                await self._generate_functional_tests()
                await asyncio.sleep(10)  # Rate limiting delay (increased to 10 seconds)

            # Step 5: Generate Gherkin Tests
            if job.artefacts.gherkin_tests and job.results.user_stories:
                await self._generate_gherkin_tests()
                await asyncio.sleep(10)  # Rate limiting delay (increased to 10 seconds)

            # Step 6: Generate Code Skeleton
            if job.artefacts.code_skeleton and job.results.entities:
                await self._generate_code_skeleton()

            # Mark job as completed
            job_manager.update_job_status(self.job_id, JobStatus.COMPLETED)

        except Exception as e:
            job.mark_failed(str(e))
            # Mark current running step as failed
            for step in job.steps:
                if step.status == StepStatus.RUNNING:
                    step.status = StepStatus.FAILED
                    break

    async def _parse_brd(self):
        """Parse the BRD document"""
        job = job_manager.get_job(self.job_id)
        start_time = time.time()

        try:
            job.update_step("Parsing documents", StepStatus.RUNNING)

            # Parse the document
            brd_data = self.parser.parse(self.file_path)
            job.brd_data = brd_data

            duration_ms = int((time.time() - start_time) * 1000)
            job.update_step("Parsing documents", StepStatus.COMPLETED, duration_ms)

        except Exception as e:
            job.update_step("Parsing documents", StepStatus.FAILED)
            raise RuntimeError(f"Failed to parse BRD: {str(e)}")

    async def _generate_epics_and_stories(self):
        """Generate project name, EPICs, and User Stories"""
        job = job_manager.get_job(self.job_id)

        # Project name step
        start_time = time.time()
        job.update_step("Generating project name", StepStatus.RUNNING)

        try:
            # Call LLM
            result = self.llm_client.generate_epics_and_stories(
                job.brd_data,
                job.instructions
            )

            # Parse and store results
            job.results.project_name = result.get('project_name', 'Untitled Project')

            # Parse EPICs
            for epic_data in result.get('epics', []):
                epic = Epic(**epic_data)
                job.results.epics.append(epic)

            # Parse User Stories
            for story_data in result.get('user_stories', []):
                # Parse acceptance criteria
                acs = []
                for ac_data in story_data.get('acceptance_criteria', []):
                    ac = AcceptanceCriterion(**ac_data)
                    acs.append(ac)

                story_data['acceptance_criteria'] = acs
                story = UserStory(**story_data)
                job.results.user_stories.append(story)

            duration_ms = int((time.time() - start_time) * 1000)
            job.update_step("Generating project name", StepStatus.COMPLETED, duration_ms)

            # EPICs and stories step (same call, mark as completed immediately)
            job.update_step("Generating EPICs & User Stories", StepStatus.COMPLETED, 0)

        except Exception as e:
            job.update_step("Generating project name", StepStatus.FAILED)
            raise RuntimeError(f"Failed to generate EPICs and stories: {str(e)}")

    async def _generate_functional_tests(self):
        """Generate functional test cases"""
        job = job_manager.get_job(self.job_id)
        start_time = time.time()

        try:
            job.update_step("Generating Functional Tests", StepStatus.RUNNING)

            # Collect chunk IDs from user stories
            chunk_ids = set()
            for story in job.results.user_stories:
                if story.source_chunks:
                    chunk_ids.update(story.source_chunks)
                for ac in story.acceptance_criteria:
                    if ac.source_chunks:
                        chunk_ids.update(ac.source_chunks)

            # Retrieve chunk data from BRD
            brd_chunks = []
            if job.brd_data and chunk_ids:
                all_chunks = job.brd_data.get('chunks', [])
                brd_chunks = [c for c in all_chunks if c['id'] in chunk_ids]

            # Call LLM with chunks
            result = self.llm_client.generate_functional_tests(
                job.results.user_stories,
                job.instructions,
                brd_chunks if brd_chunks else None
            )

            # Parse and store results
            for test_data in result.get('functional_tests', []):
                test = FunctionalTest(**test_data)
                job.results.functional_tests.append(test)

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

            # Call LLM
            result = self.llm_client.generate_gherkin_tests(
                job.results.user_stories
            )

            # Parse and store results
            for scenario_data in result.get('gherkin_tests', []):
                scenario = GherkinScenario(**scenario_data)
                job.results.gherkin_tests.append(scenario)

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

            # Call LLM
            result = self.llm_client.generate_data_model(
                job.brd_data,
                job.results.user_stories
            )

            # Parse and store entities
            for entity_data in result.get('entities', []):
                # Parse fields
                fields = []
                for field_data in entity_data.get('fields', []):
                    field = EntityField(**field_data)
                    fields.append(field)

                entity_data['fields'] = fields
                entity = Entity(**entity_data)
                job.results.entities.append(entity)

            # Store Mermaid diagram
            job.results.mermaid = result.get('mermaid', '')

            duration_ms = int((time.time() - start_time) * 1000)
            job.update_step("Generating Data Model", StepStatus.COMPLETED, duration_ms)

        except Exception as e:
            job.update_step("Generating Data Model", StepStatus.FAILED)
            raise RuntimeError(f"Failed to generate data model: {str(e)}")

    async def _generate_code_skeleton(self):
        """Generate ASP.NET code skeleton"""
        job = job_manager.get_job(self.job_id)
        start_time = time.time()

        try:
            job.update_step("Generating Code Skeleton", StepStatus.RUNNING)

            # Call LLM
            result = self.llm_client.generate_code_skeleton(
                job.results.project_name,
                job.results.entities
            )

            # Parse and store code skeleton
            skeleton_data = result.get('code_skeleton', {})
            job.results.code_skeleton = CodeSkeleton(**skeleton_data)

            # Build tree view for frontend
            job.results.code_tree = self._build_tree_view(job.results.code_skeleton)

            duration_ms = int((time.time() - start_time) * 1000)
            job.update_step("Generating Code Skeleton", StepStatus.COMPLETED, duration_ms)

        except Exception as e:
            job.update_step("Generating Code Skeleton", StepStatus.FAILED)
            raise RuntimeError(f"Failed to generate code skeleton: {str(e)}")

    def _build_tree_view(self, skeleton: CodeSkeleton) -> list:
        """Build a tree structure for frontend display"""
        tree = []

        for folder in skeleton.folders:
            # Split path into parts
            parts = folder.path.split('/')

            # Build tree structure
            current = tree
            for part in parts:
                # Find or create node
                node = next((n for n in current if n.get('name') == part and n.get('type') == 'folder'), None)
                if not node:
                    node = {
                        'name': part,
                        'type': 'folder',
                        'children': []
                    }
                    current.append(node)
                current = node['children']

            # Add files to the current folder
            for file in folder.files:
                current.append({
                    'name': file.name,
                    'type': 'file',
                    'path': f"{folder.path}/{file.name}",
                    'content': file.content
                })

        return tree
