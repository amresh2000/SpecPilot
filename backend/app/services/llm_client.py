import json
import time
import boto3
from botocore.config import Config
from botocore.exceptions import ClientError
from typing import Dict, Any, List, Optional
from app.models import (
    Epic, UserStory, AcceptanceCriterion, FunctionalTest,
    GherkinScenario, Entity, EntityField, CodeSkeleton, CodeFolder, CodeFile
)


class BedrockLLMClient:
    """AWS Bedrock client for Claude 3.5 Sonnet"""

    def __init__(self, region_name: str = "us-east-1"):
        # Configure boto3 to disable automatic retries (we handle retries manually)
        config = Config(
            retries={
                'max_attempts': 1,  # Disable boto3 automatic retries
                'mode': 'standard'
            }
        )
        self.client = boto3.client('bedrock-runtime', region_name=region_name, config=config)
        # Use inference profile ID for Claude 3.5 Sonnet v2 (required for on-demand throughput)
        self.model_id = "us.anthropic.claude-3-5-sonnet-20241022-v2:0"
        self.max_retries = 5  # Increased from 1 to 5
        self.base_delay = 2  # Base delay in seconds for exponential backoff

    def _invoke_claude(self, prompt: str, system_prompt: str = "") -> Dict[str, Any]:
        """Invoke Claude with exponential backoff retry logic for throttling"""
        last_error = None

        for attempt in range(self.max_retries + 1):
            try:
                # Prepare request
                messages = [{"role": "user", "content": prompt}]

                request_body = {
                    "anthropic_version": "bedrock-2023-05-31",
                    "max_tokens": 4096,
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
                content = response_body['content'][0]['text']

                # Try to parse as JSON
                return json.loads(content)

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
        instructions: str
    ) -> Dict[str, Any]:
        """Call A: BRD → project_name + epics + user stories"""

        # Prepare context from BRD
        chunks = brd_data.get('chunks', [])
        chunks_text = "\n".join([
            f"Chunk {c['id']} ({c['type']}): {c['text'][:200]}"
            for c in chunks[:30]  # Limit to first 30 chunks
        ])

        sections_text = "\n\n".join([
            f"Section {s['id']}: {s['title']}\n{s['text']}"
            for s in brd_data.get('sections', [])[:10]  # Limit to first 10 sections
        ])

        tables_text = "\n\n".join([
            f"Table {t['table_id']}: {', '.join(t['headers'])}\n" +
            "\n".join([str(row) for row in t['rows'][:5]])
            for t in brd_data.get('tables', [])[:5]  # Limit to first 5 tables
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

        system_prompt = "You are an expert business analyst. Output only valid JSON, no markdown formatting."

        return self._invoke_claude(prompt, system_prompt)

    def generate_functional_tests(
        self,
        user_stories: List[UserStory],
        instructions: str,
        brd_chunks: Optional[List[Dict[str, Any]]] = None
    ) -> Dict[str, Any]:
        """Call B: User Stories → Functional Tests"""

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
            chunks_context = "\n\nRelevant BRD Chunks:\n" + "\n".join([
                f"Chunk {c['id']} ({c['type']}): {c['text'][:200]}"
                for c in brd_chunks
            ])

        prompt = f"""Generate functional test cases for these user stories.

User Stories:
{stories_text}
{chunks_context}

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

        system_prompt = "You are an expert QA engineer. Output only valid JSON, no markdown formatting."

        return self._invoke_claude(prompt, system_prompt)

    def generate_gherkin_tests(
        self,
        user_stories: List[UserStory]
    ) -> Dict[str, Any]:
        """Call C: User Stories → Gherkin scenarios"""

        stories_text = "\n\n".join([
            f"Story {s.id}: {s.title}\n"
            f"As a {s.role}, I want {s.goal} so that {s.benefit}\n"
            f"Acceptance Criteria:\n" +
            "\n".join([f"- {ac.text}" for ac in s.acceptance_criteria])
            for s in user_stories
        ])

        prompt = f"""Generate Gherkin BDD scenarios for these user stories.

User Stories:
{stories_text}

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

        system_prompt = "You are an expert in BDD and Gherkin syntax. Output only valid JSON, no markdown formatting."

        return self._invoke_claude(prompt, system_prompt)

    def generate_data_model(
        self,
        brd_data: Dict[str, Any],
        user_stories: List[UserStory]
    ) -> Dict[str, Any]:
        """Call D: BRD + stories → Entities + Mermaid"""

        # Focus on data-related sections and tables
        tables_text = "\n\n".join([
            f"Table {t['table_id']}:\nHeaders: {', '.join(t['headers'])}\n" +
            "\n".join([str(row) for row in t['rows'][:10]])
            for t in brd_data.get('tables', [])
        ])

        stories_text = "\n".join([f"- {s.title}" for s in user_stories[:20]])

        prompt = f"""Analyze this BRD and user stories to create a data model.

BRD Tables:
{tables_text if tables_text else 'No tables found'}

User Stories:
{stories_text}

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

        system_prompt = "You are an expert data architect. Output only valid JSON, no markdown formatting."

        return self._invoke_claude(prompt, system_prompt)

    def generate_code_skeleton(
        self,
        project_name: str,
        entities: List[Entity]
    ) -> Dict[str, Any]:
        """Call E: Entities → ASP.NET Code Skeleton"""

        entities_text = "\n".join([
            f"- {e.name}: {', '.join([f.name for f in e.fields])}"
            for e in entities
        ])

        prompt = f"""Generate an ASP.NET Core API code skeleton for this project.

Project Name: {project_name}

Entities:
{entities_text}

Output must be valid JSON matching this schema:
{{
  "code_skeleton": {{
    "language": "dotnet",
    "root_folder": "src",
    "folders": [
      {{
        "path": "src/ProjectName.Api/Controllers",
        "files": [
          {{
            "name": "EntityController.cs",
            "content": "using Microsoft.AspNetCore.Mvc;\\n\\nnamespace ProjectName.Api.Controllers\\n{{\\n    [ApiController]\\n    [Route(\\"api/[controller]\\")]\\n    public class EntityController : ControllerBase\\n    {{\\n        // TODO: Implement CRUD operations\\n    }}\\n}}"
          }}
        ]
      }}
    ]
  }}
}}

Generate:
1. Controllers for each entity (CRUD endpoints)
2. Models/DTOs
3. Services/Repository interfaces
4. Program.cs and Startup configuration
5. appsettings.json

Use proper ASP.NET Core 8.0 patterns and structure.
"""

        system_prompt = "You are an expert .NET architect. Output only valid JSON, no markdown formatting."

        return self._invoke_claude(prompt, system_prompt)
