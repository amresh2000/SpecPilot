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
            print(f"Boto3 using explicit proxy: {app_config.HTTP_PROXY}")

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
        print(f"Using Bedrock model: {self.model_id}")
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

            print(f"LLM error logged to: {log_path}")

        except Exception as e:
            # Don't fail the main operation if logging fails
            print(f"Failed to log LLM error: {str(e)}")

    def _invoke_claude(self, prompt: str, system_prompt: str = "", job_id: str = None, stage: str = None) -> Dict[str, Any]:
        """Invoke Claude with exponential backoff retry logic for throttling"""
        last_error = None

        for attempt in range(self.max_retries + 1):
            try:
                # Prepare request
                messages = [{"role": "user", "content": prompt}]

                request_body = {
                    "anthropic_version": "bedrock-2023-05-31",
                    "max_tokens": 32768,  # Increased to 32768 to allow full BRD processing and larger outputs
                    "messages": messages,
                    "temperature": 0.7,
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
                    match = re.search(r'```(?:json)?\s*\n?(.*?)\n?```', content, re.DOTALL)
                    if match:
                        error_msg = "WARNING: Claude returned markdown-wrapped JSON, extracting from code block..."
                        print(error_msg)

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
                        print(error_msg)

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
                    print(f"JSON parse error, retrying in {delay}s (attempt {attempt + 1}/{self.max_retries + 1})...")
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
                    print(f"Throttled by Bedrock, retrying in {delay}s (attempt {attempt + 1}/{self.max_retries + 1})...")
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

    def generate_epics_and_stories(
        self,
        brd_data: Dict[str, Any],
        instructions: str,
        gap_fixes: List[Dict[str, str]] = None,
        existing_epics: List[Dict[str, str]] = None,
        job_id: str = None
    ) -> Dict[str, Any]:
        """Call A: BRD → project_name + epics + user stories"""

        # Build gap fixes context
        gap_fixes_text = self._build_gap_fixes_context(gap_fixes)

        # Build existing epics exclusion context
        existing_epics_text = ""
        if existing_epics and len(existing_epics) > 0:
            existing_epics_text = "\n\n## EXISTING EPICS (DO NOT DUPLICATE)\n"
            existing_epics_text += "The following epics already exist. Generate NEW epics only, avoiding duplication:\n\n"
            for i, epic in enumerate(existing_epics, 1):
                existing_epics_text += f"{i}. {epic['name']}: {epic['description']}\n"
            existing_epics_text += "\nIMPORTANT: Do not regenerate these epics or create similar ones. Focus on NEW features.\n"

        # Prepare context from BRD - send ALL chunks with full content
        chunks = brd_data.get('chunks', [])
        chunks_text = "\n\n".join([
            f"## Chunk {c['id']} - {c.get('section_title', 'Section ' + str(c.get('section_id', 'unknown')))}\n"
            f"**Section ID**: {c.get('section_id', 'N/A')}\n"
            f"**Type**: {c['type']}\n"
            f"**Content**:\n{c['text']}"
            for c in chunks  # Send ALL chunks, no limit
        ])

        # Send ALL sections with full content
        sections_text = "\n\n".join([
            f"## Section {s['id']}: {s['title']}\n{s['text']}"
            for s in brd_data.get('sections', [])  # Send ALL sections
        ])

        # Send ALL tables with full rows
        tables_text = "\n\n".join([
            f"## Table {t['table_id']}: {', '.join(t['headers'])}\n" +
            "\n".join([str(row) for row in t['rows']])
            for t in brd_data.get('tables', [])  # Send ALL tables with ALL rows
        ])

        prompt = f"""Analyze this Business Requirements Document and generate:
1. A project name
2. EPICs (high-level features/themes)
3. User Stories with acceptance criteria

BRD Chunks (Reference these by ID in source_chunks):
{chunks_text}

BRD Content:
{sections_text}

{tables_text if tables_text else ''}
{gap_fixes_text}
{existing_epics_text}
Special Instructions:
{instructions if instructions else 'None'}

IMPORTANT: For each user story and acceptance criterion, identify which BRD chunks were used as source material and include their IDs in the source_chunks array.

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
          "id": "ac_1",
          "text": "string",
          "source_chunks": ["chunk_1"]
        }}
      ],
      "source_chunks": ["chunk_1"]
    }}
  ]
}}

Use format: "As a [role], I want [goal] so that [benefit]" for stories.
Make acceptance criteria specific and testable.
Include source_chunks references to BRD sections where applicable.
"""

        system_prompt = """You are an expert business analyst.

CRITICAL JSON FORMAT REQUIREMENTS:
- Your response MUST be ONLY valid JSON
- Start with { character and end with } character
- NO markdown code blocks (no ``` or ```json)
- NO explanatory text before or after the JSON
- NO comments inside the JSON

Correct format example:
{"project_name": "System", "epics": [], "user_stories": []}

INCORRECT format (DO NOT DO THIS):
```json
{"project_name": "System"}
```

Begin your response now with { character:"""

        return self._invoke_claude(prompt, system_prompt, job_id=job_id, stage="EPICS")

    def generate_functional_tests(
        self,
        user_stories: List[UserStory],
        instructions: str,
        brd_chunks: Optional[List[Dict[str, Any]]] = None,
        gap_fixes: List[Dict[str, str]] = None,
        job_id: str = None
    ) -> Dict[str, Any]:
        """Call B: User Stories → Functional Tests"""

        # Build gap fixes context
        gap_fixes_text = self._build_gap_fixes_context(gap_fixes)

        stories_text = "\n\n".join([
            f"Story {s.id}: {s.title}\n"
            f"As a {s.role}, I want {s.goal} so that {s.benefit}\n"
            f"Source Chunks: {', '.join(s.source_chunks) if s.source_chunks else 'N/A'}\n"
            f"Acceptance Criteria:\n" +
            "\n".join([f"- {ac.text}" for ac in s.acceptance_criteria])
            for s in user_stories
        ])

        chunks_context = ""
        if brd_chunks:
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
      "expected_results": ["string"],
      "source_chunks": ["chunk_1"]
    }}
  ]
}}

