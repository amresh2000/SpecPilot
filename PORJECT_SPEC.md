Nice, this is exactly where Claude Code shines: you already did the thinking here, now you just need to _package_ it so Claude can implement.

I’d do this in two parts:

1. **Create a single, clean spec file from everything we discussed** (so Claude has a source of truth).
2. **Use a structured workflow with Claude Code** so it reads that spec and incrementally builds the repo.

I’ll give you both: a ready-to-paste spec (`PROJECT_SPEC.md`), and a step-by-step way to drive Claude.

---

## 1️⃣ Create a spec file that captures _everything_

Make a new repo and add a file: `docs/PROJECT_SPEC.md`.

Paste something like this inside (you can tweak names/tech if needed):

---

### `docs/PROJECT_SPEC.md`

````markdown
# Project Generator – BRD → Specs → Tests → Code Skeleton

## 1. Goal

Build a web app called **Project Generator**.

Input:

- BRD as `.docx` (or `.txt`) containing sections + tables.
- Optional "Special Instructions" text.
- User's selection of artefacts to generate:
  - EPICs & User Stories
  - Functional Tests (manual test cases)
  - Gherkin Tests (BDD)
  - Data Model (entities + fields + Mermaid diagram)
  - Code Skeleton (backend project layout, e.g. .NET API)

Output (in UI + downloadable ZIP):

- Project name.
- Epics, user stories, acceptance criteria.
- Functional test cases.
- Gherkin feature files / scenarios.
- Entities + field definitions + Mermaid ER diagram.
- Code skeleton: folder tree + file contents skeleton.
- Ability to "zoom in" later and generate more tests for a specific story/section of the BRD.

Phase 1 (hackathon): focus on clean end-to-end demo for a single user, in-memory storage, no auth.

---

## 2. Tech stack

- **Frontend**: React + TypeScript + Vite.
- **Backend**: Python + FastAPI.
- **LLM**: AWS Bedrock (Claude 3.5 Sonnet).
- **File parsing**: `python-docx` for `.docx`.
- **Storage**: in-memory per job + temp files in `generated/{job_id}`.

---

## 3. High-level architecture

### Frontend pages

1. **Project configuration**

   - Textarea: Special instructions.
   - File uploader: BRD `.docx` (support `.txt` as fallback).
   - Checkbox group: EPICs & User Stories, Functional Tests, Gherkin Tests, Data Model, Code Skeleton.
   - "Generate" button.

2. **Generation progress**

   - Left: Generation summary:
     - Special instructions
     - Uploaded files
     - Stats (counts) once results are available
   - Right: Generation progress steps list with status + duration:
     - Parsing documents
     - Generating project name
     - Generating EPICs & User Stories
     - Generating Data Model
     - Generating Functional Tests
     - Generating Gherkin Tests
     - Generating Code Skeleton
   - When completed: buttons
     - "View Generated Results"
     - "Download ZIP"
     - "New Generation"

3. **Project specifications**

   - Left sidebar navigation:
     - EPICs
     - Functional Tests
     - Gherkin Tests
     - Diagrams
     - Summary (counts: epics, stories, functional tests, gherkin tests, entities)
   - Right main panel:
     - **EPICs view**
       - For each epic: name + description.
       - Under each epic: user stories with:
         - Title
         - “As a… I want… So that…” text
         - Acceptance criteria list.
       - Buttons on each story (v2): "Copy", "More tests" (calls a zoom-in backend endpoint).
     - **Functional Tests view**
       - For each test case:
         - Title
         - Objective
         - Preconditions (list)
         - Test steps (numbered)
         - Expected results (list)
     - **Gherkin Tests view**
       - For each scenario:
         - Show `Feature:` / `Scenario:` and `Given/When/Then` as a `<pre>` block.
         - Copy button.
     - **Diagrams view**
       - Entities table:
         - Entity name, description.
         - Fields table (name, type, required).
       - Mermaid diagram text box to show ER diagram source.

4. **Code Skeleton**
   - Tree view of project structure based on backend JSON.
   - When clicking a file: show file content in read-only pane.
   - Button: "Download ZIP".

---

## 4. Backend API contract

### 4.1 Routes

- `POST /api/generate` – start generation pipeline.

  - Multipart:
    - `file`: BRD `.docx` / `.txt`.
    - `payload`: JSON string:
      ```json
      {
        "instructions": "string",
        "artefacts": {
          "epics_and_stories": true,
          "functional_tests": true,
          "gherkin_tests": true,
          "data_model": true,
          "code_skeleton": true
        }
      }
      ```
  - Returns:
    ```json
    { "job_id": "uuid-string" }
    ```

