"""Staged Pipeline Endpoints"""

from fastapi import APIRouter, HTTPException, BackgroundTasks
from app.models import PipelineStage, GenerateMoreRequest, ProceedToStageRequest
from app.services.job_manager import job_manager
from app.services.generation_pipeline import GenerationPipeline
from app.utils import log_info, log_error, extract_applied_gap_fixes
from pathlib import Path

router = APIRouter()
GENERATED_DIR = Path("generated")


@router.post("/proceed-to-stage/{job_id}")
async def proceed_to_stage(job_id: str, request: ProceedToStageRequest, background_tasks: BackgroundTasks):
    """Progress to the next pipeline stage after user approval"""
    try:
        log_info("Proceeding to stage", job_id=job_id, next_stage=request.next_stage.value)

        job = job_manager.get_job(job_id)
        if not job:
            log_error("Job not found", job_id=job_id)
            raise HTTPException(status_code=404, detail="Job not found")

        stage = request.next_stage

        stage_already_completed = any(
            s.stage == stage and s.status == "completed"
            for s in job.stage_history
        )

        if stage_already_completed:
            job.current_stage = stage
            return {
                "job_id": job_id,
                "stage": stage,
                "status": "already_completed",
                "message": "Stage already completed, skipping regeneration"
            }

        job.advance_stage(stage)

        job_dir = GENERATED_DIR / job_id
        uploaded_files = list(job_dir.glob("brd.*"))
        if not uploaded_files:
            raise HTTPException(status_code=400, detail="BRD file not found")

        uploaded_file_path = str(uploaded_files[0])

        async def run_stage_generation():
            try:
                pipeline = GenerationPipeline(job_id, uploaded_file_path)

                if not job.brd_data:
                    await pipeline._parse_brd()

                if stage == PipelineStage.EPICS:
                    await pipeline._generate_epics_and_stories()
                elif stage == PipelineStage.FUNCTIONAL_TESTS:
                    await pipeline._generate_functional_tests()
                elif stage == PipelineStage.GHERKIN_TESTS:
                    await pipeline._generate_gherkin_tests()
                elif stage == PipelineStage.DATA_MODEL:
                    await pipeline._generate_data_model()
                elif stage == PipelineStage.CODE_GENERATION:
                    await pipeline._generate_code_skeleton()

                job.complete_current_stage()

            except Exception as e:
                job.mark_failed(str(e))

        background_tasks.add_task(run_stage_generation)

        return {
            "job_id": job_id,
            "stage": stage,
            "status": "started"
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/generate-more/{job_id}")
async def generate_more(
    job_id: str,
    request: GenerateMoreRequest,
    background_tasks: BackgroundTasks
):
    """Generate additional artifacts at current stage based on user instructions"""
    try:
        job = job_manager.get_job(job_id)
        if not job:
            raise HTTPException(status_code=404, detail="Job not found")

        # Find uploaded file
        job_dir = GENERATED_DIR / job_id
        uploaded_files = list(job_dir.glob("brd.*"))
        if not uploaded_files:
            raise HTTPException(status_code=400, detail="BRD file not found")

        uploaded_file_path = str(uploaded_files[0])

        # Generate more artifacts based on stage
        async def run_generate_more():
            try:
                from app.services.llm_client import BedrockLLMClient
                llm_client = BedrockLLMClient()

                # Extract applied gap fixes using utility function
                gap_fixes = extract_applied_gap_fixes(job.results.gap_fixes if job.results else [])

                if request.stage == PipelineStage.EPICS:
                    # Build list of existing epics to avoid duplication
                    existing_epics = [
                        {"name": epic.name, "description": epic.description}
                        for epic in job.results.epics
                    ]

                    # Generate more epics and stories
                    result = llm_client.generate_epics_and_stories(
                        job.brd_data,
                        f"{job.instructions}\n\nAdditional instructions: {request.instructions}",
                        gap_fixes,
                        existing_epics
                    )

                    # Add new epics/stories to existing
                    from app.models import Epic, UserStory, AcceptanceCriterion
                    for epic_data in result.get('epics', []):
                        epic = Epic(**epic_data)
                        job.results.epics.append(epic)

                    for story_data in result.get('user_stories', []):
                        acs = []
                        for ac_data in story_data.get('acceptance_criteria', []):
                            ac = AcceptanceCriterion(**ac_data)
                            acs.append(ac)
                        story_data['acceptance_criteria'] = acs
                        story = UserStory(**story_data)
                        job.results.user_stories.append(story)

                elif request.stage == PipelineStage.FUNCTIONAL_TESTS:
                    # Generate more functional tests
                    # Filter stories based on context_ids if provided
                    stories_to_use = job.results.user_stories
                    if request.context_ids:
                        stories_to_use = [s for s in job.results.user_stories if s.id in request.context_ids]
                        log_info(
                            "Filtering stories for Functional Tests generation",
                            job_id=job_id,
                            total_stories=len(job.results.user_stories),
                            filtered_stories=len(stories_to_use),
                            context_ids=request.context_ids
                        )

                    # Collect chunk IDs from stories
                    chunk_ids = set()
                    for story in stories_to_use:
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

                    result = llm_client.generate_functional_tests(
                        stories_to_use,
                        f"{job.instructions}\n\nAdditional instructions: {request.instructions}",
                        brd_chunks if brd_chunks else None,
                        gap_fixes
                    )

                    from app.models import FunctionalTest
                    for test_data in result.get('functional_tests', []):
                        test = FunctionalTest(**test_data)
                        job.results.functional_tests.append(test)

                elif request.stage == PipelineStage.GHERKIN_TESTS:
                    # Generate more gherkin tests with functional tests as context
                    stories_to_use = job.results.user_stories
                    if request.context_ids:
                        stories_to_use = [s for s in job.results.user_stories if s.id in request.context_ids]
                        log_info(
                            "Filtering stories for Gherkin generation",
                            job_id=job_id,
                            total_stories=len(job.results.user_stories),
                            filtered_stories=len(stories_to_use),
                            context_ids=request.context_ids
                        )

                    # Filter functional tests to match filtered stories
                    functional_tests_to_use = job.results.functional_tests
                    if request.context_ids:
                        functional_tests_to_use = [
                            ft for ft in job.results.functional_tests
                            if ft.story_id in request.context_ids
                        ]
                        log_info(
                            "Filtering functional tests for Gherkin generation",
                            job_id=job_id,
                            total_tests=len(job.results.functional_tests),
                            filtered_tests=len(functional_tests_to_use)
                        )

                    # Gap fixes already incorporated into functional tests
                    result = llm_client.generate_gherkin_tests(
                        stories_to_use,
                        functional_tests_to_use,  # Pass filtered functional tests as context
                        request.instructions
                    )

                    from app.models import GherkinScenario
                    for scenario_data in result.get('gherkin_tests', []):
                        scenario = GherkinScenario(**scenario_data)
                        job.results.gherkin_tests.append(scenario)

            except Exception as e:
                import logging
                logger = logging.getLogger(__name__)
                logger.error(f"Generate more failed: {e}", exc_info=True)

        background_tasks.add_task(run_generate_more)

        return {
            "job_id": job_id,
            "stage": request.stage,
            "status": "generating"
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
