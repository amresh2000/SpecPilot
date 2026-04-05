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
from app.models import UserStory, FunctionalTest
from app.config import config as app_config
from app.utils import log_info, log_warning, log_error


class BedrockLLMClient:
    """AWS Bedrock client for Claude models."""

    def __init__(self, region_name: str = None):
        region = region_name or app_config.AWS_REGION

        boto_config_params = {
            'retries': {'max_attempts': 1, 'mode': 'standard'},
            'read_timeout': 300
        }

        if app_config.HTTP_PROXY:
            boto_config_params['proxies'] = {
                'http': app_config.HTTP_PROXY,
                'https': app_config.HTTPS_PROXY or app_config.HTTP_PROXY
            }
            log_info(f"Boto3 using explicit proxy: {app_config.HTTP_PROXY}")

        boto_config = Config(**boto_config_params)

        self.client = boto3.client(
            'bedrock-runtime',
            region_name=region,
            aws_access_key_id=app_config.AWS_ACCESS_KEY_ID,
            aws_secret_access_key=app_config.AWS_SECRET_ACCESS_KEY,
            config=boto_config
        )

        self.model_id = app_config.AWS_BEDROCK_MODEL_ID          # Sonnet — complex reasoning
        self.haiku_model_id = app_config.AWS_BEDROCK_HAIKU_MODEL_ID  # Haiku — mechanical tasks
        log_info(f"Sonnet model: {self.model_id} | Haiku model: {self.haiku_model_id}")

        self.max_retries = 5
        self.base_delay = 2

    def _log_llm_error(self, job_id, stage, error_type, prompt, system_prompt, raw_response, error_message, extraction_details=None):
        if not app_config.LOG_LLM_RESPONSES:
            return
        try:
            now = datetime.now()
            folder_name = f"{now.strftime('%Y%m%d')}_{job_id[:8]}"
            log_dir = Path(app_config.LLM_LOG_DIR) / folder_name
            log_dir.mkdir(parents=True, exist_ok=True)
            timestamp = now.strftime("%H%M%S")
            log_path = log_dir / f"{stage.lower()}_{timestamp}.json"
            log_entry = {
                "timestamp": datetime.now().isoformat(),
                "job_id": job_id,
                "stage": stage,
                "error_type": error_type,
                "extraction_details": extraction_details or {},
                "prompt_preview": prompt[:1000] + ("..." if len(prompt) > 1000 else ""),
                "system_prompt": system_prompt,
                "raw_response": raw_response,
                "error_message": error_message
            }
            with open(log_path, 'w', encoding='utf-8') as f:
                json.dump(log_entry, f, indent=2, ensure_ascii=False)
            log_info(f"LLM error logged to: {log_path}")
        except Exception as e:
            log_warning(f"Failed to log LLM error: {str(e)}")

    def _invoke_claude(self, prompt: str, system_prompt: str = "", job_id: str = None, stage: str = None, model_id: str = None) -> Dict[str, Any]:
        """Invoke Claude with exponential backoff retry. model_id defaults to Sonnet."""
        model = model_id or self.model_id
        last_error = None

        for attempt in range(self.max_retries + 1):
            try:
                request_body = {
                    "anthropic_version": "bedrock-2023-05-31",
                    "max_tokens": 64000,
                    "messages": [{"role": "user", "content": prompt}],
                    "temperature": 0.3,
                }
                if system_prompt:
                    request_body["system"] = system_prompt

                response = self.client.invoke_model(modelId=model, body=json.dumps(request_body))
                response_body = json.loads(response['body'].read())
                content = response_body['content'][0]['text'].strip()

                try:
                    return json.loads(content)
                except json.JSONDecodeError:
                    match = re.search(r'```(?:json)?\s*\n?(.*?)\n?```', content, re.DOTALL)
                    if match:
                        log_warning("WARNING: Claude returned markdown-wrapped JSON, extracting from code block...")
                        if job_id and stage:
                            self._log_llm_error(job_id, stage, "markdown_wrapped", prompt, system_prompt, content, "markdown wrapped")
                        return json.loads(match.group(1).strip())

                    start = content.find('{')
                    end = content.rfind('}')
                    if start != -1 and end > start:
                        log_warning(f"WARNING: Extracting JSON from mixed content...")
                        if job_id and stage:
                            self._log_llm_error(job_id, stage, "mixed_content_extraction", prompt, system_prompt, content, "mixed content", {"start_pos": start, "end_pos": end})
                        return json.loads(content[start:end+1])

                    error_msg = f"Could not extract JSON. Response preview: {content[:300]}..."
                    if job_id and stage:
                        self._log_llm_error(job_id, stage, "extraction_failed", prompt, system_prompt, content, error_msg)
                    raise json.JSONDecodeError(error_msg, content, 0)

            except json.JSONDecodeError as e:
                if attempt < self.max_retries:
                    delay = self.base_delay * (2 ** attempt)
                    log_warning(f"JSON parse error, retrying in {delay}s (attempt {attempt + 1}/{self.max_retries + 1})...")
                    time.sleep(delay)
                    last_error = e
                    continue
                else:
                    raise ValueError(f"Failed to parse JSON after {self.max_retries + 1} attempts: {str(e)}")

            except ClientError as e:
                error_code = e.response.get('Error', {}).get('Code', '')
                if error_code == 'ThrottlingException' and attempt < self.max_retries:
                    delay = self.base_delay * (2 ** attempt)
                    log_warning(f"Throttled by Bedrock, retrying in {delay}s (attempt {attempt + 1}/{self.max_retries + 1})...")
                    time.sleep(delay)
                    last_error = e
                    continue
                else:
                    raise RuntimeError(f"Error invoking Bedrock: {str(e)}")

            except Exception as e:
                raise RuntimeError(f"Error invoking Bedrock: {str(e)}")

        if last_error:
            raise RuntimeError(f"Failed after {self.max_retries + 1} attempts. Last error: {str(last_error)}")

    # ─────────────────────────────────────────────────────────────
    # Call 1: Validate BRD + generate gap fixes  (Sonnet)
    # ─────────────────────────────────────────────────────────────

    def validate_and_fix(self, brd_data: Dict[str, Any], job_id: str = None) -> Dict[str, Any]:
        """BRD → CTQ validation scores + gap fixes in one call."""

        raw_text = brd_data.get('raw_text', '')

        prompt = f"""Evaluate this Business Requirements Document across 10 Critical-to-Quality (CTQ) dimensions, identify key gaps, and generate a specific fix for each gap.

BRD Content:
{raw_text}

## Evaluation Instructions

Score each dimension 0–5, identify up to 10 key gaps, then generate one gap_fix per gap (in the same order).

Dimensions:
1. Completeness — business scenarios, exception flows, regulatory requirements, dependencies
2. Clarity & Unambiguity — clear wording, defined terms, consistent vocabulary
3. Accuracy & Alignment — aligns with business objectives, process maps, regulatory drivers
4. Testability — verifiable requirements, acceptance criteria present
5. Traceability — links across objectives, processes, data, user stories, tests
6. Feasibility — technically and operationally feasible given constraints
7. Consistency — no conflicting requirements or contradictory assumptions
8. Prioritisation — clear prioritization schema (MoSCoW etc.)
9. NFR Coverage — performance, security, audit, retention requirements
10. Stakeholder Validation — stakeholder responsibilities, RACI, sign-offs

## Gap Fix Instructions

For each gap fix:
- Use exact threshold values (e.g., "< 200ms" not "fast")
- Provide measurable criteria
- Use Given-When-Then format for acceptance criteria gaps
- Provide specific metrics/SLAs for NFR gaps

Output ONLY valid JSON matching this schema:
{{
  "ctq_scores": {{
    "completeness": 4, "clarity": 3, "accuracy": 5, "testability": 2,
    "traceability": 3, "feasibility": 4, "consistency": 5,
    "prioritisation": 3, "nfr_coverage": 2, "stakeholder_validation": 4
  }},
  "overall_score": 3.5,
  "key_gaps": ["string"],
  "remediation_actions": ["string"],
  "detailed_findings": {{
    "completeness": {{"score": 4, "findings": ["string"], "recommendations": ["string"]}},
    "clarity": {{"score": 3, "findings": [], "recommendations": []}},
    "accuracy": {{"score": 5, "findings": [], "recommendations": []}},
    "testability": {{"score": 2, "findings": [], "recommendations": []}},
    "traceability": {{"score": 3, "findings": [], "recommendations": []}},
    "feasibility": {{"score": 4, "findings": [], "recommendations": []}},
    "consistency": {{"score": 5, "findings": [], "recommendations": []}},
    "prioritisation": {{"score": 3, "findings": [], "recommendations": []}},
    "nfr_coverage": {{"score": 2, "findings": [], "recommendations": []}},
    "stakeholder_validation": {{"score": 4, "findings": [], "recommendations": []}}
  }},
  "gap_fixes": [
    {{
      "gap_description": "string",
      "affected_section": "string",
      "current_text": "string",
      "suggested_fix": "string",
      "rationale": "string",
      "confidence": "high"
    }}
  ]
}}

Generate exactly one gap_fix per key gap, in the same order as key_gaps.
"""

        system_prompt = """You are an expert Business Analyst and QA specialist.

CRITICAL JSON FORMAT REQUIREMENTS:
- Your response MUST be ONLY valid JSON
- Start with { and end with }
- NO markdown code blocks, NO explanatory text, NO comments

Begin your response now with { character:"""

        return self._invoke_claude(prompt, system_prompt, job_id=job_id, stage="VALIDATE_AND_FIX")

    # ─────────────────────────────────────────────────────────────
    # Call 2: Epics + User Stories  (Sonnet)
    # ─────────────────────────────────────────────────────────────

    def generate_epics_and_stories(
        self,
        brd_data: Dict[str, Any],
        instructions: str,
        gap_fixes: List[Dict[str, str]] = None,
        existing_epics: List[Dict[str, str]] = None,
        job_id: str = None
    ) -> Dict[str, Any]:
        """BRD → project_name + epics + user stories with acceptance criteria."""

        raw_text = brd_data.get('raw_text', '')
        gap_fixes_text = self._build_gap_fixes_context(gap_fixes)

        existing_epics_text = ""
        if existing_epics:
            existing_epics_text = "\n\n## EXISTING EPICS (DO NOT DUPLICATE)\nGenerate NEW epics only:\n\n"
            for i, epic in enumerate(existing_epics, 1):
                existing_epics_text += f"{i}. {epic['name']}: {epic['description']}\n"

        prompt = f"""Analyze this Business Requirements Document and generate a project name, EPICs, and User Stories with acceptance criteria.

BRD Content:
{raw_text}
{gap_fixes_text}
{existing_epics_text}
Special Instructions:
{instructions if instructions else 'None'}

Generate:
1. A project name
2. A focused set of EPICs covering all major feature areas (aim for 5–8 epics)
3. For EACH epic, generate consolidated user stories. Group related requirements that share the same actor and goal into a single story — do not create separate stories for minor variations of the same capability.

Constraints:
- Target 3–6 user stories per epic
- Total user stories across all epics: aim for 20–35
- Consolidate: if two requirements have the same role + goal, merge them into one story with combined acceptance criteria

Output must be valid JSON matching this schema:
{{
  "project_name": "string",
  "epics": [
    {{
      "id": "epic_1",
      "name": "string",
      "description": "string"
    }}
  ],
  "user_stories": [
    {{
      "id": "story_1",
      "epic_id": "epic_1",
      "title": "string",
      "role": "string",
      "goal": "string",
      "benefit": "string",
      "acceptance_criteria": [
        {{
          "id": "ac_1_1",
          "text": "string"
        }}
      ]
    }}
  ]
}}

Use format: "As a [role], I want [goal] so that [benefit]" for each story.
Make acceptance criteria specific and testable.
You MUST generate at least one user story per epic, but prioritise quality and consolidation over quantity.
"""

        system_prompt = """You are an expert business analyst specialising in agile delivery.

CRITICAL JSON FORMAT REQUIREMENTS:
- Your response MUST be ONLY valid JSON
- Start with { and end with }
- NO markdown code blocks, NO explanatory text, NO comments

Begin your response now with { character:"""

        return self._invoke_claude(prompt, system_prompt, job_id=job_id, stage="EPICS_AND_STORIES")

    # ─────────────────────────────────────────────────────────────
    # Call 3: Functional Tests  (Haiku — mechanical derivation)
    # ─────────────────────────────────────────────────────────────

    def generate_functional_tests(
        self,
        user_stories: List[UserStory],
        instructions: str,
        brd_data: Dict[str, Any],
        gap_fixes: List[Dict[str, str]] = None,
        job_id: str = None
    ) -> Dict[str, Any]:
        """User stories + BRD tables → functional test cases."""

        gap_fixes_text = self._build_gap_fixes_context(gap_fixes)

        # Condensed story format: title + role + goal + ACs (benefit omitted)
        stories_text = "\n\n".join([
            f"Story {s.id}: {s.title}\n"
            f"As a {s.role}, I want {s.goal}\n"
            f"Acceptance Criteria:\n" +
            "\n".join([f"  - {ac.text}" for ac in s.acceptance_criteria])
            for s in user_stories
        ])

        # BRD tables carry precise field constraints, data rules, and validation limits
        tables_text = ""
        tables = brd_data.get('tables', []) if brd_data else []
        if tables:
            tables_text = "\n\n## BRD Tables (field constraints and data rules):\n\n"
            tables_text += "\n\n".join([
                f"Table {t['table_id']} — Headers: {', '.join(t['headers'])}\n" +
                "\n".join([str(row) for row in t['rows']])
                for t in tables
            ])

        prompt = f"""Generate functional test cases for the following user stories.

User Stories:
{stories_text}
{tables_text}
{gap_fixes_text}
Special Instructions:
{instructions if instructions else 'None'}

Output must be valid JSON matching this schema:
{{
  "functional_tests": [
    {{
      "id": "test_1",
      "story_id": "story_1",
      "title": "string",
      "objective": "string",
      "preconditions": ["string"],
      "test_steps": ["string"],
      "expected_results": ["string"]
    }}
  ]
}}

Group related acceptance criteria into a single test when they share the same preconditions or test flow. A single test can verify multiple related ACs.

Constraints:
- Target 2–3 functional tests per user story (not one per AC)
- Total functional tests across all stories: aim for 40–70
- Consolidate tests that differ only in minor data variations — use a single test with representative data instead
"""

        system_prompt = """You are an expert QA engineer.

CRITICAL JSON FORMAT REQUIREMENTS:
- Your response MUST be ONLY valid JSON
- Start with { and end with }
- NO markdown code blocks, NO explanatory text, NO comments

Begin your response now with { character:"""

        return self._invoke_claude(prompt, system_prompt, job_id=job_id, stage="FUNCTIONAL_TESTS", model_id=self.haiku_model_id)

    # ─────────────────────────────────────────────────────────────
    # Call 4: Gherkin Tests  (Haiku — format translation)
    # ─────────────────────────────────────────────────────────────

    def generate_gherkin_tests(
        self,
        user_stories: List[UserStory],
        functional_tests: List[FunctionalTest] = None,
        instructions: str = "",
        job_id: str = None
    ) -> Dict[str, Any]:
        """User stories + functional tests → Gherkin BDD scenarios."""

        # Minimal story format: title + role + ACs only
        stories_text = "\n\n".join([
            f"Story {s.id}: {s.title}\n"
            f"Role: {s.role}\n"
            f"Acceptance Criteria:\n" +
            "\n".join([f"  - {ac.text}" for ac in s.acceptance_criteria])
            for s in user_stories
        ])

        # Condensed functional test format: title + steps + expected (preconditions → Given, steps → When, expected → Then)
        tests_text = ""
        if functional_tests:
            tests_text = "\n\nFunctional Tests (preconditions → Given, steps → When, expected → Then):\n\n"
            tests_text += "\n\n".join([
                f"Test {t.id} (story: {t.story_id}): {t.title}\n"
                f"Preconditions: {'; '.join(t.preconditions)}\n"
                f"Steps: {'; '.join(t.test_steps)}\n"
                f"Expected: {'; '.join(t.expected_results)}"
                for t in functional_tests
            ])

        prompt = f"""Generate Gherkin BDD scenarios for the following user stories.

User Stories:
{stories_text}
{tests_text}

Special Instructions:
{instructions if instructions else 'None'}

Output must be valid JSON matching this schema:
{{
  "gherkin_tests": [
    {{
      "id": "gherkin_1",
      "story_id": "story_1",
      "feature_name": "string",
      "scenario_name": "string",
      "given": ["string"],
      "when": ["string"],
      "then": ["string"]
    }}
  ]
}}

Each scenario must follow BDD best practices with clear Given/When/Then steps.
Generate 1–2 Gherkin scenarios per user story. Each scenario should cover the primary happy path or the most business-critical edge case — do not generate a scenario per acceptance criterion.
"""

        system_prompt = """You are an expert in BDD and Gherkin syntax.

CRITICAL JSON FORMAT REQUIREMENTS:
- Your response MUST be ONLY valid JSON
- Start with { and end with }
- NO markdown code blocks, NO explanatory text, NO comments

Begin your response now with { character:"""

        return self._invoke_claude(prompt, system_prompt, job_id=job_id, stage="GHERKIN_TESTS", model_id=self.haiku_model_id)

    # ─────────────────────────────────────────────────────────────
    # Call 5: Data Model  (Sonnet — structural reasoning)
    # ─────────────────────────────────────────────────────────────

    def generate_data_model(
        self,
        brd_data: Dict[str, Any],
        user_stories: List[UserStory],
        gap_fixes: List[Dict[str, str]] = None,
        job_id: str = None
    ) -> Dict[str, Any]:
        """BRD tables + section summaries + stories → entities + Mermaid ER diagram."""

        gap_fixes_text = self._build_gap_fixes_context(gap_fixes)

        # Tables are the primary entity source
        tables = brd_data.get('tables', [])
        tables_text = "\n\n".join([
            f"Table {t['table_id']} — Headers: {', '.join(t['headers'])}\n" +
            "\n".join([str(row) for row in t['rows']])
            for t in tables
        ]) if tables else "No tables found."

        # Section summaries (first 400 chars) for entity discovery from prose
        sections = brd_data.get('sections', [])
        sections_text = "\n\n".join([
            f"## {s['title']}\n{s['text'][:400].rstrip()}"
            for s in sections if s.get('text', '').strip()
        ]) if sections else "No sections found."

        # Condensed stories: title + ACs (field/relationship hints)
        stories_text = "\n\n".join([
            f"- {s.title}\n  ACs: {'; '.join([ac.text for ac in s.acceptance_criteria[:4]])}"
            for s in user_stories
        ])

        prompt = f"""Analyze this BRD and user stories to create a comprehensive data model.

BRD Tables (primary entity source):
{tables_text}

BRD Section Summaries (entity discovery from prose):
{sections_text}

User Stories with Acceptance Criteria (field and relationship hints):
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

Generate a comprehensive entity-relationship model with a valid Mermaid ER diagram.
"""

        system_prompt = """You are an expert data architect.

CRITICAL JSON FORMAT REQUIREMENTS:
- Your response MUST be ONLY valid JSON
- Start with { and end with }
- NO markdown code blocks, NO explanatory text, NO comments

Begin your response now with { character:"""

        return self._invoke_claude(prompt, system_prompt, job_id=job_id, stage="DATA_MODEL")

    # ─────────────────────────────────────────────────────────────
    # Shared helpers
    # ─────────────────────────────────────────────────────────────

    def _build_gap_fixes_context(self, gap_fixes: List[Dict[str, str]] = None) -> str:
        if not gap_fixes:
            return ""
        text = "\n\n## BRD CORRECTIONS AND CLARIFICATIONS\n"
        text += "The following issues were identified and corrected:\n\n"
        for i, fix in enumerate(gap_fixes, 1):
            text += f"{i}. **{fix['type']}**: {fix['issue']}\n"
            text += f"   Correction: {fix['correction']}\n\n"
        text += "Please incorporate these corrections when generating the specifications.\n"
        return text
