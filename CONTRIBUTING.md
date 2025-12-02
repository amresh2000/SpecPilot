# Contributing to SpecPilot

Thank you for your interest in contributing to SpecPilot! This document provides guidelines and instructions for contributing.

## Table of Contents
- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Project Structure](#project-structure)
- [Coding Standards](#coding-standards)
- [Commit Guidelines](#commit-guidelines)
- [Pull Request Process](#pull-request-process)
- [Testing](#testing)
- [Documentation](#documentation)

---

## Code of Conduct

### Our Standards
- Be respectful and inclusive
- Accept constructive criticism gracefully
- Focus on what's best for the community
- Show empathy towards other contributors

### Unacceptable Behavior
- Harassment, discriminatory comments, or personal attacks
- Publishing others' private information
- Trolling or insulting/derogatory comments
- Other conduct deemed inappropriate in a professional setting

---

## Getting Started

### Prerequisites
- **Backend**: Python 3.8+, pip, virtualenv
- **Frontend**: Node.js 18+, npm
- **AWS**: AWS account with Bedrock access
- **Git**: Version control basics

### First-Time Setup

1. **Fork the repository** on GitHub
2. **Clone your fork**:
   ```bash
   git clone https://github.com/YOUR_USERNAME/SpecPilot.git
   cd SpecPilot
   ```
3. **Add upstream remote**:
   ```bash
   git remote add upstream https://github.com/ORIGINAL_OWNER/SpecPilot.git
   ```

---

## Development Setup

### Backend Setup

1. **Create virtual environment**:
   ```bash
   cd backend
   python3 -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

2. **Install dependencies**:
   ```bash
   pip install -r requirements.txt
   ```

3. **Configure AWS credentials**:
   ```bash
   aws configure
   # Enter your AWS Access Key ID, Secret Access Key, and region (us-east-1)
   ```

4. **Create `.env` file** (optional):
   ```bash
   # backend/.env
   AWS_REGION=us-east-1
   AWS_PROFILE=default
   ```

5. **Run backend**:
   ```bash
   ./venv/bin/uvicorn app.main:app --reload --port 8000
   ```

### Frontend Setup

1. **Install dependencies**:
   ```bash
   cd frontend
   npm install
   ```

2. **Run development server**:
   ```bash
   npm run dev
   ```

3. **Access the app**: Open `http://localhost:5173`

---

## Project Structure

```
SpecPilot/
├── backend/
│   ├── app/
│   │   ├── main.py              # FastAPI entry point
│   │   ├── models/
│   │   │   └── schemas.py       # Pydantic models
│   │   ├── routes/
│   │   │   └── generation.py    # API endpoints
│   │   └── services/
│   │       ├── brd_parser.py    # Document parsing
│   │       ├── llm_client.py    # AWS Bedrock client
│   │       ├── generation_pipeline.py
│   │       └── job_manager.py
│   ├── generated/               # Output directory
│   ├── requirements.txt
│   └── venv/
├── frontend/
│   ├── src/
│   │   ├── components/          # Reusable UI components
│   │   ├── pages/               # Page components
│   │   ├── lib/                 # Utilities and API client
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── package.json
│   └── vite.config.ts
├── docs/                        # Documentation
│   ├── API.md
│   ├── ARCHITECTURE.md
│   ├── PROJECT_SPEC.md
│   ├── VALIDATION_IMPLEMENTATION.md
│   ├── UI_IMPROVEMENTS.md
│   └── archive/
├── .gitignore
├── README.md
└── CONTRIBUTING.md
```

---

## Coding Standards

### Python (Backend)

**Style Guide**: PEP 8

**Naming Conventions**:
- Classes: `PascalCase` (e.g., `BRDParser`)
- Functions/methods: `snake_case` (e.g., `validate_brd_quality`)
- Constants: `UPPER_SNAKE_CASE` (e.g., `MAX_RETRIES`)
- Private methods: `_leading_underscore` (e.g., `_invoke_claude`)

**Best Practices**:
- Use type hints for function signatures
- Write docstrings for classes and functions
- Keep functions focused and single-purpose
- Handle exceptions explicitly
- Use async/await for I/O operations

**Example**:
```python
from typing import Dict, Any

async def validate_brd_quality(brd_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Evaluate BRD across 10 Critical-to-Quality dimensions.

    Args:
        brd_data: Parsed BRD with sections, tables, and chunks

    Returns:
        Validation report with CTQ scores and findings

    Raises:
        RuntimeError: If AWS Bedrock API call fails
    """
    # Implementation
```

### TypeScript/React (Frontend)

**Style Guide**: Airbnb React/TypeScript

**Naming Conventions**:
- Components: `PascalCase` (e.g., `ValidationPage`)
- Functions/variables: `camelCase` (e.g., `handleUpdateGapFix`)
- Constants: `UPPER_SNAKE_CASE` (e.g., `API_BASE_URL`)
- Interfaces/Types: `PascalCase` with `I` prefix optional (e.g., `GapFix`)

**Best Practices**:
- Use functional components with hooks
- Define TypeScript interfaces for props
- Extract reusable logic into custom hooks
- Keep components small and focused
- Use semantic HTML elements
- Implement proper error boundaries

**Example**:
```typescript
interface ValidationPageProps {
  jobId: string;
}

export const ValidationPage: React.FC<ValidationPageProps> = ({ jobId }) => {
  const [gapFixes, setGapFixes] = useState<GapFix[]>([]);

  const handleUpdateGapFix = async (
    gapId: string,
    action: string,
    finalText?: string
  ) => {
    // Implementation
  };

  return (
    <div className="validation-page">
      {/* JSX */}
    </div>
  );
};
```

---

## Commit Guidelines

### Commit Message Format

```
<type>(<scope>): <subject>

<body>

<footer>
```

**Types**:
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, no logic change)
- `refactor`: Code refactoring
- `test`: Add or update tests
- `chore`: Build process, dependencies, tooling

**Examples**:
```
feat(validation): add progress bar visualization

- Implement color-coded progress bar with segments
- Add legend showing accepted/rejected/pending counts
- Smooth CSS transitions for state updates

Closes #42
```

```
fix(backend): handle Bedrock throttling with exponential backoff

Increased max retries from 1 to 5 with exponential backoff
to handle ThrottlingException during high API usage.
```

---

## Pull Request Process

### Before Submitting

1. **Update your fork**:
   ```bash
   git fetch upstream
   git rebase upstream/main
   ```

2. **Create a feature branch**:
   ```bash
   git checkout -b feature/your-feature-name
   ```

3. **Make your changes**:
   - Follow coding standards
   - Write tests for new features
   - Update documentation

4. **Test your changes**:
   ```bash
   # Backend
   cd backend
   python -m pytest  # If tests exist

   # Frontend
   cd frontend
   npm run build  # Ensure build succeeds
   ```

5. **Commit your changes**:
   ```bash
   git add .
   git commit -m "feat(scope): descriptive message"
   ```

6. **Push to your fork**:
   ```bash
   git push origin feature/your-feature-name
   ```

### Submitting a PR

1. Go to the original repository on GitHub
2. Click "New Pull Request"
3. Select your fork and feature branch
4. Fill in the PR template:

```markdown
## Description
Brief description of what this PR does

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing
Describe how you tested your changes

## Screenshots (if applicable)
Add screenshots for UI changes

## Checklist
- [ ] Code follows project style guidelines
- [ ] Documentation updated
- [ ] No new warnings or errors
- [ ] Tested locally
```

5. Request reviews from maintainers
6. Address review feedback
7. Wait for approval and merge

---

## Testing

### Backend Testing (Future)

We plan to add:
- Unit tests with `pytest`
- Integration tests for API endpoints
- Mock AWS Bedrock responses for testing

**Example test structure**:
```python
# tests/test_brd_parser.py
def test_parse_docx():
    parser = BRDParser()
    result = parser.parse("sample.docx")
    assert result["file_type"] == "docx"
    assert len(result["sections"]) > 0
```

### Frontend Testing (Future)

We plan to add:
- Unit tests with `vitest`
- Component tests with React Testing Library
- E2E tests with Playwright

**Example test structure**:
```typescript
// tests/ValidationPage.test.tsx
describe('ValidationPage', () => {
  it('renders gap fixes correctly', () => {
    render(<ValidationPage jobId="test-123" />);
    expect(screen.getByText('Identified Gaps')).toBeInTheDocument();
  });
});
```

---

## Documentation

### When to Update Documentation

- **New features**: Update API.md and README.md
- **Architecture changes**: Update ARCHITECTURE.md
- **API changes**: Update API.md with new endpoints/schemas
- **Setup changes**: Update README.md and CONTRIBUTING.md

### Documentation Standards

- Use clear, concise language
- Include code examples
- Add diagrams for complex flows
- Keep API docs synchronized with code
- Use markdown formatting consistently

---

## Questions or Issues?

- **Bug reports**: Open an issue with detailed reproduction steps
- **Feature requests**: Open an issue describing the use case
- **Questions**: Start a discussion in GitHub Discussions
- **Security issues**: Email maintainers directly (do not open public issue)

---

## Recognition

Contributors will be recognized in:
- README.md contributors section
- Release notes for significant contributions
- Project documentation where applicable

Thank you for contributing to SpecPilot! 🚀
