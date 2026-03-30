import os
import json
import shutil
import tempfile
import asyncio
from datetime import datetime
from pathlib import Path
from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from fastapi.responses import FileResponse
from app.models import (
    GenerateRequest, StatusResponse, ArtefactsConfig, StepStatus, JobStatus,
    FunctionalTest, ValidationReport, GapFix, CTQScore, PipelineStage,
    UpdateEpicRequest, UpdateStoryRequest, UpdateAcceptanceCriteriaRequest,
    UpdateFunctionalTestRequest, UpdateGherkinTestRequest, UpdateGapFixRequest, DeleteTestRequest
)
from app.services.job_manager import job_manager
from app.services.brd_parser import BRDParser
from app.services.llm_client import BedrockLLMClient
from app.utils import log_info, log_error, log_warning

router = APIRouter()

# Ensure generated directory exists
GENERATED_DIR = Path("generated")
GENERATED_DIR.mkdir(exist_ok=True)


@router.get("/status/{job_id}", response_model=StatusResponse)
async def get_status(job_id: str):
    """Get generation status and results"""
    job = job_manager.get_job(job_id)

    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    return StatusResponse(
        status=job.status,
        current_stage=job.current_stage,
        stage_history=job.stage_history,
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
                        "epics": [epic.model_dump() for epic in job.results.epics],
                        "user_stories": [story.model_dump() for story in job.results.user_stories]
                    }, f, indent=2)

            # Write functional tests
            if job.results.functional_tests:
                with open(temp_path / "functional_tests.json", 'w') as f:
                    json.dump([test.model_dump() for test in job.results.functional_tests], f, indent=2)

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
                    json.dump([entity.model_dump() for entity in job.results.entities], f, indent=2)

            # Write Mermaid diagram
            if job.results.mermaid:
                with open(temp_path / "diagram.mmd", 'w') as f:
                    f.write(job.results.mermaid)

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
            "new_tests": [test.model_dump() for test in new_tests]
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error generating tests: {str(e)}")


@router.post("/validate-brd")
async def validate_brd(
    file: UploadFile = File(...),
    payload: str = Form(...)
):
    """Step 1: Upload BRD and run validation ONLY (no generation yet)"""
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
        job.uploaded_filename = file.filename

        # Initialize staged pipeline at VALIDATION stage
        job.advance_stage(PipelineStage.VALIDATION)

        # Save file
        job_dir = GENERATED_DIR / job_id
        job_dir.mkdir(exist_ok=True)
        file_extension = '.docx' if file.filename.endswith('.docx') else '.txt'
        uploaded_file_path = job_dir / f"brd{file_extension}"

        with open(uploaded_file_path, 'wb') as f:
            f.write(content)

        # Parse BRD
        parser = BRDParser()
        brd_data = parser.parse(str(uploaded_file_path))
        job.brd_data = brd_data

        # Run validation
        llm_client = BedrockLLMClient()
        validation_result = llm_client.validate_brd_quality(brd_data, job_id=job_id)

        # Store validation report
        validation_report = ValidationReport(**validation_result)
        job.results.validation_report = validation_report

        # Generate gap fixes
        gap_fixes_data = llm_client.generate_gap_fixes(brd_data, validation_result, job_id=job_id)

        # Store gap fixes with unique IDs
        for idx, fix_data in enumerate(gap_fixes_data):
            fix_data['gap_id'] = f"gap_{idx + 1}"
            fix_data['user_action'] = "pending"
            gap_fix = GapFix(**fix_data)
            job.results.gap_fixes.append(gap_fix)

        # Save validation report to file
        validation_file = job_dir / "validation_report.json"
        with open(validation_file, 'w') as f:
            json.dump({
                "validation_report": validation_result,
                "gap_fixes": gap_fixes_data
            }, f, indent=2)

        return {
            "job_id": job_id,
            "validation_report": validation_result,
            "gap_fixes": [gf.model_dump() for gf in job.results.gap_fixes]
        }

    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid payload format")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/update-gap-fix/{job_id}")