- `GET /api/status/{job_id}` – get generation status + results.

  - Returns:
    ```json
    {
      "status": "pending|running|completed|failed",
      "error": null,
      "steps": [
        { "name": "Parsing documents", "status": "completed", "duration_ms": 800 },
        { "name": "Generating project name", "status": "completed", "duration_ms": 1200 },
        ...
      ],
      "results": {
        "project_name": "User Management System",
        "epics": [...],
        "user_stories": [...],
        "functional_tests": [...],
        "gherkin_tests": [...],
        "entities": [...],
        "mermaid": "erDiagram\n  ...",
        "code_tree": [...],          // for tree view
        "code_skeleton": {...}       // raw structure if needed
      }
    }
    ```

- `GET /api/download/{job_id}` – returns ZIP with:
  - `epics_and_stories.json`
  - `functional_tests.json`
  - `gherkin_tests.feature` (or multiple feature files)
  - `entities.json`
  - `diagram.mmd`
  - `code_skeleton/` folder with generated files.

(Zoom-in endpoints for v2 can be added later.)

---

## 5. BRD parsing

Module: `brd_parser.py`

- Accepts `.docx` and `.txt`.
- For `.docx`:
  - Use `python-docx` to:
    - Extract headings (styles starting with “Heading”) as sections:
      ```json
      { "id": "2.4.1", "title": "Data Exchange", "text": "..." }
      ```
    - Extract paragraphs under each section.
    - Extract tables:
      - First row = headers.
      - Subsequent rows → dicts keyed by header.
      ```json
      {
        "table_id": "Annex_I_Order_Fields",
        "section_id": "4",
        "headers": ["Field Number", "Field Name", "Field Description"],
        "rows": [ { "Field Number": "1", ... }, ... ]
      }
      ```
- For `.txt`:
  - Use simple regex to detect section headings (`^\d+(\.\d+)*`).
- Output:
  ```python
  BRD = {
    "sections": [...],
    "tables": [...],
    "raw_text": "full plain text",
    "chunks": [...]  # optional: atomic chunks with ids for later zoom-in
  }
  ```
````

---

## 6. Data models for generated artefacts

Data structures the backend should produce:

```ts
// Epics & Stories
Epic {
  id: string;
  name: string;
  description: string;
}

UserStory {
  id: string;
  epic_id: string;
  title: string;
  role: string;
  goal: string;
  benefit: string;
  acceptance_criteria: AcceptanceCriterion[];
  source_chunks?: string[]; // BRD chunk ids for zoom-in later
}

AcceptanceCriterion {
  id: string;
  text: string;
  source_chunks?: string[];
}

// Functional tests
FunctionalTest {
  id: string;
  story_id: string;
  title: string;
  objective: string;
  preconditions: string[];
  test_steps: string[];
  expected_results: string[];
  source_chunks?: string[];
}

// Gherkin tests
GherkinScenario {
  id: string;
  story_id: string;
  feature_name: string;
  scenario_name: string;
  given: string[];
  when: string[];
  then: string[];
}

// Data model
Entity {
  name: string;
  description: string;
  fields: EntityField[];
}

EntityField {
  name: string;
  type: string;
  required: boolean;
}

// Code skeleton
CodeSkeleton {
  language: "dotnet";
  root_folder: string; // e.g. "src"
  folders: CodeFolder[];
}

CodeFolder {
  path: string; // e.g. "src/UserManagement.Api/Controllers"
  files: CodeFile[];
}

CodeFile {
  name: string;
  content: string;
}
```

---

## 7. LLM calls (Bedrock / Claude 3.5 Sonnet)

### Call A — BRD → project_name + epics + user stories + acceptance criteria

- Input:

  - Relevant BRD text (for v1 we can send most of it).
  - Any tables if helpful.
  - Special instructions.

- Output must conform to JSON schema:

  ```json
  {
    "project_name": "string",
    "epics": [ Epic... ],
    "user_stories": [ UserStory... ]
  }
  ```

- Stories should use classic format:

  - `As a <role>, I want <goal> so that <benefit>.`
  - AC should be concrete and testable.

### Call B — UserStories → FunctionalTests

- Input:

  - Array of `user_stories`.
  - Special instructions.

- Output:

  ```json
  {
    "functional_tests": [ FunctionalTest... ]
  }
  ```

### Call C — UserStories → Gherkin scenarios

- Input:

  - Array of `user_stories` with AC.

- Output:

  ```json
  {
    "gherkin_tests": [ GherkinScenario... ]
  }
  ```

Backend then formats these into `.feature` syntax for display/download.

