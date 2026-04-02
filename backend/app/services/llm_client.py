import json
import time
import os
import re
import boto3
from botocore.config import Config
from botocore.exceptions import ClientError
from typing import Dict, Any, List, Optional
from pathlib import Path
from datetime import datetime
from app.models import (
    Epic, UserStory, AcceptanceCriterion, FunctionalTest,
    GherkinScenario, Entity, EntityField
)
from app.config import config as app_config
from app.utils import log_info, log_warning, log_error


class BedrockLLMClient:
    """AWS Bedrock client for Claude 3.5 Sonnet"""

    def __init__(self, region_name: str = None):
        # Use environment variable for region, fallback to parameter or default
        region = region_name or app_config.AWS_REGION

        # Configure boto3 with explicit proxy settings and increased timeout
        boto_config_params = {
            'retries': {
                'max_attempts': 1,  # Disable boto3 automatic retries
                'mode': 'standard'
            },
            'read_timeout': 300  # Increase from default 60s to 300s (5 minutes) for large code generation
        }

        # Add explicit proxy configuration if configured
        if app_config.HTTP_PROXY:
            boto_config_params['proxies'] = {
                'http': app_config.HTTP_PROXY,
                'https': app_config.HTTPS_PROXY or app_config.HTTP_PROXY
            }
            log_info(f"Boto3 using explicit proxy: {app_config.HTTP_PROXY}")

        boto_config = Config(**boto_config_params)

        # Create boto3 client with credentials from environment
        self.client = boto3.client(
            'bedrock-runtime',
            region_name=region,
            aws_access_key_id=app_config.AWS_ACCESS_KEY_ID,
            aws_secret_access_key=app_config.AWS_SECRET_ACCESS_KEY,
            config=boto_config
        )
        # Use model ID from configuration
        self.model_id = app_config.AWS_BEDROCK_MODEL_ID
        log_info(f"Using Bedrock model: {self.model_id}")
        self.max_retries = 5  # Increased from 1 to 5
        self.base_delay = 2  # Base delay in seconds for exponential backoff

    def _log_llm_error(
        self,
        job_id: str,
        stage: str,
        error_type: str,
        prompt: str,
        system_prompt: str,
        raw_response: str,
        error_message: str,
        extraction_details: Optional[Dict[str, Any]] = None
    ):
        """Log LLM response errors to file for debugging"""
        if not app_config.LOG_LLM_RESPONSES:
            return

        try:
            # Create log directory structure
            log_dir = Path(app_config.LLM_LOG_DIR) / job_id
            log_dir.mkdir(parents=True, exist_ok=True)

            # Create log filename with timestamp
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            log_filename = f"{stage.lower()}_error_{timestamp}.json"
            log_path = log_dir / log_filename

            # Prepare log entry
            log_entry = {
                "timestamp": datetime.now().isoformat(),
                "job_id": job_id,
                "stage": stage,
                "model_id": self.model_id,
                "error_type": error_type,
                "extraction_details": extraction_details or {},
                "prompt_preview": prompt[:1000] + ("..." if len(prompt) > 1000 else ""),
                "system_prompt": system_prompt,
                "raw_response": raw_response,
                "error_message": error_message
            }

            # Write log file
            with open(log_path, 'w', encoding='utf-8') as f:
                json.dump(log_entry, f, indent=2, ensure_ascii=False)

            log_info(f"LLM error logged to: {log_path}")

        except Exception as e:
            # Don't fail the main operation if logging fails
            log_warning(f"Failed to log LLM error: {str(e)}")

    def _invoke_claude(self, prompt: str, system_prompt: str = "", job_id: str = None, stage: str = None) -> Dict[str, Any]:
        """Invoke Claude with exponential backoff retry logic for throttling"""
        last_error = None

        for attempt in range(self.max_retries + 1):
            try:
                # Prepare request
                messages = [{"role": "user", "content": prompt}]

                request_body = {
                    "anthropic_version": "bedrock-2023-05-31",
                    "max_tokens": 64000,  # Claude Sonnet 4.5 supports up to 64K output tokens
                    "messages": messages,
                    "temperature": 0.3,  # Lower temperature = more deterministic JSON, fewer empty arrays
                }

                if system_prompt:
                    request_body["system"] = system_prompt

                # Invoke model
                response = self.client.invoke_model(
                    modelId=self.model_id,
                    body=json.dumps(request_body)
                )

                # Parse response
                response_body = json.loads(response['body'].read())
                content = response_body['content'][0]['text'].strip()

                # Try to parse JSON directly first
                try:
                    return json.loads(content)
                except json.JSONDecodeError:
                    # Try extracting from markdown code block
                    # Use greedy .* so nested ``` inside field values don't truncate the match
                    match = re.search(r'```(?:json)?\s*\n?(.*)\n?```', content, re.DOTALL)
                    if match:
                        error_msg = "WARNING: Claude returned markdown-wrapped JSON, extracting from code block..."
                        log_warning(error_msg)

                        # Log the markdown wrapping issue
                        if job_id and stage:
                            self._log_llm_error(
                                job_id=job_id,
                                stage=stage,
                                error_type="markdown_wrapped",
                                prompt=prompt,
                                system_prompt=system_prompt,
                                raw_response=content,
                                error_message=error_msg
                            )

                        return json.loads(match.group(1).strip())

                    # Last resort: extract from first { to last }
                    start = content.find('{')
                    end = content.rfind('}')
                    if start != -1 and end > start:
                        error_msg = f"WARNING: Extracting JSON from mixed content (found {{ at {start}, }} at {end})..."
                        log_warning(error_msg)

                        # Log the mixed content extraction issue
                        if job_id and stage:
                            self._log_llm_error(
                                job_id=job_id,
                                stage=stage,
                                error_type="mixed_content_extraction",
                                prompt=prompt,
                                system_prompt=system_prompt,
                                raw_response=content,
                                error_message=error_msg,
                                extraction_details={
                                    "start_pos": start,
                                    "end_pos": end,
                                    "extraction_method": "rfind"
                                }
                            )

                        return json.loads(content[start:end+1])

                    # If all extraction failed, raise with helpful error
                    error_msg = f"Could not extract JSON. Response preview: {content[:300]}..."

                    # Log the complete failure
                    if job_id and stage:
                        self._log_llm_error(
                            job_id=job_id,
                            stage=stage,
                            error_type="extraction_failed",
                            prompt=prompt,
                            system_prompt=system_prompt,
                            raw_response=content,
                            error_message=error_msg
                        )

                    raise json.JSONDecodeError(error_msg, content, 0)

            except json.JSONDecodeError as e:
                # JSON parsing error - retry with exponential backoff
                if attempt < self.max_retries:
                    delay = self.base_delay * (2 ** attempt)
                    log_warning(f"JSON parse error, retrying in {delay}s (attempt {attempt + 1}/{self.max_retries + 1})...")
                    time.sleep(delay)
                    last_error = e
                    continue
                else:
                    raise ValueError(f"Failed to parse JSON response after {self.max_retries + 1} attempts: {str(e)}")

            except ClientError as e:
                error_code = e.response.get('Error', {}).get('Code', '')

                # Handle throttling with exponential backoff
                if error_code == 'ThrottlingException' and attempt < self.max_retries:
                    # Exponential backoff: 2s, 4s, 8s, 16s, 32s
                    delay = self.base_delay * (2 ** attempt)
                    log_warning(f"Throttled by Bedrock, retrying in {delay}s (attempt {attempt + 1}/{self.max_retries + 1})...")
                    time.sleep(delay)
                    last_error = e
                    continue
                else:
                    # Non-throttling error or max retries exceeded
                    raise RuntimeError(f"Error invoking Bedrock: {str(e)}")

            except Exception as e:
                # Unexpected error
                raise RuntimeError(f"Error invoking Bedrock: {str(e)}")

        # If we exhausted all retries
        if last_error:
            raise RuntimeError(f"Failed after {self.max_retries + 1} attempts. Last error: {str(last_error)}")

    def generate_atomic_requirements(
        self,
        chunks: List[Dict[str, Any]],
        job_id: str = None
    ) -> Dict[str, Any]:
        """Extract semantic types and atomic requirements from parsed BRD chunks.

        One batched call for all chunks. Returns enriched chunk metadata + flat
        list of atomic requirements ready to be stored in GenerationResults.
        """
        chunks_text = "\n\n".join([
            f"## {c['id']} — {c.get('section_title', 'Untitled')}\n"
            f"**type**: {c['type']}\n"
            f"**text**:\n{c['text']}"
            for c in chunks
        ])
        valid_chunk_ids = [c['id'] for c in chunks]

        prompt = f"""Analyze the following BRD chunks and extract structured requirement information.

BRD Chunks:
{chunks_text}

For EACH chunk produce one object in requirement_chunks with:
- chunk_id: exactly as given (e.g. "chunk_1")
- title: a concise human-readable title for this chunk
- semantic_type: one of "functional_flow" | "business_rules" | "nfr" | "constraint" | "mixed" | "informational"
- summary: 1–2 sentence summary of what this chunk covers
- confidence: float 0.0–1.0 reflecting how clearly the chunk expresses requirements
- has_table: true if the chunk type is "table" or its text contains tabular data
- atomic_requirements: list of the smallest testable requirement units found in this chunk

Each atomic requirement must have:
- id: unique string like "req_1", "req_2", ... (globally unique across ALL chunks)
- text: one clear, testable requirement statement starting with "The system shall..." or "The user shall..."
- type: one of "functional" | "business_rule" | "exception" | "validation" | "nfr" | "constraint"
- derived_from_table: true only if this requirement came from interpreting a table row or cell

Rules:
- Every chunk must appear in requirement_chunks, even informational ones (they may have 0 atomic requirements)
- Only use chunk_ids from this exact list: {valid_chunk_ids}
- Do not merge requirements — keep them atomic (one behavior per requirement)
- For table chunks, extract each row as one or more atomic requirements

Output must be valid JSON matching this schema:
{{
  "requirement_chunks": [
    {{
      "chunk_id": "chunk_1",
      "title": "string",
      "semantic_type": "functional_flow",
      "summary": "string",
      "confidence": 0.9,
      "has_table": false,
      "atomic_requirements": [
        {{
          "id": "req_1",
          "text": "The system shall...",
          "type": "functional",
          "derived_from_table": false
        }}
      ]
    }}
  ]
}}
"""

        system_prompt = """You are an expert business analyst specialising in requirements extraction.

CRITICAL JSON FORMAT REQUIREMENTS:
- Your response MUST be ONLY valid JSON
- Start with { character and end with } character
- NO markdown code blocks (no ``` or ```json)
- NO explanatory text before or after the JSON
- NO comments inside the JSON

Begin your response now with { character:"""

        return self._invoke_claude(prompt, system_prompt, job_id=job_id, stage="REQUIREMENT_MAP")

    def generate_epics_and_stories(
        self,
        brd_data: Dict[str, Any],
        instructions: str,
        gap_fixes: List[Dict[str, str]] = None,
        existing_epics: List[Dict[str, str]] = None,
        job_id: str = None
    ) -> Dict[str, Any]:
        """Call A1: BRD → project_name + epics only (user stories generated separately in batches)"""

        gap_fixes_text = self._build_gap_fixes_context(gap_fixes)

        existing_epics_text = ""
        if existing_epics and len(existing_epics) > 0:
            existing_epics_text = "\n\n## EXISTING EPICS (DO NOT DUPLICATE)\n"
            existing_epics_text += "The following epics already exist. Generate NEW epics only, avoiding duplication:\n\n"
            for i, epic in enumerate(existing_epics, 1):
                existing_epics_text += f"{i}. {epic['name']}: {epic['description']}\n"
            existing_epics_text += "\nIMPORTANT: Do not regenerate these epics or create similar ones. Focus on NEW features.\n"

        # Send BRD as chunks only — chunks contain section title, section ID, type, and full text.
        # Tables are captured as type="table" chunks. Sending sections/tables separately triplicates content.
        chunks = brd_data.get('chunks', [])
        chunks_text = "\n\n".join([
            f"## Chunk {c['id']} - {c.get('section_title', 'Section ' + str(c.get('section_id', 'unknown')))}\n"
            f"**Section ID**: {c.get('section_id', 'N/A')}\n"
            f"**Type**: {c['type']}\n"
            f"**Content**:\n{c['text']}"
            for c in chunks
        ])

        prompt = f"""Analyze this Business Requirements Document and generate a project name and EPICs (high-level feature themes).
Do NOT generate user stories — those will be generated separately.

BRD Content (chunked by section):
{chunks_text}
{gap_fixes_text}
{existing_epics_text}
Special Instructions:
{instructions if instructions else 'None'}

Output must be valid JSON matching this schema:
{{
  "project_name": "string",
  "epics": [
    {{
      "id": "epic_1",
      "name": "string",
      "description": "string"
    }}
  ]
}}

EPIC BUDGET RULES (strictly enforced):
- Generate between 5 and 8 EPICs. Absolute maximum is 10.
- Combine related capabilities into a single EPIC rather than splitting them.
- Each EPIC must represent a genuinely distinct high-level theme. Do not create an EPIC for a single minor feature.
- If the BRD is narrow in scope, 5 well-defined EPICs is better than 8 thin ones.
"""

        system_prompt = """You are an expert business analyst.

CRITICAL JSON FORMAT REQUIREMENTS:
- Your response MUST be ONLY valid JSON
- Start with { character and end with } character
- NO markdown code blocks (no ``` or ```json)
- NO explanatory text before or after the JSON
- NO comments inside the JSON

Correct format example:
{"project_name": "Trade Processing System", "epics": [{"id": "epic_1", "name": "Trade Booking", "description": "Covers all trade entry and booking workflows"}]}

INCORRECT format (DO NOT DO THIS):
```json
{"project_name": "System"}
```

Begin your response now with { character:"""

        return self._invoke_claude(prompt, system_prompt, job_id=job_id, stage="EPICS")

    def generate_user_stories_for_epics(
        self,
        epics_batch: List[Dict[str, Any]],
        brd_data: Dict[str, Any],
        instructions: str,
        gap_fixes: List[Dict[str, str]] = None,
        story_id_offset: int = 0,
        atomic_requirements: List = None,
        job_id: str = None
    ) -> Dict[str, Any]:
        """Call A2: BRD + epic batch → User Stories with acceptance criteria.

        Called once per batch of epics to keep output within token budget.
        story_id_offset ensures unique IDs across batches (e.g., offset=20 → story_21, story_22...).
        """

        gap_fixes_text = self._build_gap_fixes_context(gap_fixes)

        atomic_reqs_text = ""
        if atomic_requirements:
            atomic_reqs_text = "\n\n## Atomic Requirements (link each story to the IDs it satisfies)\n"
            for req in atomic_requirements:
                req_id = req.id if hasattr(req, 'id') else req['id']
                req_text = req.text if hasattr(req, 'text') else req['text']
                req_type = req.type if hasattr(req, 'type') else req['type']
                atomic_reqs_text += f"- {req_id} [{req_type}]: {req_text}\n"

        epics_text = "\n\n".join([
            f"Epic {e['id']}: {e['name']}\nDescription: {e['description']}"
            for e in epics_batch
        ])

        # Only send chunks relevant to these epics — use all chunks since we can't filter at this stage
        chunks = brd_data.get('chunks', [])
        chunks_text = "\n\n".join([
            f"## Chunk {c['id']} - {c.get('section_title', 'Section ' + str(c.get('section_id', 'unknown')))}\n"
            f"**Type**: {c['type']}\n"
            f"**Content**:\n{c['text']}"
            for c in chunks
        ])
        valid_chunk_ids = ", ".join(c['id'] for c in chunks)

        prompt = f"""Generate detailed User Stories with acceptance criteria for the following EPICs.

EPICs to generate stories for:
{epics_text}

BRD Content (chunked by section — reference chunk IDs in source_chunks):
{chunks_text}
{gap_fixes_text}{atomic_reqs_text}
Special Instructions:
{instructions if instructions else 'None'}

IMPORTANT:
- Generate stories ONLY for the EPICs listed above, not for any other epics.
- Start story IDs from story_{story_id_offset + 1} to avoid conflicts with other batches.
- TRACEABILITY: Every story and every acceptance criterion MUST have source_chunks populated with at least one ID from this exact list: [{valid_chunk_ids}]. Empty source_chunks arrays are not acceptable. Do not invent chunk IDs not in that list.
- ATOMIC REQUIREMENT LINKAGE: Every story MUST populate atomic_requirement_ids with IDs from the Atomic Requirements list above that this story satisfies. Do not leave it empty.
- STORY BUDGET (strictly enforced): Generate at most 5 user stories per epic. Prefer fewer, broader stories over many narrow ones. Prioritise the highest-value requirements. If an epic has only 1–2 meaningful requirements, generate 1–2 stories — do not pad. Never exceed 5 stories per epic under any circumstances.

Output must be valid JSON matching this schema:
{{
  "user_stories": [
    {{
      "id": "story_{story_id_offset + 1}",
      "epic_id": "epic_1",
      "title": "string",
      "role": "string",
      "goal": "string",
      "benefit": "string",
      "acceptance_criteria": [
        {{
          "id": "ac_{story_id_offset + 1}_1",
          "text": "string",
          "source_chunks": ["chunk_1"]
        }}
      ],
      "source_chunks": ["chunk_1"],
      "atomic_requirement_ids": ["req_1"]
    }}
  ]
}}

Use format: "As a [role], I want [goal] so that [benefit]" for each story.
Make acceptance criteria specific and testable.
You MUST generate at least one user story per epic. Do not return an empty user_stories array.
"""

        system_prompt = """You are an expert business analyst specializing in agile user story creation.

CRITICAL JSON FORMAT REQUIREMENTS:
- Your response MUST be ONLY valid JSON
- Start with { character and end with } character
- NO markdown code blocks (no ``` or ```json)
- NO explanatory text before or after the JSON
- NO comments inside the JSON

Correct format example:
{"user_stories": [{"id": "story_1", "epic_id": "epic_1", "title": "Login with credentials", "role": "registered user", "goal": "log in with my username and password", "benefit": "I can access my account securely", "acceptance_criteria": [{"id": "ac_1_1", "text": "Given valid credentials, when I submit the form, then I am redirected to the dashboard", "source_chunks": ["chunk_1"]}], "source_chunks": ["chunk_1"], "atomic_requirement_ids": ["req_1"]}]}

INCORRECT format (DO NOT DO THIS):
```json
{"user_stories": []}
```

Begin your response now with { character:"""

        return self._invoke_claude(prompt, system_prompt, job_id=job_id, stage="USER_STORIES")

    def generate_functional_tests(
        self,
        user_stories: List[UserStory],
        instructions: str,
        brd_chunks: Optional[List[Dict[str, Any]]] = None,
        gap_fixes: List[Dict[str, str]] = None,
        job_id: str = None,
        test_id_offset: int = 0
    ) -> Dict[str, Any]:
        """Call B: User Stories → Functional Tests"""

        # Build gap fixes context
        gap_fixes_text = self._build_gap_fixes_context(gap_fixes)

        story_req_ids_text = ""
        all_req_ids = []
        for s in user_stories:
            if hasattr(s, 'atomic_requirement_ids') and s.atomic_requirement_ids:
                all_req_ids.extend(s.atomic_requirement_ids)
        if all_req_ids:
            unique_ids = sorted(set(all_req_ids))
            story_req_ids_text = (
                f"\n\nAtomic Requirement IDs from source stories: {', '.join(unique_ids)}\n"
                f"Each test MUST include atomic_requirement_ids listing which of these it validates.\n"
            )

        stories_text = "\n\n".join([
            f"Story {s.id}: {s.title}\n"
            f"As a {s.role}, I want {s.goal} so that {s.benefit}\n"
            f"Source Chunks: {', '.join(s.source_chunks) if s.source_chunks else 'N/A'}\n"
            f"Acceptance Criteria:\n" +
            "\n".join([f"- {ac.text}" for ac in s.acceptance_criteria])
            for s in user_stories
        ])

        chunks_context = ""
        valid_chunk_ids = ""
        if brd_chunks:
            valid_chunk_ids = ", ".join(c['id'] for c in brd_chunks)
            chunks_context = "\n\n## Relevant BRD Chunks:\n\n" + "\n\n".join([
                f"### Chunk {c['id']} - {c.get('section_title', 'Section ' + str(c.get('section_id', 'unknown')))}\n"
                f"**Section ID**: {c.get('section_id', 'N/A')}\n"
                f"**Type**: {c['type']}\n"
                f"**Content**:\n{c['text']}"  # Full text, not truncated
                for c in brd_chunks
            ])

        prompt = f"""Generate functional test cases for these user stories.

User Stories:
{stories_text}
{chunks_context}
{gap_fixes_text}{story_req_ids_text}
Special Instructions:
{instructions if instructions else 'None'}

Output must be valid JSON matching this schema:
{{
  "functional_tests": [
    {{
      "id": "test_{test_id_offset + 1}",
      "story_id": "story_1",
      "title": "string",
      "objective": "string",
      "preconditions": ["string"],
      "test_steps": ["string"],
      "expected_results": ["string"],
      "source_chunks": ["chunk_1"],
      "atomic_requirement_ids": ["req_1"]
    }}
  ]
}}

TEST BUDGET (strictly enforced): Generate at most 3 functional tests per user story — typically one happy path and one or two edge cases or error conditions. Do not generate exhaustive coverage. If a story is straightforward, 2 tests is correct. Never exceed 3 tests per story.
TRACEABILITY: Every functional test MUST have source_chunks populated with at least one chunk ID. {"Valid chunk IDs: " + valid_chunk_ids + ". " if valid_chunk_ids else ""}Empty source_chunks arrays are not acceptable.
"""

        system_prompt = """You are an expert QA engineer.

CRITICAL JSON FORMAT REQUIREMENTS:
- Your response MUST be ONLY valid JSON
- Start with { character and end with } character
- NO markdown code blocks (no ``` or ```json)
- NO explanatory text before or after the JSON
- NO comments inside the JSON

Correct format example:
{"functional_tests": [{"id": "test_1", "story_id": "story_1", "title": "Verify login with valid credentials", "objective": "Ensure users can authenticate with correct username and password", "preconditions": ["User account exists", "User is on the login page"], "test_steps": ["Enter valid username", "Enter valid password", "Click Submit"], "expected_results": ["User is redirected to dashboard", "Session cookie is set"], "source_chunks": ["chunk_1"]}]}

INCORRECT format (DO NOT DO THIS):
```json
{"functional_tests": []}
```

Begin your response now with { character:"""

        return self._invoke_claude(prompt, system_prompt, job_id=job_id, stage="FUNCTIONAL_TESTS")

    def generate_gherkin_tests(
        self,
        user_stories: List[UserStory],
        functional_tests: List[FunctionalTest] = None,
        instructions: str = "",
        brd_chunks: Optional[List[Dict[str, Any]]] = None,
        job_id: str = None,
        gherkin_id_offset: int = 0
    ) -> Dict[str, Any]:
        """Call C: User Stories + Functional Tests + BRD chunks → Gherkin scenarios"""

        stories_text = "\n\n".join([
            f"Story {s.id}: {s.title}\n"
            f"As a {s.role}, I want {s.goal} so that {s.benefit}\n"
            f"Acceptance Criteria:\n" +
            "\n".join([f"- {ac.text}" for ac in s.acceptance_criteria])
            for s in user_stories
        ])

        # Include functional test titles only — enough for Gherkin context without bloating the prompt
        functional_tests_text = ""
        if functional_tests:
            functional_tests_text = "\n\nFunctional Tests (titles for reference):\n"
            for test in functional_tests:
                functional_tests_text += f"- [{test.story_id}] {test.title}\n"

        story_req_ids_text = ""
        all_req_ids = []
        for s in user_stories:
            if hasattr(s, 'atomic_requirement_ids') and s.atomic_requirement_ids:
                all_req_ids.extend(s.atomic_requirement_ids)
        if all_req_ids:
            unique_ids = sorted(set(all_req_ids))
            story_req_ids_text = (
                f"\n\nAtomic Requirement IDs from source stories: {', '.join(unique_ids)}\n"
                f"Each scenario MUST include atomic_requirement_ids listing which of these it covers.\n"
            )

        # Include relevant BRD chunks for domain grounding
        chunks_context = ""
        if brd_chunks:
            chunks_context = "\n\nRelevant BRD Context:\n" + "\n\n".join([
                f"Chunk {c['id']} - {c.get('section_title', 'Section')}:\n{c['text']}"
                for c in brd_chunks
            ])

        prompt = f"""Generate Gherkin BDD scenarios for these user stories.

User Stories:
{stories_text}
{functional_tests_text}{story_req_ids_text}
{chunks_context}

Special Instructions:
{instructions if instructions else 'None'}

Output must be valid JSON matching this schema:
{{
  "gherkin_tests": [
    {{
      "id": "gherkin_{gherkin_id_offset + 1}",
      "story_id": "story_1",
      "feature_name": "string",
      "scenario_name": "string",
      "given": ["string"],
      "when": ["string"],
      "then": ["string"],
      "source_chunks": ["chunk_1"],
      "atomic_requirement_ids": ["req_1"]
    }}
  ]
}}

Each scenario should follow BDD best practices with clear Given/When/Then steps.
"""

        system_prompt = """You are an expert in BDD and Gherkin syntax.

CRITICAL JSON FORMAT REQUIREMENTS:
- Your response MUST be ONLY valid JSON
- Start with { character and end with } character
- NO markdown code blocks (no ``` or ```json)
- NO explanatory text before or after the JSON
- NO comments inside the JSON

Correct format example:
{"gherkin_tests": [{"id": "gherkin_1", "story_id": "story_1", "feature_name": "User Authentication", "scenario_name": "Successful login with valid credentials", "given": ["the user is on the login page", "a valid account exists"], "when": ["the user enters valid credentials", "the user clicks Submit"], "then": ["the user is redirected to the dashboard", "a welcome message is displayed"], "source_chunks": ["chunk_1"]}]}

INCORRECT format (DO NOT DO THIS):
```json
{"gherkin_tests": []}
```

Begin your response now with { character:"""

        return self._invoke_claude(prompt, system_prompt, job_id=job_id, stage="GHERKIN_TESTS")

    def generate_data_model(
        self,
        brd_data: Dict[str, Any],
        user_stories: List[UserStory],
        gap_fixes: List[Dict[str, str]] = None,
        job_id: str = None
    ) -> Dict[str, Any]:
        """Call D: BRD + stories → Entities + Mermaid"""

        gap_fixes_text = self._build_gap_fixes_context(gap_fixes)

        # Tables are the primary source for data model entities
        tables_text = "\n\n".join([
            f"## Table {t['table_id']}:\nHeaders: {', '.join(t['headers'])}\n" +
            "\n".join([str(row) for row in t['rows']])
            for t in brd_data.get('tables', [])
        ])

        # Include BRD sections (summarized) — entities are often described in prose, not just tables
        sections_text = "\n\n".join([
            f"## {s['title']}\n{s['text'][:1500]}"  # 1500 chars per section
            for s in brd_data.get('sections', [])
        ])

        # Include story titles + goals + acceptance criteria — ACs are the richest source of field/entity hints
        stories_text = "\n\n".join([
            f"- {s.title}\n  Goal: {s.goal}\n  ACs: {'; '.join([ac.text for ac in s.acceptance_criteria[:3]])}"
            for s in user_stories
        ])

        prompt = f"""Analyze this BRD and user stories to create a comprehensive data model.

BRD Tables (primary entity source):
{tables_text if tables_text else 'No tables found'}

BRD Sections (for entity discovery from prose):
{sections_text if sections_text else 'No sections found'}

User Stories with Acceptance Criteria (for field/relationship discovery):
{stories_text}
{gap_fixes_text}

Output must be valid JSON matching this schema:
{{
  "entities": [
    {{
      "name": "string",
      "description": "string",
      "fields": [
        {{
          "name": "string",
          "type": "string",
          "required": true
        }}
      ]
    }}
  ],
  "mermaid": "erDiagram\\n  EntityName {{\\n    string fieldName\\n  }}\\n  EntityA ||--o{{ EntityB : relationship"
}}

Create a comprehensive entity-relationship model.
Generate a Mermaid ER diagram showing entities and relationships.
"""

        system_prompt = """You are an expert data architect.

CRITICAL JSON FORMAT REQUIREMENTS:
- Your response MUST be ONLY valid JSON
- Start with { character and end with } character
- NO markdown code blocks (no ``` or ```json)
- NO explanatory text before or after the JSON
- NO comments inside the JSON

Correct format example:
{"entities": [], "mermaid": "erDiagram"}

INCORRECT format (DO NOT DO THIS):
```json
{"entities": []}
```

Begin your response now with { character:"""

        return self._invoke_claude(prompt, system_prompt, job_id=job_id, stage="DATA_MODEL")

    def validate_brd_quality(
        self,
        brd_data: Dict[str, Any],
        job_id: str = None
    ) -> Dict[str, Any]:
        """Call F: BRD → 10 CTQ Validation Scores"""

        # Send BRD as chunks only — chunks already contain section title, section ID, type, and full text.
        # Sending sections and tables separately would triplicate the content unnecessarily.
        chunks = brd_data.get('chunks', [])
        chunks_text = "\n\n".join([
            f"## Chunk {c['id']} - {c.get('section_title', 'Section ' + str(c.get('section_id', 'unknown')))}\n"
            f"**Section ID**: {c.get('section_id', 'N/A')}\n"
            f"**Type**: {c['type']}\n"
            f"**Content**:\n{c['text']}"
            for c in chunks
        ])

        prompt = f"""Evaluate this Business Requirements Document across 10 Critical-to-Quality (CTQ) dimensions.

BRD Content (chunked by section):
{chunks_text}

Evaluate each dimension on a 0-5 scale:

1. **Completeness** - Are business scenarios, exception flows, regulatory requirements, and dependencies documented?
2. **Clarity & Unambiguity** - Is wording clear? Are terms defined? Is vocabulary consistent?
3. **Accuracy & Alignment** - Do requirements align with business objectives, process maps, and regulatory drivers?
4. **Testability** - Can each requirement be verified? Are acceptance criteria present?
5. **Traceability** - Are there clear links across objectives, processes, data, user stories, and tests?
6. **Feasibility** - Are requirements technically and operationally feasible given system constraints?
7. **Consistency** - Are there conflicting requirements or contradictory assumptions?
8. **Prioritisation** - Is there a clear prioritization schema (MoSCoW, etc.)?
9. **NFR Coverage** - Are non-functional requirements (performance, security, audit, retention) documented?
10. **Stakeholder Validation** - Are stakeholder responsibilities, RACI, and sign-offs documented?

Output ONLY valid JSON matching this exact schema:
{{
  "ctq_scores": {{
    "completeness": 4,
    "clarity": 3,
    "accuracy": 5,
    "testability": 2,
    "traceability": 3,
    "feasibility": 4,
    "consistency": 5,
    "prioritisation": 3,
    "nfr_coverage": 2,
    "stakeholder_validation": 4
  }},
  "overall_score": 3.5,
  "key_gaps": [
    "Lack of exception flows for trade booking failure scenarios",
    "Missing NFRs for performance and data archiving",
    "Unclear acceptance criteria in Section 4.2"
  ],
  "remediation_actions": [
    "Add exception scenarios for trade booking failures",
    "Define measurable acceptance criteria using Given-When-Then format",
    "Add NFRs for latency, audit logging, and data retention"
  ],
  "detailed_findings": {{
    "completeness": {{
      "score": 4,
      "findings": ["Missing upstream dependency: CAESAR API authentication details", "No error handling scenarios documented"],
      "recommendations": ["Document CAESAR API integration requirements", "Add exception flow diagrams"]
    }},
    "clarity": {{
      "score": 3,
      "findings": ["Undefined term: 'RTG_FITCH_OUTLOOK' not explained", "Ambiguous: 'System shall process trades' lacks specificity"],
      "recommendations": ["Add glossary of technical terms", "Rewrite vague requirements with specific criteria"]
    }},
    "accuracy": {{
      "score": 5,
      "findings": [],
      "recommendations": []
    }},
    "testability": {{
      "score": 2,
      "findings": ["Requirement 'System shall be fast' is not measurable", "Missing acceptance criteria for 8 out of 12 requirements"],
      "recommendations": ["Rewrite as 'Response time < 200ms for 95% of requests'", "Add Given-When-Then acceptance criteria"]
    }},
    "traceability": {{
      "score": 3,
      "findings": ["No explicit mapping from requirements to test cases", "Business objectives not linked to specific requirements"],
      "recommendations": ["Create traceability matrix", "Add requirement IDs and cross-references"]
    }},
    "feasibility": {{
      "score": 4,
      "findings": ["Timeline may be aggressive for CAESAR integration complexity"],
      "recommendations": ["Validate timeline with technical team", "Consider phased rollout"]
    }},
    "consistency": {{
      "score": 5,
      "findings": [],
      "recommendations": []
    }},
    "prioritisation": {{
      "score": 3,
      "findings": ["No MoSCoW or similar prioritization schema present"],
      "recommendations": ["Classify requirements as Must/Should/Could/Won't have"]
    }},
    "nfr_coverage": {{
      "score": 2,
      "findings": ["No performance requirements (latency, throughput)", "Missing audit and compliance requirements", "No data retention policy"],
      "recommendations": ["Add performance SLAs", "Document audit logging requirements", "Define data retention periods"]
    }},
    "stakeholder_validation": {{
      "score": 4,
      "findings": ["RACI matrix incomplete - no 'Informed' parties listed"],
      "recommendations": ["Complete RACI matrix with all stakeholder roles"]
    }}
  }}
}}

Be specific and actionable in findings and recommendations.
"""

        system_prompt = """You are an expert Business Analyst and Quality Assurance specialist.

CRITICAL JSON FORMAT REQUIREMENTS:
- Your response MUST be ONLY valid JSON
- Start with { character and end with } character
- NO markdown code blocks (no ``` or ```json)
- NO explanatory text before or after the JSON
- NO comments inside the JSON

Correct format example:
{"ctq_scores": {"completeness": 4}, "overall_score": 3.5}

INCORRECT format (DO NOT DO THIS):
```json
{"ctq_scores": {"completeness": 4}}
```

Begin your response now with { character:"""

        return self._invoke_claude(prompt, system_prompt, job_id=job_id, stage="VALIDATION")

    def generate_gap_fixes(
        self,
        brd_data: Dict[str, Any],
        validation_report: Dict[str, Any],
        job_id: str = None
    ) -> List[Dict[str, Any]]:
        """Call G: Validation Gaps → AI-Suggested Fixes (single batched call instead of N calls)"""

        gaps = validation_report.get("key_gaps", [])[:10]  # cap at 10 gaps
        if not gaps:
            return []

        # Send BRD as chunks only — consistent with other calls
        chunks = brd_data.get('chunks', [])
        chunks_text = "\n\n".join([
            f"## Chunk {c['id']} - {c.get('section_title', 'Section ' + str(c.get('section_id', 'unknown')))}\n"
            f"**Type**: {c['type']}\n"
            f"**Content**:\n{c['text']}"
            for c in chunks
        ])

        numbered_gaps = "\n".join([f"{i+1}. {gap}" for i, gap in enumerate(gaps)])

        prompt = f"""Generate specific, actionable fixes for each of the following BRD quality gaps.

BRD Content:
{chunks_text}

Quality Gaps to Fix:
{numbered_gaps}

For each gap produce one fix object. Be highly specific:
- Use exact threshold values (e.g., "< 200ms" not "fast")
- Include concrete examples (e.g., specific error codes)
- Provide measurable criteria
- Use Given-When-Then format for acceptance criteria gaps
- Provide specific metrics/SLAs for NFR gaps

Output must be valid JSON matching this schema:
{{
  "gap_fixes": [
    {{
      "gap_id": "gap_1",
      "gap_description": "string",
      "affected_section": "string",
      "current_text": "string",
      "suggested_fix": "string",
      "rationale": "string",
      "confidence": "high"
    }}
  ]
}}

Generate exactly {len(gaps)} fix objects — one per gap in the order listed.
"""

        system_prompt = """You are an expert Business Analyst.

CRITICAL JSON FORMAT REQUIREMENTS:
- Your response MUST be ONLY valid JSON
- Start with { character and end with } character
- NO markdown code blocks (no ``` or ```json)
- NO explanatory text before or after the JSON
- NO comments inside the JSON

Correct format example:
{"gap_fixes": [{"gap_id": "gap_1", "gap_description": "Missing exception flows", "affected_section": "Section 3.2", "current_text": "System shall process trades", "suggested_fix": "System shall process trades with error handling: ...", "rationale": "Specific exception flows enable proper testing", "confidence": "high"}]}

INCORRECT format (DO NOT DO THIS):
```json
{"gap_fixes": []}
```

Begin your response now with { character:"""

        try:
            result = self._invoke_claude(prompt, system_prompt, job_id=job_id, stage="GAP_FIXES")
            return result.get("gap_fixes", [])
        except Exception as e:
            log_error("Error generating gap fixes", error=e)
            return []

    def _build_gap_fixes_context(self, gap_fixes: List[Dict[str, str]] = None) -> str:
        """Build formatted gap fixes context for LLM prompts"""
        if not gap_fixes or len(gap_fixes) == 0:
            return ""

        gap_fixes_text = "\n\n## BRD CORRECTIONS AND CLARIFICATIONS\n"
        gap_fixes_text += "The following issues were identified in the BRD during validation and have been corrected:\n\n"

        for i, fix in enumerate(gap_fixes, 1):
            gap_fixes_text += f"{i}. **{fix['type']}**: {fix['issue']}\n"
            gap_fixes_text += f"   Correction: {fix['correction']}\n\n"

        gap_fixes_text += "Please incorporate these corrections when generating the specifications.\n"
        return gap_fixes_text
