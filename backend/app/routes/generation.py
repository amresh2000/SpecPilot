import os
import json
import shutil
import tempfile
import asyncio
from datetime import datetime
from pathlib import Path
from fastapi import APIRouter, UploadFile, File, Form, HTTPException, BackgroundTasks
from fastapi.responses import FileResponse
from app.models import GenerateRequest, GenerateResponse, StatusResponse, ArtefactsConfig, StepStatus, JobStatus, FunctionalTest, ValidationReport, GapFix, CTQScore
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
        validation_result = llm_client.validate_brd_quality(brd_data)

        # Store validation report
        validation_report = ValidationReport(**validation_result)
        job.results.validation_report = validation_report

        # Generate gap fixes
        gap_fixes_data = llm_client.generate_gap_fixes(brd_data, validation_result)

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
            "gap_fixes": [gf.dict() for gf in job.results.gap_fixes]
        }

    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid payload format")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/update-gap-fix/{job_id}")
async def update_gap_fix(
    job_id: str,
    gap_id: str = Form(...),
    action: str = Form(...),
    final_text: str = Form(None)
):
    """User accepts/edits/rejects a gap fix"""
    try:
        job = job_manager.get_job(job_id)
        if not job:
            raise HTTPException(status_code=404, detail="Job not found")

        # Find and update the gap fix
        gap_fix = None
        for gf in job.results.gap_fixes:
            if gf.gap_id == gap_id:
                gap_fix = gf
                break

        if not gap_fix:
            raise HTTPException(status_code=404, detail="Gap fix not found")

        # Update gap fix
        gap_fix.user_action = action
        if final_text:
            gap_fix.final_text = final_text

        return {
            "gap_id": gap_id,
            "action": action,
            "updated": True
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/proceed-to-generation/{job_id}")
async def proceed_to_generation(
    job_id: str,
    background_tasks: BackgroundTasks
):
    """After validation review, start the actual generation pipeline"""
    try:
        job = job_manager.get_job(job_id)
        if not job:
            raise HTTPException(status_code=404, detail="Job not found")

        if not job.brd_data:
            raise HTTPException(status_code=400, detail="BRD not parsed yet")

        # Initialize generation steps
        if job.artefacts.epics_and_stories:
            job.add_step("Generating project name")
            job.add_step("Generating EPICs & User Stories")
        if job.artefacts.data_model:
            job.add_step("Generating Data Model")
        if job.artefacts.functional_tests:
            job.add_step("Generating Functional Tests")
        if job.artefacts.gherkin_tests:
            job.add_step("Generating Gherkin Tests")
        if job.artefacts.code_skeleton:
            job.add_step("Generating Code Skeleton")

        # Find the uploaded file
        job_dir = GENERATED_DIR / job_id
        uploaded_files = list(job_dir.glob("brd.*"))
        if not uploaded_files:
            raise HTTPException(status_code=400, detail="BRD file not found")

        uploaded_file_path = str(uploaded_files[0])

        # Run generation pipeline in background (BRD already parsed and saved)
        async def run_generation():
            try:
                pipeline = GenerationPipeline(job_id, uploaded_file_path)
                await pipeline.run()
            except Exception as e:
                job.mark_failed(str(e))

        background_tasks.add_task(run_generation)

        return {
            "job_id": job_id,
            "status": "generation_started"
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/update-epic/{job_id}/{epic_id}")
async def update_epic(
    job_id: str,
    epic_id: str,
    name: str = Form(...),
    description: str = Form(...)
):
    """Update an epic's name and description"""
    try:
        job = job_manager.get_job(job_id)
        if not job:
            raise HTTPException(status_code=404, detail="Job not found")

        # Find and update epic
        epic_found = False
        for epic in job.results.epics:
            if epic.id == epic_id:
                epic.name = name
                epic.description = description
                epic.edited_at = datetime.now()
                epic_found = True
                break

        if not epic_found:
            raise HTTPException(status_code=404, detail="Epic not found")

        return {
            "success": True,
            "epic_id": epic_id,
            "updated": {
                "name": name,
                "description": description
            }
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/update-story/{job_id}/{story_id}")
async def update_story(
    job_id: str,
    story_id: str,
    title: str = Form(...),
    role: str = Form(...),
    goal: str = Form(...),
    benefit: str = Form(...)
):
    """Update a user story's core fields"""
    try:
        job = job_manager.get_job(job_id)
        if not job:
            raise HTTPException(status_code=404, detail="Job not found")

        # Find and update story
        story_found = False
        for story in job.results.user_stories:
            if story.id == story_id:
                story.title = title
                story.role = role
                story.goal = goal
                story.benefit = benefit
                story.edited_at = datetime.now()
                story.regeneration_needed = True
                story_found = True
                break

        if not story_found:
            raise HTTPException(status_code=404, detail="Story not found")

        return {
            "success": True,
            "story_id": story_id,
            "updated": {
                "title": title,
                "role": role,
                "goal": goal,
                "benefit": benefit
            }
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/update-acceptance-criteria/{job_id}/{story_id}")
async def update_acceptance_criteria(
    job_id: str,
    story_id: str,
    criteria: str = Form(...)  # JSON string array
):
    """Update acceptance criteria for a story"""
    try:
        job = job_manager.get_job(job_id)
        if not job:
            raise HTTPException(status_code=404, detail="Job not found")

        # Parse criteria JSON
        criteria_list = json.loads(criteria)

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
                    for idx, text in enumerate(criteria_list)
                ]
                story.edited_at = datetime.now()
                story.regeneration_needed = True
                story_found = True
                break

        if not story_found:
            raise HTTPException(status_code=404, detail="Story not found")

        return {
            "success": True,
            "story_id": story_id,
            "criteria_count": len(criteria_list)
        }

    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid criteria JSON")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/regenerate-story-tests/{job_id}/{story_id}")
async def regenerate_story_tests(
    job_id: str,
    story_id: str,
    background_tasks: BackgroundTasks
):
    """Regenerate functional and Gherkin tests for a specific user story"""
    try:
        job = job_manager.get_job(job_id)
        if not job:
            raise HTTPException(status_code=404, detail="Job not found")

        # Find the story
        story = None
        for s in job.results.user_stories:
            if s.id == story_id:
                story = s
                break

        if not story:
            raise HTTPException(status_code=404, detail="Story not found")

        # Background task to regenerate tests
        async def _regenerate_tests():
            try:
                from app.services.llm_client import BedrockLLMClient
                from app.models import FunctionalTest, GherkinScenario

                llm_client = BedrockLLMClient()

                # Collect chunk IDs from the story
                chunk_ids = set()
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

                # Get applied gap fixes
                gap_fixes = []
                if job.results.gap_fixes:
                    for gf in job.results.gap_fixes:
                        if gf.user_action == "accept":
                            gap_fixes.append({
                                "type": gf.gap_type,
                                "issue": gf.issue,
                                "correction": gf.suggestion
                            })
                        elif gf.user_action == "edit" and gf.final_text:
                            gap_fixes.append({
                                "type": gf.gap_type,
                                "issue": gf.issue,
                                "correction": gf.final_text
                            })

                # Regenerate functional tests for this story
                functional_result = llm_client.generate_functional_tests(
                    [story],
                    job.instructions,
                    brd_chunks if brd_chunks else None,
                    gap_fixes
                )

                # Remove old tests for this story
                job.results.functional_tests = [
                    t for t in job.results.functional_tests
                    if t.story_id != story_id
                ]

                # Add new tests with regeneration timestamp
                for test_data in functional_result.get('functional_tests', []):
                    test = FunctionalTest(**test_data)
                    test.regenerated_at = datetime.now()
                    job.results.functional_tests.append(test)

                # Regenerate Gherkin tests for this story
                gherkin_result = llm_client.generate_gherkin_tests([story], gap_fixes)

                # Remove old Gherkin tests for this story
                job.results.gherkin_tests = [
                    t for t in job.results.gherkin_tests
                    if t.story_id != story_id
                ]

                # Add new Gherkin tests with regeneration timestamp
                for scenario_data in gherkin_result.get('gherkin_tests', []):
                    scenario = GherkinScenario(**scenario_data)
                    scenario.regenerated_at = datetime.now()
                    job.results.gherkin_tests.append(scenario)

                # Clear regeneration flag
                story.regeneration_needed = False

            except Exception as e:
                print(f"Error regenerating tests for story {story_id}: {str(e)}")

        # Add to background tasks
        background_tasks.add_task(_regenerate_tests)

        return {
            "success": True,
            "story_id": story_id,
            "message": "Test regeneration started in background"
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/regenerate-story-entities/{job_id}/{story_id}")
async def regenerate_story_entities(
    job_id: str,
    story_id: str,
    background_tasks: BackgroundTasks
):
    """Regenerate entities (data model) for affected stories"""
    try:
        job = job_manager.get_job(job_id)
        if not job:
            raise HTTPException(status_code=404, detail="Job not found")

        # Find the story
        story = None
        for s in job.results.user_stories:
            if s.id == story_id:
                story = s
                break

        if not story:
            raise HTTPException(status_code=404, detail="Story not found")

        # Background task to regenerate entities
        async def _regenerate_entities():
            try:
                from app.services.llm_client import BedrockLLMClient
                from app.models import Entity, EntityField

                llm_client = BedrockLLMClient()

                # Get applied gap fixes
                gap_fixes = []
                if job.results.gap_fixes:
                    for gf in job.results.gap_fixes:
                        if gf.user_action == "accept":
                            gap_fixes.append({
                                "type": gf.gap_type,
                                "issue": gf.issue,
                                "correction": gf.suggestion
                            })
                        elif gf.user_action == "edit" and gf.final_text:
                            gap_fixes.append({
                                "type": gf.gap_type,
                                "issue": gf.issue,
                                "correction": gf.final_text
                            })

                # Get all stories that need entity regeneration
                stories_for_regen = [s for s in job.results.user_stories if s.regeneration_needed or s.id == story_id]

                # Regenerate data model
                result = llm_client.generate_data_model(
                    job.brd_data,
                    stories_for_regen,
                    gap_fixes
                )

                # Remove old entities that were derived from affected stories
                affected_story_ids = [s.id for s in stories_for_regen]
                job.results.entities = [
                    e for e in job.results.entities
                    if not (e.source_story_ids and any(sid in affected_story_ids for sid in e.source_story_ids))
                ]

                # Add new entities with regeneration timestamp
                for entity_data in result.get('entities', []):
                    fields = []
                    for field_data in entity_data.get('fields', []):
                        field = EntityField(**field_data)
                        fields.append(field)

                    entity_data['fields'] = fields
                    entity = Entity(**entity_data)
                    entity.regenerated_at = datetime.now()
                    entity.source_story_ids = affected_story_ids
                    job.results.entities.append(entity)

                # Update Mermaid diagram
                job.results.mermaid = result.get('mermaid', '')

            except Exception as e:
                print(f"Error regenerating entities for story {story_id}: {str(e)}")

        # Add to background tasks
        background_tasks.add_task(_regenerate_entities)

        return {
            "success": True,
            "story_id": story_id,
            "message": "Entity regeneration started in background"
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/cascade-analysis/{job_id}/{story_id}")
async def analyze_cascade_impact(
    job_id: str,
    story_id: str
):
    """Analyze the impact of regenerating artifacts for a story"""
    try:
        job = job_manager.get_job(job_id)
        if not job:
            raise HTTPException(status_code=404, detail="Job not found")

        # Find the story
        story = None
        for s in job.results.user_stories:
            if s.id == story_id:
                story = s
                break

        if not story:
            raise HTTPException(status_code=404, detail="Story not found")

        from app.models import DependencyImpact

        # Count affected artifacts
        affected_functional_tests = len([
            t for t in job.results.functional_tests
            if t.story_id == story_id
        ])

        affected_gherkin_tests = len([
            t for t in job.results.gherkin_tests
            if t.story_id == story_id
        ])

        total_affected_tests = affected_functional_tests + affected_gherkin_tests

        # Count affected entities (entities that mention this story)
        affected_entities = len([
            e for e in job.results.entities
            if e.source_story_ids and story_id in e.source_story_ids
        ])

        # Estimate time (rough heuristic: 10 seconds per test, 15 seconds per entity)
        estimated_time = (total_affected_tests * 10) + (affected_entities * 15)

        # Determine risk level
        risk_level = "low"
        if total_affected_tests > 5 or affected_entities > 3:
            risk_level = "medium"
        if total_affected_tests > 10 or affected_entities > 5:
            risk_level = "high"

        impact = DependencyImpact(
            affected_tests=total_affected_tests,
            affected_entities=affected_entities,
            affected_code=0,  # Future: analyze code skeleton impact
            estimated_time_seconds=estimated_time,
            risk_level=risk_level
        )

        return {
            "success": True,
            "story_id": story_id,
            "story_title": story.title,
            "impact": impact.dict(),
            "details": {
                "functional_tests": affected_functional_tests,
                "gherkin_tests": affected_gherkin_tests,
                "entities": affected_entities
            }
        }

    except HTTPException:
        raise
    except Exception as e:
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


@router.delete("/delete-test/{job_id}/{test_id}")
async def delete_test(
    job_id: str,
    test_id: str,
    test_type: str = Form(...)  # "functional" or "gherkin"
):
    """Delete a functional or Gherkin test"""
    try:
        job = job_manager.get_job(job_id)
        if not job:
            raise HTTPException(status_code=404, detail="Job not found")

        test_found = False

        if test_type == "functional":
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

        elif test_type == "gherkin":
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
            raise HTTPException(status_code=404, detail=f"{test_type.capitalize()} test not found")

        return {
            "success": True,
            "test_id": test_id,
            "test_type": test_type,
            "message": f"{test_type.capitalize()} test deleted successfully"
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
