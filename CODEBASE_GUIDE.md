# SpecPilot - Codebase Guide

Complete file-by-file explanation of the SpecPilot codebase for developers.

## Table of Contents

1. [Backend Files](#backend-files)
   - [Core Application](#core-application)
   - [Models & Schemas](#models--schemas)
   - [Routes & Endpoints](#routes--endpoints)
   - [Services](#services)
2. [Frontend Files](#frontend-files)
   - [Core Components](#core-components)
   - [Pages](#pages)
   - [UI Components](#ui-components)
   - [Utilities](#utilities)
3. [Configuration Files](#configuration-files)
4. [Documentation](#documentation)

---

## Backend Files

### Core Application

#### [backend/app/main.py](backend/app/main.py)
**Purpose**: FastAPI application entry point and configuration

**What it does**:
- Creates the FastAPI application instance
- Configures CORS middleware for local development (ports 5173-5175)
- Loads and validates AWS credentials from environment variables
- Includes route modules (generation, staged_endpoints)
- Provides health check endpoint

**Key code**:
```python
app = FastAPI(title="Project Generator API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:5174", "http://localhost:5175"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(generation.router, prefix="/api")
app.include_router(staged_endpoints.router, prefix="/api")
```

**When to edit**: Add new routers, change CORS settings, modify startup validation

---

#### [backend/app/config.py](backend/app/config.py)
**Purpose**: Environment configuration and AWS setup

**What it does**:
- Loads environment variables from .env file using python-dotenv
- Provides AWS credentials (access key, secret key, region)
- Configures proxy settings for corporate environments
- Validates required environment variables at startup

**Key code**:
```python
class Config:
    AWS_ACCESS_KEY_ID = os.getenv('AWS_ACCESS_KEY_ID')
    AWS_SECRET_ACCESS_KEY = os.getenv('AWS_SECRET_ACCESS_KEY')
    AWS_REGION = os.getenv('AWS_REGION', 'us-east-1')
    HTTP_PROXY = os.getenv('HTTP_PROXY')
    HTTPS_PROXY = os.getenv('HTTPS_PROXY')

    def validate(self):
        if not self.AWS_ACCESS_KEY_ID or not self.AWS_SECRET_ACCESS_KEY:
            raise ValueError("AWS credentials not configured")
```

**When to edit**: Add new environment variables, change default values, modify validation logic

---

### Models & Schemas

#### [backend/app/models/schemas.py](backend/app/models/schemas.py)
**Purpose**: Pydantic models for data validation and serialization

**What it does**:
- Defines all data structures used in the application
- Provides automatic validation and serialization
- Documents the API contract with type hints

**Key models**:
```python
class GapFix(BaseModel):
    id: str
    gap_type: str
    issue: str
    suggestion: str
    user_action: Optional[str] = None
    final_text: Optional[str] = None

class Epic(BaseModel):
    id: str
    name: str
    description: str
    story_ids: List[str] = []

class UserStory(BaseModel):
    id: str
    epic_id: str
    title: str
    role: str
    goal: str
    benefit: str
    acceptance_criteria: List[AcceptanceCriterion] = []
    source_chunks: List[str] = []

class FunctionalTest(BaseModel):
    id: str
    story_id: str
    title: str
    objective: str
    preconditions: List[str] = []
    test_steps: List[str] = []
    expected_results: List[str] = []

class GherkinScenario(BaseModel):
    id: str
    story_id: str
    feature_name: str
    scenario_name: str
    given: List[str] = []
    when: List[str] = []
    then: List[str] = []

class Entity(BaseModel):
    id: str
    name: str
    attributes: List[Attribute] = []
    relationships: List[Relationship] = []

class PipelineStage(str, Enum):
    VALIDATION = "validation"
    EPICS = "epics"
    FUNCTIONAL_TESTS = "functional_tests"
    GHERKIN_TESTS = "gherkin_tests"
    DATA_MODEL = "data_model"
    CODE_GENERATION = "code_generation"
```

**When to edit**: Add new artifact types, modify data structures, add validation rules

---

#### [backend/app/models/__init__.py](backend/app/models/__init__.py)
**Purpose**: Model exports for easy importing

**What it does**:
- Re-exports all models from schemas.py
- Provides a single import point for models

**When to edit**: Add new model exports when creating new schemas

---

### Routes & Endpoints

#### [backend/app/routes/generation.py](backend/app/routes/generation.py)
**Purpose**: CRUD and generation endpoints for artifacts

**What it does**:
- Handles BRD upload and validation
- Manages job status queries
- Provides update endpoints for epics, stories, tests
- Handles deletion of artifacts
- Manages artifact regeneration

**Key endpoints**:
```python
@router.post("/validate-brd")
async def validate_brd(file: UploadFile, payload: str = Form(...)):
    # Parse BRD file (PDF/DOCX/TXT)
    # Run gap detection with LLM
    # Return gaps and suggested fixes

@router.get("/status/{job_id}")
async def get_status(job_id: str):
    # Returns job status and all generated artifacts
    # Used by frontend for polling

@router.put("/update-epic/{job_id}/{epic_id}")
async def update_epic(job_id: str, epic_id: str, name: str, description: str):
    # Updates epic in job state
    # Returns updated epic

@router.put("/update-story/{job_id}/{story_id}")
async def update_story(job_id: str, story_id: str, ...):
    # Updates user story
    # Returns updated story

@router.put("/update-functional-test/{job_id}/{test_id}")
async def update_functional_test(job_id: str, test_id: str, ...):
    # Updates functional test case

@router.put("/update-gherkin-test/{job_id}/{test_id}")
async def update_gherkin_test(job_id: str, test_id: str, ...):
    # Updates Gherkin BDD scenario

@router.delete("/delete-epic/{job_id}/{epic_id}")
async def delete_epic(job_id: str, epic_id: str):
    # Deletes epic and all associated stories

@router.delete("/delete-story/{job_id}/{story_id}")
async def delete_story(job_id: str, story_id: str):
    # Deletes story and cleans up references

@router.delete("/delete-test/{job_id}/{test_id}")
async def delete_test(job_id: str, test_id: str, test_type: str):
    # Deletes functional or gherkin test

@router.post("/regenerate-story-tests/{job_id}/{story_id}")
async def regenerate_story_tests(job_id: str, story_id: str):
    # Regenerates tests for a specific story

@router.get("/download/{job_id}")
async def download_project(job_id: str):
    # Creates ZIP with Java Selenium + Cucumber code
    # Returns downloadable file
```

**When to edit**: Add new CRUD operations, modify artifact update logic, add new download formats

---

#### [backend/app/routes/staged_endpoints.py](backend/app/routes/staged_endpoints.py)
**Purpose**: Pipeline progression and stage-specific generation

**What it does**:
- Manages progression through pipeline stages
- Runs stage-specific generation in background tasks
- Handles "generate more" requests for incremental artifact creation
- Tracks stage history and completion

**Key endpoints**:
```python
@router.post("/proceed-to-stage/{job_id}")
async def proceed_to_stage(job_id: str, next_stage: str, background_tasks: BackgroundTasks):
    # Validates stage transition
    # Runs stage-specific generation:
    #   - EPICS: generate_epics_and_stories()
    #   - FUNCTIONAL_TESTS: generate_functional_tests()
    #   - GHERKIN_TESTS: generate_gherkin_tests()
    #   - DATA_MODEL: generate_data_model()
    #   - CODE_GENERATION: generate_code_skeleton()
    # Returns immediately, generation runs in background

@router.post("/generate-more/{job_id}")
async def generate_more(job_id: str, request: GenerateMoreRequest, background_tasks: BackgroundTasks):
    # Generates additional artifacts at current stage
    # Uses user instructions to guide generation
    # Can target specific context (e.g., specific stories)
    # Appends to existing artifacts
```

**When to edit**: Add new pipeline stages, modify stage generation logic, change background task handling

---

### Services

#### [backend/app/services/brd_parser.py](backend/app/services/brd_parser.py)
**Purpose**: Document parsing for BRD files

**What it does**:
- Parses PDF files using PyMuPDF (fitz)
- Parses DOCX files using python-docx
- Parses TXT files directly
- Chunks documents into semantic sections
- Extracts text with metadata (page numbers, chunk IDs)

**Key functions**:
```python
def parse_brd(file_path: str) -> dict:
    # Detects file type and routes to appropriate parser
    # Returns structured data with chunks and metadata

def parse_pdf(file_path: str) -> dict:
    # Extracts text from PDF pages
    # Creates chunks with page metadata

def parse_docx(file_path: str) -> dict:
    # Extracts paragraphs from Word documents
    # Creates chunks with structural metadata

def chunk_text(text: str, chunk_size: int = 2000) -> List[dict]:
    # Splits text into semantic chunks
    # Maintains context across chunk boundaries
```

**When to edit**: Add new document formats, modify chunking strategy, change metadata extraction

---

#### [backend/app/services/llm_client.py](backend/app/services/llm_client.py)
**Purpose**: AWS Bedrock LLM integration

**What it does**:
- Manages boto3 client for AWS Bedrock
- Handles retry logic with exponential backoff
- Provides prompt templates for each generation type
- Parses JSON responses from Claude 3.5 Sonnet
- Manages timeout and error handling

**Key code**:
```python
class BedrockLLMClient:
    def __init__(self):
        self.bedrock = boto3.client(
            service_name='bedrock-runtime',
            region_name=config.AWS_REGION,
            config=Config(
                read_timeout=300,  # 5 minutes
                connect_timeout=60,
                retries={'max_attempts': 5}
            )
        )
        self.model_id = "us.anthropic.claude-3-5-sonnet-20241022-v2:0"
        self.max_retries = 5
        self.base_delay = 2

    def invoke_model(self, prompt: str, max_tokens: int = 16384) -> dict:
        # Retries with exponential backoff: 2s → 4s → 8s → 16s → 32s
        # Handles throttling and timeout errors
        # Returns parsed JSON response

    def detect_gaps(self, brd_data: dict, instructions: str) -> dict:
        # Detects missing requirements, ambiguities, inconsistencies

    def generate_epics_and_stories(self, brd_data: dict, instructions: str, gap_fixes: list, existing_epics: list) -> dict:
        # Creates EPICs and User Stories from BRD

    def generate_functional_tests(self, stories: list, instructions: str, brd_chunks: list, gap_fixes: list) -> dict:
        # Creates functional test cases from stories

    def generate_gherkin_tests(self, stories: list, functional_tests: list, instructions: str, gap_fixes: list) -> dict:
        # Creates Gherkin BDD scenarios

    def generate_data_model(self, stories: list, functional_tests: list, gap_fixes: list) -> dict:
        # Extracts entities, attributes, relationships
```

**When to edit**: Change model, modify prompts, adjust retry logic, change timeout values

---

#### [backend/app/services/generation_pipeline.py](backend/app/services/generation_pipeline.py)
**Purpose**: Orchestrates multi-stage generation workflow

**What it does**:
- Coordinates all generation stages
- Manages dependencies between stages
- Saves intermediate results to job state
- Handles error propagation and recovery

**Key code**:
```python
class GenerationPipeline:
    def __init__(self, job_id: str, brd_file_path: str):
        self.job_id = job_id
        self.job = job_manager.get_job(job_id)
        self.brd_file_path = brd_file_path
        self.llm_client = BedrockLLMClient()

    async def _parse_brd(self):
        # Parses BRD and saves to job.brd_data

    async def _generate_epics_and_stories(self):
        # Uses gap fixes and BRD to create epics/stories

    async def _generate_functional_tests(self):
        # Uses stories to create functional tests

    async def _generate_gherkin_tests(self):
        # Uses functional tests to create Gherkin scenarios

    async def _generate_data_model(self):
        # Extracts entities from stories and tests

    async def _generate_code_skeleton(self):
        # Creates Java Selenium + Cucumber framework
```

**When to edit**: Add new stages, modify stage dependencies, change error handling

---

#### [backend/app/services/java_code_generator.py](backend/app/services/java_code_generator.py)
**Purpose**: Generates Java Selenium + Cucumber test automation framework

**What it does**:
- Creates complete Maven project structure
- Generates Page Object Model classes for each entity
- Creates Cucumber feature files from Gherkin scenarios
- Generates step definition stubs
- Creates configuration files (pom.xml, TestRunner, etc.)
- Packages everything into a ZIP file

**Key functions**:
```python
def generate_java_project(job_id: str, entities: List[Entity], gherkin_tests: List[GherkinScenario]) -> str:
    # Creates project structure:
    # - src/main/java/pages/ (Page Objects)
    # - src/test/java/stepdefs/ (Step Definitions)
    # - src/test/resources/features/ (Feature Files)
    # - pom.xml (Maven dependencies)
    # - TestRunner.java (Cucumber runner)
    # Returns path to ZIP file

def generate_page_object(entity: Entity) -> str:
    # Creates Selenium Page Object class
    # Includes WebElement locators for each attribute
    # Adds basic interaction methods

def generate_feature_file(scenario: GherkinScenario) -> str:
    # Converts GherkinScenario to Cucumber .feature file

def generate_step_definitions(scenarios: List[GherkinScenario]) -> str:
    # Creates step definition stubs
    # Maps Gherkin steps to Java methods
```

**When to edit**: Change code generation templates, add new file types, modify project structure

---

#### [backend/app/services/job_manager.py](backend/app/services/job_manager.py)
**Purpose**: In-memory job state management

**What it does**:
- Stores all job data in-memory (jobs reset on server restart)
- Manages job lifecycle (created → processing → completed/failed)
- Tracks pipeline stage history
- Provides thread-safe access to job state

**Key code**:
```python
class JobManager:
    def __init__(self):
        self._jobs = {}  # In-memory storage

    def create_job(self, job_id: str, instructions: str) -> JobState:
        # Creates new job with initial state

    def get_job(self, job_id: str) -> Optional[JobState]:
        # Retrieves job by ID

    def update_job_results(self, job_id: str, results: GenerationResults):
        # Updates job with new artifacts

class JobState:
    job_id: str
    status: str  # "created", "processing", "completed", "failed"
    current_stage: PipelineStage
    stage_history: List[StageCompletion]
    instructions: str
    brd_data: dict
    results: GenerationResults

    def advance_stage(self, next_stage: PipelineStage):
        # Moves to next pipeline stage

    def complete_current_stage(self):
        # Marks current stage as completed

    def mark_failed(self, error: str):
        # Marks job as failed with error message
```

**When to edit**: Add persistent storage (Redis/PostgreSQL), modify state transitions, add job cleanup

---

## Frontend Files

### Core Components

#### [frontend/src/main.tsx](frontend/src/main.tsx)
**Purpose**: React application entry point

**What it does**:
- Renders the root React component
- Mounts the application to the DOM
- Imports global CSS styles

**Key code**:
```tsx
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
```

**When to edit**: Add global providers, change mount point, add global error boundaries

---

#### [frontend/src/App.tsx](frontend/src/App.tsx)
**Purpose**: Root component with routing configuration

**What it does**:
- Sets up React Router for navigation
- Defines all application routes
- Wraps application in ToastProvider for notifications

**Key code**:
```tsx
function App() {
  return (
    <ToastProvider>
      <Router>
        <Routes>
          <Route path="/" element={<ConfigurationPage />} />
          <Route path="/validation/:jobId" element={<ValidationPage />} />
          <Route path="/epics/:jobId" element={<EpicsRefinementPage />} />
          <Route path="/functional-tests/:jobId" element={<FunctionalTestsRefinementPage />} />
          <Route path="/gherkin-tests/:jobId" element={<GherkinTestsRefinementPage />} />
          <Route path="/data-model/:jobId" element={<DataModelPage />} />
          <Route path="/code/:jobId" element={<CodeSkeletonPage />} />
          <Route path="/summary/:jobId" element={<SummaryPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
    </ToastProvider>
  );
}
```

**When to edit**: Add new routes, change default route, add global layout components

---

### Pages

#### [frontend/src/pages/ConfigurationPage.tsx](frontend/src/pages/ConfigurationPage.tsx)
**Purpose**: Initial BRD upload and validation

**What it does**:
- Provides file upload interface (drag-and-drop or click)
- Accepts PDF, DOCX, TXT files
- Collects user instructions for generation
- Calls `/api/validate-brd` endpoint
- Navigates to ValidationPage on success

**Key features**:
- File type validation
- Preview of selected file
- Loading state during upload
- Error handling with toast notifications

**When to edit**: Add file type support, modify upload UI, change validation logic

---

#### [frontend/src/pages/ValidationPage.tsx](frontend/src/pages/ValidationPage.tsx)
**Purpose**: Gap review and fixing stage

**What it does**:
- Displays detected gaps (missing requirements, ambiguities, inconsistencies)
- Allows user to accept, edit, or reject each gap fix
- Tracks user decisions for each gap
- Proceeds to EPICS stage when ready

**Key features**:
- Inline editing of gap suggestions
- Three actions per gap: Accept, Edit, Reject
- Collapsible gap cards
- Progress indicator showing current stage

**When to edit**: Add new gap types, modify gap display, change action buttons

---

#### [frontend/src/pages/EpicsRefinementPage.tsx](frontend/src/pages/EpicsRefinementPage.tsx)
**Purpose**: EPIC and User Story editing

**What it does**:
- Displays all generated EPICs and their User Stories
- Allows editing of epic name/description
- Allows editing of story details and acceptance criteria
- Provides "Generate More" functionality for additional artifacts
- Proceeds to Functional Tests stage

**Key features**:
- Hierarchical view (EPICs → Stories → Acceptance Criteria)
- Inline editing with save/cancel
- Delete functionality for epics and stories
- Real-time updates via polling

**When to edit**: Add story templates, modify epic structure, change edit behavior

---

#### [frontend/src/pages/FunctionalTestsRefinementPage.tsx](frontend/src/pages/FunctionalTestsRefinementPage.tsx)
**Purpose**: Functional test case editing

**What it does**:
- Displays all functional test cases
- Groups tests by user story
- Allows editing of test details (title, objective, preconditions, steps, expected results)
- Provides "Generate More" functionality
- Proceeds to Gherkin Tests stage

**Key features**:
- Organized by story for context
- Step-by-step editing (preconditions, test steps, expected results)
- Delete and regenerate functionality
- Progress indicator

**When to edit**: Add test templates, modify test structure, change grouping logic

---

#### [frontend/src/pages/GherkinTestsRefinementPage.tsx](frontend/src/pages/GherkinTestsRefinementPage.tsx)
**Purpose**: Gherkin BDD scenario editing

**What it does**:
- Displays all Gherkin scenarios (Feature, Scenario, Given/When/Then)
- Allows editing of each Gherkin component
- Provides "Generate More" functionality
- Proceeds to Data Model stage

**Key features**:
- BDD-style editing interface
- Given/When/Then step management
- Feature and Scenario name editing
- Delete functionality

**When to edit**: Add Gherkin templates, modify BDD structure, change step editing

---

#### [frontend/src/pages/DataModelPage.tsx](frontend/src/pages/DataModelPage.tsx)
**Purpose**: Entity-Relationship model display

**What it does**:
- Displays all extracted entities with attributes and relationships
- Shows entity details (name, attributes, types)
- Shows relationships between entities
- Triggers code generation
- Proceeds to Code Skeleton stage

**Key features**:
- Entity cards with attribute lists
- Relationship visualization
- "Generate Code Skeleton" button
- Loading states during generation

**When to edit**: Add ER diagram visualization, modify entity display, add relationship editing

---

#### [frontend/src/pages/CodeSkeletonPage.tsx](frontend/src/pages/CodeSkeletonPage.tsx)
**Purpose**: Code generation and download

**What it does**:
- Displays code generation status
- Shows generated file structure
- Provides download button for ZIP file
- Shows instructions for using the generated code

**Key features**:
- File tree visualization
- Download link to ZIP
- Setup instructions
- Technology stack display

**When to edit**: Add code preview, modify download format, change instructions

---

#### [frontend/src/pages/SummaryPage.tsx](frontend/src/pages/SummaryPage.tsx)
**Purpose**: Final summary and download

**What it does**:
- Displays complete project summary
- Shows statistics (epic count, story count, test count, entity count)
- Provides final download link
- Shows next steps

**Key features**:
- Comprehensive statistics
- Final download button
- Project overview
- Success confirmation

**When to edit**: Add summary statistics, modify display format, add export options

---

### UI Components

#### [frontend/src/components/EditableEpic.tsx](frontend/src/components/EditableEpic.tsx)
**Purpose**: Editable EPIC component

**What it does**:
- Displays epic in view or edit mode
- Handles inline editing with save/cancel
- Manages associated user stories
- Provides delete functionality

**Key features**:
- Toggle between view and edit modes
- Auto-save on blur
- Nested story components
- Collapsible card

**When to edit**: Modify epic display, change edit behavior, add validation

---

#### [frontend/src/components/EditableStory.tsx](frontend/src/components/EditableStory.tsx)
**Purpose**: Editable User Story component

**What it does**:
- Displays story in user story format ("As a [role], I want [goal], so that [benefit]")
- Handles inline editing of all story fields
- Manages acceptance criteria editing
- Provides delete and regenerate functionality

**Key features**:
- User story template editing
- Acceptance criteria list management
- Inline save/cancel
- Regenerate tests button

**When to edit**: Modify story template, change acceptance criteria editing, add validation

---

#### [frontend/src/components/EditableFunctionalTest.tsx](frontend/src/components/EditableFunctionalTest.tsx)
**Purpose**: Editable Functional Test component

**What it does**:
- Displays test case with title, objective, preconditions, steps, expected results
- Handles inline editing of all test fields
- Manages step lists (add, edit, delete)
- Provides delete functionality

**Key features**:
- Step-by-step editing
- Add/remove steps
- Inline save/cancel
- Collapsible card

**When to edit**: Modify test display, change step editing, add test templates

---

#### [frontend/src/components/EditableGherkinTest.tsx](frontend/src/components/EditableGherkinTest.tsx)
**Purpose**: Editable Gherkin Scenario component

**What it does**:
- Displays Gherkin scenario with Feature, Scenario, Given/When/Then
- Handles inline editing of all Gherkin components
- Manages step lists for Given/When/Then
- Provides delete functionality

**Key features**:
- BDD-style step editing
- Add/remove steps for each section
- Inline save/cancel
- Gherkin syntax highlighting

**When to edit**: Modify Gherkin display, change step editing, add BDD templates

---

#### [frontend/src/components/GenerateMorePanel.tsx](frontend/src/components/GenerateMorePanel.tsx)
**Purpose**: Panel for generating additional artifacts

**What it does**:
- Provides expandable panel for "Generate More" functionality
- Accepts user instructions for additional generation
- Triggers API call to `/api/generate-more`
- Polls for updates after generation starts

**Key features**:
- Collapsible panel
- Instruction textarea
- Loading state during generation
- Auto-polling for results

**When to edit**: Change polling interval, modify instruction UI, add context selection

---

#### [frontend/src/components/StageProgressIndicator.tsx](frontend/src/components/StageProgressIndicator.tsx)
**Purpose**: Visual progress indicator for pipeline stages

**What it does**:
- Displays all pipeline stages
- Highlights current stage
- Shows completed stages
- Provides visual feedback on progress

**Key features**:
- Stage icons
- Progress line
- Current stage highlighting
- Completion checkmarks

**When to edit**: Add new stages, modify icons, change styling

---

#### [frontend/src/components/ui/](frontend/src/components/ui/)
**Purpose**: Reusable UI components

**Files**:
- `Button.tsx` - Customizable button component
- `Card.tsx` - Card container component
- `ToastContainer.tsx` - Toast notification system
- `Input.tsx` - Form input component
- `Textarea.tsx` - Form textarea component

**When to edit**: Add new UI components, modify styling, change variants

---

### Utilities

#### [frontend/src/lib/api.ts](frontend/src/lib/api.ts)
**Purpose**: API client for backend communication

**What it does**:
- Provides typed functions for all API endpoints
- Handles FormData creation for file uploads
- Uses axios for HTTP requests
- Provides centralized error handling

**Key functions**:
```typescript
api.generate(file, request) // Upload BRD and start generation
api.validateBRD(file, request) // Validate BRD and detect gaps
api.getStatus(jobId) // Poll for job status
api.updateEpic(jobId, epicId, ...) // Update epic
api.updateStory(jobId, storyId, ...) // Update story
api.updateFunctionalTest(jobId, testId, ...) // Update test
api.updateGherkinTest(jobId, testId, ...) // Update scenario
api.deleteEpic(jobId, epicId) // Delete epic
api.deleteStory(jobId, storyId) // Delete story
api.deleteTest(jobId, testId, testType) // Delete test
api.proceedToStage(jobId, nextStage) // Advance pipeline
api.generateMore(jobId, request) // Generate more artifacts
api.getDownloadUrl(jobId) // Get download URL
```

**When to edit**: Add new endpoints, modify request format, change error handling

---

#### [frontend/src/lib/utils.ts](frontend/src/lib/utils.ts)
**Purpose**: Utility functions

**What it does**:
- Provides helper functions for common operations
- Class name merging for Tailwind CSS
- Date formatting
- String manipulation

**When to edit**: Add new utility functions, modify helpers

---

#### [frontend/src/types/index.ts](frontend/src/types/index.ts)
**Purpose**: TypeScript type definitions

**What it does**:
- Defines all TypeScript interfaces and types
- Ensures type safety across frontend
- Documents data structures

**Key types**:
```typescript
interface GapFix {
  id: string;
  gap_type: string;
  issue: string;
  suggestion: string;
  user_action?: string;
  final_text?: string;
}

interface Epic {
  id: string;
  name: string;
  description: string;
  story_ids: string[];
}

interface UserStory {
  id: string;
  epic_id: string;
  title: string;
  role: string;
  goal: string;
  benefit: string;
  acceptance_criteria: AcceptanceCriterion[];
  source_chunks: string[];
}

interface FunctionalTest {
  id: string;
  story_id: string;
  title: string;
  objective: string;
  preconditions: string[];
  test_steps: string[];
  expected_results: string[];
}

interface GherkinScenario {
  id: string;
  story_id: string;
  feature_name: string;
  scenario_name: string;
  given: string[];
  when: string[];
  then: string[];
}

interface Entity {
  id: string;
  name: string;
  attributes: Attribute[];
  relationships: Relationship[];
}

type PipelineStage = 'validation' | 'epics' | 'functional_tests' | 'gherkin_tests' | 'data_model' | 'code_generation';

interface StatusResponse {
  job_id: string;
  status: string;
  current_stage: PipelineStage;
  results: GenerationResults;
  artefacts: ArtifactStatus;
}
```

**When to edit**: Add new types, modify interfaces, add type utilities

---

## Configuration Files

#### [backend/requirements.txt](backend/requirements.txt)
**Purpose**: Python dependencies

**Key dependencies**:
- `fastapi` - Web framework
- `uvicorn` - ASGI server
- `boto3` - AWS SDK
- `python-dotenv` - Environment variables
- `PyMuPDF` - PDF parsing
- `python-docx` - Word document parsing
- `python-multipart` - File upload handling
- `pydantic` - Data validation

**When to edit**: Add new Python packages, update versions

---

#### [backend/.env](backend/.env)
**Purpose**: Environment configuration (gitignored)

**Required variables**:
```env
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
AWS_REGION=us-east-1

# Optional proxy settings
HTTP_PROXY=http://proxy.company.com:8080
HTTPS_PROXY=http://proxy.company.com:8080
NO_PROXY=localhost,127.0.0.1
```

**When to edit**: Never commit to git, update with your AWS credentials

---

#### [frontend/package.json](frontend/package.json)
**Purpose**: Node.js dependencies and scripts

**Key dependencies**:
- `react` - UI library
- `react-router-dom` - Routing
- `axios` - HTTP client
- `lucide-react` - Icons
- `tailwindcss` - CSS framework
- `typescript` - Type checking
- `vite` - Build tool

**Scripts**:
```json
"dev": "vite",
"build": "tsc && vite build",
"preview": "vite preview"
```

**When to edit**: Add new npm packages, modify scripts, update versions

---

#### [frontend/vite.config.ts](frontend/vite.config.ts)
**Purpose**: Vite configuration

**What it does**:
- Configures path aliases (@/ → src/)
- Sets up React plugin
- Configures build settings

**When to edit**: Add path aliases, modify build config, change dev server settings

---

#### [frontend/tsconfig.json](frontend/tsconfig.json)
**Purpose**: TypeScript configuration

**What it does**:
- Enables strict type checking
- Configures path resolution
- Sets compilation target to ES2020

**When to edit**: Modify type checking strictness, add path mappings, change target

---

#### [.gitignore](.gitignore)
**Purpose**: Git exclusion patterns

**Key exclusions**:
- `venv/`, `node_modules/` - Dependencies
- `__pycache__/`, `*.pyc` - Python cache
- `.env` - Environment secrets
- `generated/` - Runtime outputs
- `.DS_Store` - OS metadata
- `.playwright-mcp/` - Testing artifacts

**When to edit**: Add new exclusion patterns, remove temporary exclusions

---

## Documentation

#### [README.md](README.md)
**Purpose**: Project overview and quick start

**Contents**:
- Project description
- Features list
- Quick start guide
- Technology stack
- Basic usage instructions

**When to edit**: Update project description, add new features, modify setup steps

---

#### [ONBOARDING.md](ONBOARDING.md)
**Purpose**: Comprehensive developer onboarding

**Contents**:
- Detailed project overview
- System architecture
- Complete tech stack
- Prerequisites and AWS setup
- Step-by-step environment setup
- Full project structure
- Development workflows
- Key concepts and patterns
- Common tasks and troubleshooting

**When to edit**: Add new setup steps, update architecture, add troubleshooting items

---

#### [CODEBASE_GUIDE.md](CODEBASE_GUIDE.md)
**Purpose**: File-by-file codebase explanation (this file)

**Contents**:
- Detailed explanation of every important file
- Code examples and key sections
- When to edit each file
- Purpose and responsibilities

**When to edit**: Add new files, update explanations, add code examples

---

## Development Workflows

### Adding a New Artifact Type

**Backend**:
1. Add Pydantic model to `backend/app/models/schemas.py`
2. Add generation logic to `backend/app/services/llm_client.py`
3. Add pipeline stage to `backend/app/services/generation_pipeline.py`
4. Update `PipelineStage` enum in `schemas.py`
5. Add API endpoint in `backend/app/routes/generation.py`

**Frontend**:
1. Add TypeScript type to `frontend/src/types/index.ts`
2. Create page in `frontend/src/pages/`
3. Create editable component in `frontend/src/components/`
4. Add route to `frontend/src/App.tsx`
5. Update `frontend/src/lib/api.ts` with new endpoints

### Modifying LLM Prompts

**Location**: `backend/app/services/llm_client.py`

**Process**:
1. Find the method for the artifact type (e.g., `generate_epics_and_stories`)
2. Modify the prompt string
3. Test with a sample BRD
4. Verify JSON response structure matches expected format

### Changing AWS Configuration

**Location**: `backend/app/services/llm_client.py`

**Steps**:
1. Update `region_name` in boto3 client initialization
2. Update `model_id` to desired Claude version
3. Update `.env` file with new region
4. Test connectivity with AWS credentials

---

## Common Issues and Solutions

### Issue: "Job not found" after server restart
**Cause**: In-memory job storage (JobManager)
**Solution**: Re-upload BRD to create new job
**Future Fix**: Implement persistent storage (Redis/PostgreSQL)

### Issue: Code generation timeout
**Cause**: Large BRD or complex data model
**Solution**: Increase `read_timeout` in `llm_client.py` (currently 300s)
**Location**: `backend/app/services/llm_client.py:32`

### Issue: CORS errors in browser
**Cause**: Frontend running on different port than expected
**Solution**: Add port to CORS allowed origins in `backend/app/main.py`
**Location**: `backend/app/main.py:22`

---

## Next Steps After Reading This Guide

1. **Set up environment**: Follow [ONBOARDING.md](ONBOARDING.md) for complete setup
2. **Run the application**: Start backend and frontend servers
3. **Upload a sample BRD**: Test the full pipeline
4. **Make a small change**: Try modifying a prompt or adding a UI element
5. **Explore the code**: Read files mentioned here in your editor

---

**Happy Coding!**