Each test should be detailed, specific, and cover the acceptance criteria.
"""

        system_prompt = """You are an expert QA engineer.

CRITICAL JSON FORMAT REQUIREMENTS:
- Your response MUST be ONLY valid JSON
- Start with { character and end with } character
- NO markdown code blocks (no ``` or ```json)
- NO explanatory text before or after the JSON
- NO comments inside the JSON

Correct format example:
{"functional_tests": []}

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
        job_id: str = None
    ) -> Dict[str, Any]:
        """Call C: User Stories + Functional Tests → Gherkin scenarios"""

        stories_text = "\n\n".join([
            f"Story {s.id}: {s.title}\n"
            f"As a {s.role}, I want {s.goal} so that {s.benefit}\n"
            f"Acceptance Criteria:\n" +
            "\n".join([f"- {ac.text}" for ac in s.acceptance_criteria])
            for s in user_stories
        ])

        # Include functional tests as context for Gherkin generation
        functional_tests_text = ""
        if functional_tests:
            functional_tests_text = "\n\nFunctional Tests (for reference):\n"
            for test in functional_tests:
                functional_tests_text += f"\n{test.title}:\n"
                functional_tests_text += f"Objective: {test.objective}\n"
                functional_tests_text += f"Steps: {', '.join(test.test_steps[:3])}{'...' if len(test.test_steps) > 3 else ''}\n"

        prompt = f"""Generate Gherkin BDD scenarios for these user stories.

User Stories:
{stories_text}
{functional_tests_text}

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
      "then": ["string"],
      "source_chunks": ["chunk_1"]
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
{"gherkin_tests": []}

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

        # Build gap fixes context
        gap_fixes_text = self._build_gap_fixes_context(gap_fixes)

        # Send ALL tables with ALL rows (no limits)
        tables_text = "\n\n".join([
            f"## Table {t['table_id']}:\nHeaders: {', '.join(t['headers'])}\n" +
            "\n".join([str(row) for row in t['rows']])  # ALL rows
            for t in brd_data.get('tables', [])  # ALL tables
        ])

        # Send ALL user stories
        stories_text = "\n".join([f"- {s.title}" for s in user_stories])

        prompt = f"""Analyze this BRD and user stories to create a data model.

