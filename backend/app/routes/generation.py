import os
import json
import shutil
import tempfile
import asyncio
from pathlib import Path
from fastapi import APIRouter, UploadFile, File, Form, HTTPException, BackgroundTasks
from fastapi.responses import FileResponse
from app.models import GenerateRequest, GenerateResponse, StatusResponse, ArtefactsConfig, StepStatus, JobStatus, FunctionalTest
from app.services.job_manager import job_manager
from app.services.brd_parser import BRDParser
from app.services.generation_pipeline import GenerationPipeline
from app.services.llm_client import BedrockLLMClient

router = APIRouter()

# Ensure generated directory exists
GENERATED_DIR = Path("generated")
GENERATED_DIR.mkdir(exist_ok=True)


async def run_generation_pipeline(job_id: str, file_content: bytes, file_extension: str):
    """Background task to save file and run the generation pipeline"""
    try:
        # Save the uploaded file
        job_dir = GENERATED_DIR / job_id
        job_dir.mkdir(exist_ok=True)
        uploaded_file_path = job_dir / f"brd{file_extension}"

        with open(uploaded_file_path, 'wb') as f:
            f.write(file_content)

        # Run the generation pipeline
        pipeline = GenerationPipeline(job_id, str(uploaded_file_path))
        await pipeline.run()
    except Exception as e:
        # Mark job as failed if pipeline crashes
        job = job_manager.get_job(job_id)
        if job:
            job.mark_failed(str(e))


@router.post("/generate", response_model=GenerateResponse)
async def generate(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    payload: str = Form(...)
):
    """Start the generation pipeline"""
    try:
        # Parse payload
        request_data = json.loads(payload)
        request = GenerateRequest(**request_data)

        # Validate file type
        if not (file.filename.endswith('.docx') or file.filename.endswith('.txt')):
            raise HTTPException(status_code=400, detail="Only .docx and .txt files are supported")

        # Check file size (15MB limit)
        content = await file.read()
        if len(content) > 15 * 1024 * 1024:
            raise HTTPException(status_code=400, detail="File size exceeds 15MB limit")

        # Create job
        job_id = job_manager.create_job(request.instructions, request.artefacts)
        job = job_manager.get_job(job_id)

        # Store filename
        job.uploaded_filename = file.filename

        # Initialize steps
        job.add_step("Parsing documents")
        if request.artefacts.epics_and_stories:
            job.add_step("Generating project name")
            job.add_step("Generating EPICs & User Stories")
        if request.artefacts.data_model:
            job.add_step("Generating Data Model")
        if request.artefacts.functional_tests:
            job.add_step("Generating Functional Tests")
        if request.artefacts.gherkin_tests:
            job.add_step("Generating Gherkin Tests")
        if request.artefacts.code_skeleton:
            job.add_step("Generating Code Skeleton")

        # Determine file extension
        file_extension = '.docx' if file.filename.endswith('.docx') else '.txt'

        # Start generation pipeline in background (with file saving)
        background_tasks.add_task(run_generation_pipeline, job_id, content, file_extension)

        return GenerateResponse(job_id=job_id)

    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid payload format")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/status/{job_id}", response_model=StatusResponse)
async def get_status(job_id: str):
    """Get generation status and results"""
    job = job_manager.get_job(job_id)

    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    return StatusResponse(
        status=job.status,
        error=job.error,
        steps=job.steps,
        results=job.results,
        artefacts=job.artefacts
    )