async def update_gap_fix(job_id: str, request: UpdateGapFixRequest):
    """User accepts/edits/rejects a gap fix"""
    try:
        log_info("Updating gap fix", job_id=job_id, gap_id=request.gap_id, action=request.action)

        job = job_manager.get_job(job_id)
        if not job:
            log_warning("Job not found", job_id=job_id)
            raise HTTPException(status_code=404, detail="Job not found")

        # Find and update the gap fix
        gap_fix = None
        for gf in job.results.gap_fixes:
            if gf.gap_id == request.gap_id:
                gap_fix = gf
                break

        if not gap_fix:
            log_warning("Gap fix not found", job_id=job_id, gap_id=request.gap_id)
            raise HTTPException(status_code=404, detail="Gap fix not found")

        # Update gap fix
        gap_fix.user_action = request.action
        if request.final_text:
            gap_fix.final_text = request.final_text

        log_info("Gap fix updated", job_id=job_id, gap_id=request.gap_id)

        return {
            "gap_id": request.gap_id,
            "action": request.action,
            "updated": True
        }

    except HTTPException:
        raise
    except Exception as e:
        log_error("Error updating gap fix", error=e, job_id=job_id)
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/update-epic/{job_id}/{epic_id}")
async def update_epic(job_id: str, epic_id: str, request: UpdateEpicRequest):
    """Update an epic's name and description"""
    try:
        job = job_manager.get_job(job_id)
        if not job:
            raise HTTPException(status_code=404, detail="Job not found")

        # Find and update epic
        epic_found = False
        for epic in job.results.epics:
            if epic.id == epic_id:
                epic.name = request.name
                epic.description = request.description
                epic.edited_at = datetime.now()
                epic_found = True
                break

        if not epic_found:
            raise HTTPException(status_code=404, detail="Epic not found")

        log_info("Epic updated", job_id=job_id, epic_id=epic_id)

        return {
            "success": True,
            "epic_id": epic_id,
            "updated": {
                "name": request.name,
                "description": request.description
            }
        }

    except HTTPException:
        raise
    except Exception as e:
        log_error("Error updating epic", error=e, job_id=job_id, epic_id=epic_id)
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/update-story/{job_id}/{story_id}")
async def update_story(job_id: str, story_id: str, request: UpdateStoryRequest):
    """Update a user story's core fields"""
    try:
        job = job_manager.get_job(job_id)
        if not job:
            raise HTTPException(status_code=404, detail="Job not found")

        # Find and update story
        story_found = False
        for story in job.results.user_stories:
            if story.id == story_id:
                story.title = request.title
                story.role = request.role
                story.goal = request.goal
                story.benefit = request.benefit
                story.edited_at = datetime.now()
                story.regeneration_needed = True
                story_found = True
                break

        if not story_found:
            raise HTTPException(status_code=404, detail="Story not found")

        log_info("Story updated", job_id=job_id, story_id=story_id)

        return {
            "success": True,
            "story_id": story_id,
            "updated": {
                "title": request.title,
                "role": request.role,
                "goal": request.goal,
                "benefit": request.benefit
            }
        }

    except HTTPException:
        raise
    except Exception as e:
        log_error("Error updating story", error=e, job_id=job_id, story_id=story_id)
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/update-acceptance-criteria/{job_id}/{story_id}")
async def update_acceptance_criteria(job_id: str, story_id: str, request: UpdateAcceptanceCriteriaRequest):
    """Update acceptance criteria for a story"""
    try:
        job = job_manager.get_job(job_id)
        if not job:
            raise HTTPException(status_code=404, detail="Job not found")

        # Find and update story
        story_found = False
        for story in job.results.user_stories:
            if story.id == story_id:
                # Replace acceptance criteria
                from app.models import AcceptanceCriterion
                story.acceptance_criteria = [
                    AcceptanceCriterion(
                        id=f"ac_{idx + 1}",
                        text=text,
                        source_chunks=[]
                    )
                    for idx, text in enumerate(request.criteria)
                ]
                story.edited_at = datetime.now()
                story.regeneration_needed = True
                story_found = True
                break

        if not story_found:
            raise HTTPException(status_code=404, detail="Story not found")

        log_info("Acceptance criteria updated", job_id=job_id, story_id=story_id, count=len(request.criteria))

        return {
            "success": True,
            "story_id": story_id,
            "criteria_count": len(request.criteria)
        }

    except HTTPException:
        raise
    except Exception as e:
        log_error("Error updating acceptance criteria", error=e, job_id=job_id, story_id=story_id)
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/delete-epic/{job_id}/{epic_id}")
async def delete_epic(
    job_id: str,
    epic_id: str
):
    """Delete an epic and all its associated stories"""
    try:
        job = job_manager.get_job(job_id)
        if not job:
            raise HTTPException(status_code=404, detail="Job not found")

        # Find epic
        epic_found = False
        for epic in job.results.epics:
            if epic.id == epic_id:
                epic_found = True
                break

        if not epic_found:
            raise HTTPException(status_code=404, detail="Epic not found")

        # Delete the epic
        job.results.epics = [e for e in job.results.epics if e.id != epic_id]

        # Delete all stories associated with this epic
        deleted_story_ids = [s.id for s in job.results.user_stories if s.epic_id == epic_id]
        job.results.user_stories = [s for s in job.results.user_stories if s.epic_id != epic_id]

        # Delete all tests associated with deleted stories
        job.results.functional_tests = [
            t for t in job.results.functional_tests
            if t.story_id not in deleted_story_ids
        ]
        job.results.gherkin_tests = [
            t for t in job.results.gherkin_tests
            if t.story_id not in deleted_story_ids
        ]

        return {
            "success": True,
            "epic_id": epic_id,
            "deleted_stories_count": len(deleted_story_ids),
            "message": f"Epic and {len(deleted_story_ids)} associated stories deleted"
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/delete-story/{job_id}/{story_id}")
async def delete_story(
    job_id: str,
    story_id: str
):
    """Delete a user story and all its associated tests"""
    try:
        job = job_manager.get_job(job_id)
        if not job:
            raise HTTPException(status_code=404, detail="Job not found")

        # Find story
        story_found = False
        for story in job.results.user_stories:
            if story.id == story_id:
                story_found = True
                break

        if not story_found:
            raise HTTPException(status_code=404, detail="Story not found")

        # Delete the story
        job.results.user_stories = [s for s in job.results.user_stories if s.id != story_id]

        # Delete associated tests
        functional_tests_deleted = len([t for t in job.results.functional_tests if t.story_id == story_id])
        gherkin_tests_deleted = len([t for t in job.results.gherkin_tests if t.story_id == story_id])

        job.results.functional_tests = [
            t for t in job.results.functional_tests
            if t.story_id != story_id
        ]
        job.results.gherkin_tests = [
            t for t in job.results.gherkin_tests
            if t.story_id != story_id
        ]

        return {
            "success": True,
            "story_id": story_id,
            "deleted_functional_tests": functional_tests_deleted,
            "deleted_gherkin_tests": gherkin_tests_deleted,
            "message": f"Story deleted with {functional_tests_deleted} functional and {gherkin_tests_deleted} Gherkin tests"
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/update-functional-test/{job_id}/{test_id}")
async def update_functional_test(job_id: str, test_id: str, request: UpdateFunctionalTestRequest):
    """Update a functional test"""
    try:
        job = job_manager.get_job(job_id)
        if not job:
            raise HTTPException(status_code=404, detail="Job not found")

        # Find and update functional test
        test_found = False
        for test in job.results.functional_tests:
            if test.id == test_id:
                test.title = request.title
                test.objective = request.objective
                test.preconditions = request.preconditions
                test.test_steps = request.test_steps
                test.expected_results = request.expected_results
                test_found = True
                break

        if not test_found:
            raise HTTPException(status_code=404, detail="Functional test not found")

        log_info("Functional test updated", job_id=job_id, test_id=test_id)

        return {
            "success": True,
            "message": "Functional test updated successfully"
        }

    except HTTPException:
        raise
    except Exception as e:
        log_error("Error updating functional test", error=e, job_id=job_id, test_id=test_id)
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/update-gherkin-test/{job_id}/{test_id}")
async def update_gherkin_test(job_id: str, test_id: str, request: UpdateGherkinTestRequest):
    """Update a Gherkin test"""
    try:
        job = job_manager.get_job(job_id)
        if not job:
            raise HTTPException(status_code=404, detail="Job not found")

        # Find and update gherkin test
        test_found = False
        for test in job.results.gherkin_tests:
            if test.id == test_id:
                test.feature_name = request.feature_name
                test.scenario_name = request.scenario_name
                test.given = request.given
                test.when = request.when
                test.then = request.then
                test_found = True
                break

        if not test_found:
            raise HTTPException(status_code=404, detail="Gherkin test not found")

        log_info("Gherkin test updated", job_id=job_id, test_id=test_id)

        return {
            "success": True,
            "message": "Gherkin test updated successfully"
        }

    except HTTPException:
        raise
    except Exception as e:
        log_error("Error updating Gherkin test", error=e, job_id=job_id, test_id=test_id)
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/delete-test/{job_id}/{test_id}")
async def delete_test(job_id: str, test_id: str, request: DeleteTestRequest):
    """Delete a functional or Gherkin test"""
    try:
        job = job_manager.get_job(job_id)
        if not job:
            raise HTTPException(status_code=404, detail="Job not found")

        test_found = False

        if request.test_type == "functional":
            # Find and delete functional test
            for test in job.results.functional_tests:
                if test.id == test_id:
                    test_found = True
                    break

            if test_found:
                job.results.functional_tests = [
                    t for t in job.results.functional_tests
                    if t.id != test_id
                ]

        elif request.test_type == "gherkin":
            # Find and delete gherkin test
            for test in job.results.gherkin_tests:
                if test.id == test_id:
                    test_found = True
                    break

            if test_found:
                job.results.gherkin_tests = [
                    t for t in job.results.gherkin_tests
                    if t.id != test_id
                ]

        else:
            raise HTTPException(status_code=400, detail="Invalid test_type. Must be 'functional' or 'gherkin'")

        if not test_found:
            raise HTTPException(status_code=404, detail=f"{request.test_type.capitalize()} test not found")

        log_info("Test deleted", job_id=job_id, test_id=test_id, test_type=request.test_type)

        return {
            "success": True,
            "test_id": test_id,
            "test_type": request.test_type,
            "message": f"{request.test_type.capitalize()} test deleted successfully"
        }

    except HTTPException:
        raise
    except Exception as e:
        log_error("Error deleting test", error=e, job_id=job_id, test_id=test_id)
        raise HTTPException(status_code=500, detail=str(e))