### Call D — BRD (+ stories) → Entities & Mermaid

- Input:

  - BRD sections (especially any “Data model” / “Annex” / field tables).
  - Existing `user_stories`.

- Output:

  ```json
  {
    "entities": [ Entity... ],
    "mermaid": "erDiagram\n  ...\n"
  }
  ```

### Call E — project_name + entities → Code skeleton

- Input:

  - `project_name`
  - `entities`

- Output:

  ```json
  {
    "code_skeleton": CodeSkeleton
  }
  ```

Backend writes this to disk and builds a tree for frontend.

All calls must instruct Claude to use `response_format: json` and follow the schemas exactly; backend should validate and retry if parsing fails.

---

## 8. Zoom-in (v2 idea)

Not required for first demo but useful to keep in mind:

- When generating artefacts, also store `source_chunks` (BRD chunk IDs used as context).
- Later endpoints:

  - `POST /api/stories/{id}/more-tests`

    - Lookup story’s `source_chunks`.
    - Fetch those BRD chunks.
    - Ask LLM to generate additional tests based only on those chunks and existing tests.

- Frontend will add a "More tests" button on a story card to call this.

```

---

That’s the spec I’d hand to Claude Code.

---

## 2️⃣ How to work with Claude Code step-by-step

Now that you have a single spec:

### Step 1 – Create repo and seed files

1. Create a new Git repo.
2. Add:
   - `docs/PROJECT_SPEC.md` (from above).
   - Empty folders:
     - `backend/`
     - `frontend/`
3. Commit.

### Step 2 – Attach repo to Claude Code

In Claude (web or desktop) with Code:

- Open the repo folder.
- Ask something like:

> “Read `docs/PROJECT_SPEC.md`.
> Create a FastAPI backend in `backend/` and a React+Vite+TypeScript frontend in `frontend/` that follow this spec.
> Start by scaffolding the project structure and basic API routes (`/api/generate`, `/api/status/{job_id}`, `/api/download/{job_id}`) with dummy data. Don’t call Bedrock yet.”

Let Claude generate the scaffolding. Run it locally, fix small issues.

### Step 3 – Implement backend logic in phases

Drive Claude through *focused* tasks, one file/feature at a time:

1. **BRD parser**
   - Prompt:
     > “Implement `backend/app/services/brd_parser.py` as described in section 5 of PROJECT_SPEC.md. Accept `.docx` and `.txt`. Return a `BRD` dict with sections, tables, raw_text. Use `python-docx`.”
2. **Job manager & status model**
   - Implement `jobs.py` that holds job state in memory.
3. **LLM client wrapper**
   - Implement `llm_client.py` with stubbed methods for Calls A–E.
   - Initially, return hard-coded JSON so frontend can work.
4. **Generation pipeline**
   - Wire `/api/generate` to:
     - parse BRD
     - call stubbed LLM methods
     - update job steps and results.

At each step, ask Claude:

> “Here is `PROJECT_SPEC.md` and the current `backend/app/...` files. Implement X following the spec and existing code style.”

### Step 4 – Once backend skeleton works, connect Bedrock

When the pipeline works with stubs:

- Ask Claude to implement real Call A using Bedrock Python SDK, following the JSON schema.
- Then Call B, Call C, etc.
- Provide your AWS credentials as environment variables, not in code.

### Step 5 – Build frontend UX

Similarly, guide Claude:

1. Scaffold pages and routing using the spec.
2. Implement Project Configuration screen:
   - Form, file upload, checkboxes, `Generate` → call `/api/generate`.
3. Implement polling of `/api/status/{job_id}` and the progress panel.
4. Implement Project Specifications views that render the JSON shape.
5. Implement Code Skeleton tree view from `results.code_tree`.

Always remind Claude:

> “Conform to the JSON shape returned by `/api/status` as described in `PROJECT_SPEC.md`.”

### Step 6 – Iterate & polish

Once basic flow works:

- Ask Claude to:
  - Improve layout to resemble your screenshot (navigation, panels).
  - Add copy buttons.
  - Add ZIP download.
- If time: add zoom-in API & button.

---

## 3️⃣ How to “transfer knowledge” in practice

In short:

- **Put the brain (spec) in the repo**, not just in the chat.
- Point Claude to that file constantly.
- Break work into **small, testable tasks** (one module/feature at a time).
- After each Claude change:
  - Run `pytest` or `uvicorn` / `npm run dev` locally.
  - Fix runtime errors with Claude by pasting logs.

If you want, I can next:

- Write a minimal `backend/README.md` and `frontend/README.md` that you can also drop in, so Claude knows how to structure the projects and what commands to set up.
```