@router.get("/download/{job_id}")
async def download_results(job_id: str):
    """Download all generated artifacts as ZIP"""
    job = job_manager.get_job(job_id)

    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    if job.status != JobStatus.COMPLETED:
        raise HTTPException(status_code=400, detail="Generation not completed yet")

    job_dir = GENERATED_DIR / job_id

    # Create ZIP file
    zip_path = job_dir / "output.zip"

    try:
        # Create a temporary directory for organizing files
        with tempfile.TemporaryDirectory() as temp_dir:
            temp_path = Path(temp_dir)

            # Write EPICs and stories
            if job.results.epics or job.results.user_stories:
                with open(temp_path / "epics_and_stories.json", 'w') as f:
                    json.dump({
                        "epics": [epic.dict() for epic in job.results.epics],
                        "user_stories": [story.dict() for story in job.results.user_stories]
                    }, f, indent=2)

            # Write functional tests
            if job.results.functional_tests:
                with open(temp_path / "functional_tests.json", 'w') as f:
                    json.dump([test.dict() for test in job.results.functional_tests], f, indent=2)

            # Write Gherkin tests
            if job.results.gherkin_tests:
                gherkin_content = ""
                current_feature = None

                for scenario in job.results.gherkin_tests:
                    if current_feature != scenario.feature_name:
                        current_feature = scenario.feature_name
                        gherkin_content += f"\nFeature: {scenario.feature_name}\n\n"

                    gherkin_content += f"  Scenario: {scenario.scenario_name}\n"
                    for given in scenario.given:
                        gherkin_content += f"    Given {given}\n"
                    for when in scenario.when:
                        gherkin_content += f"    When {when}\n"
                    for then in scenario.then:
                        gherkin_content += f"    Then {then}\n"
                    gherkin_content += "\n"

                with open(temp_path / "gherkin_tests.feature", 'w') as f:
                    f.write(gherkin_content)

            # Write entities
            if job.results.entities:
                with open(temp_path / "entities.json", 'w') as f:
                    json.dump([entity.dict() for entity in job.results.entities], f, indent=2)

            # Write Mermaid diagram
            if job.results.mermaid:
                with open(temp_path / "diagram.mmd", 'w') as f:
                    f.write(job.results.mermaid)

            # Write code skeleton
            if job.results.code_skeleton:
                skeleton_dir = temp_path / "code_skeleton"
                skeleton_dir.mkdir(exist_ok=True)

                for folder in job.results.code_skeleton.folders:
                    folder_path = skeleton_dir / folder.path
                    folder_path.mkdir(parents=True, exist_ok=True)

                    for file in folder.files:
                        file_path = folder_path / file.name
                        with open(file_path, 'w') as f:
                            f.write(file.content)

            # Create ZIP
            shutil.make_archive(str(zip_path.with_suffix('')), 'zip', temp_dir)

        return FileResponse(
            path=str(zip_path),
            filename=f"{job.results.project_name or 'project'}_generated.zip",
            media_type="application/zip"
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error creating ZIP: {str(e)}")


@router.post("/stories/{story_id}/more-tests")
async def generate_more_tests(
    story_id: str,
    job_id: str = Form(...),
    instructions: str = Form(default="")
):
    """Generate additional functional tests for a specific story using its source chunks"""
    try:
        # Get job
        job = job_manager.get_job(job_id)
        if not job:
            raise HTTPException(status_code=404, detail="Job not found")

        # Find story
        story = None
        for s in job.results.user_stories:
            if s.id == story_id:
                story = s
                break

        if not story:
            raise HTTPException(status_code=404, detail="Story not found")

        # Collect source chunks from story and acceptance criteria
        chunk_ids = set()
        if story.source_chunks:
            chunk_ids.update(story.source_chunks)
        for ac in story.acceptance_criteria:
            if ac.source_chunks:
                chunk_ids.update(ac.source_chunks)

        if not chunk_ids:
            raise HTTPException(status_code=400, detail="Story has no source chunks to generate from")

        # Retrieve chunk data from BRD
        brd_chunks = []
        if job.brd_data:
            all_chunks = job.brd_data.get('chunks', [])
            brd_chunks = [c for c in all_chunks if c['id'] in chunk_ids]

        if not brd_chunks:
            raise HTTPException(status_code=400, detail="No BRD chunks found for this story")

        # Get existing tests for this story to avoid duplication
        existing_tests = [t for t in job.results.functional_tests if t.story_id == story_id]

        # Build focused prompt
        llm_client = BedrockLLMClient()
        result = llm_client.generate_functional_tests(
            [story],
            f"Generate 2-5 ADDITIONAL test cases (different from existing tests). {instructions}",
            brd_chunks
        )

        # Parse and append new tests
        new_tests = []
        for test_data in result.get('functional_tests', []):
            test = FunctionalTest(**test_data)
            job.results.functional_tests.append(test)
            new_tests.append(test)

        # Rate limiting delay
        await asyncio.sleep(3)

        return {
            "story_id": story_id,
            "new_tests_count": len(new_tests),
            "new_tests": [test.dict() for test in new_tests]
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error generating tests: {str(e)}")