BRD Tables:
{tables_text if tables_text else 'No tables found'}

User Stories:
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

        # Prepare context from BRD - send ALL content for comprehensive validation
        chunks = brd_data.get('chunks', [])
        chunks_text = "\n\n".join([
            f"## Chunk {c['id']} - {c.get('section_title', 'Section ' + str(c.get('section_id', 'unknown')))}\n"
            f"**Section ID**: {c.get('section_id', 'N/A')}\n"
            f"**Type**: {c['type']}\n"
            f"**Content**:\n{c['text']}"
            for c in chunks  # ALL chunks for complete validation
        ])

        sections_text = "\n\n".join([
            f"## Section {s['id']}: {s['title']}\n{s['text']}"
            for s in brd_data.get('sections', [])  # ALL sections
        ])

        tables_text = "\n\n".join([
            f"## Table {t['table_id']}: {', '.join(t['headers'])}\n" +
            "\n".join([str(row) for row in t['rows']])
            for t in brd_data.get('tables', [])  # ALL tables with ALL rows
        ])

        prompt = f"""Evaluate this Business Requirements Document across 10 Critical-to-Quality (CTQ) dimensions.

BRD Content:
{sections_text}

{tables_text if tables_text else ''}

BRD Chunks (for reference):
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
        """Call G: Validation Gaps → AI-Suggested Fixes"""

        # Send ALL sections for comprehensive gap fix generation
        sections_text = "\n\n".join([
            f"## Section {s['id']}: {s['title']}\n{s['text']}"
            for s in brd_data.get('sections', [])  # ALL sections
        ])

        gap_fixes = []

        for gap in validation_report["key_gaps"][:10]:  # Limit to 10 gaps max
            prompt = f"""A quality gap was identified in this BRD:

Gap: {gap}

BRD Context:
{sections_text}

Generate a specific, actionable fix for this gap.

Output ONLY valid JSON matching this schema:
{{
  "gap_id": "gap_1",
  "gap_description": "{gap}",
  "affected_section": "Section 3.2 - Trade Booking",
  "current_text": "System shall process trades",
  "suggested_fix": "System shall process trade bookings with the following exception handling:\\n- If booking fails due to duplicate trade ID, return error code ERR_DUPLICATE and log to audit table\\n- If booking fails due to invalid counterparty, return error code ERR_INVALID_CP and notify trade desk via email\\n- System shall retry failed bookings up to 3 times with exponential backoff",
  "rationale": "Adding specific exception flows ensures system behavior is well-defined for error scenarios and enables proper testing",
  "confidence": "high"
}}

Be highly specific with:
- Exact threshold values (e.g., "< 200ms" not "fast")
- Concrete examples (e.g., specific error codes)
- Measurable criteria
- Actionable steps

If the gap is about acceptance criteria, use Given-When-Then format.
If the gap is about NFRs, provide specific metrics and SLAs.
"""

            system_prompt = """You are an expert Business Analyst.

CRITICAL JSON FORMAT REQUIREMENTS:
- Your response MUST be ONLY valid JSON
- Start with { character and end with } character
- NO markdown code blocks (no ``` or ```json)
- NO explanatory text before or after the JSON
- NO comments inside the JSON

Correct format example:
{"gap_id": "gap_1", "gap_description": "Missing data", "confidence": "high"}

INCORRECT format (DO NOT DO THIS):
```json
{"gap_id": "gap_1"}
```

Begin your response now with { character:"""

            try:
                fix = self._invoke_claude(prompt, system_prompt, job_id=job_id, stage="GAP_FIXES")
                gap_fixes.append(fix)
            except Exception as e:
                print(f"Error generating fix for gap '{gap}': {str(e)}")
                # Continue with other gaps
                continue

        return gap_fixes

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
