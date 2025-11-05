# AGENTS.md - AI Agent Guide for coder-task-action

## Repository Overview

**Purpose**: GitHub Action that creates and manages Coder tasks for GitHub users with automated issue commenting support.

**Status**: Work in progress - Core functionality implemented with comprehensive test coverage.

**Tech Stack**:
- **Runtime**: Bun (JavaScript/TypeScript runtime & bundler)
- **Language**: TypeScript with strict mode enabled
- **Validation**: Zod for runtime schema validation
- **Testing**: Bun's built-in test runner
- **GitHub Integration**: @actions/core, @actions/github, @octokit/rest
- **Formatting/Linting**: Biome (fast formatter and linter)

---

## Architecture

### High-Level Flow

```
GitHub Event (issue created/updated)
    ↓
index.ts (Entry Point)
    ↓
Parse & Validate Inputs (schemas.ts)
    ↓
Initialize Clients (CoderClient, Octokit)
    ↓
CoderTaskAction.run() (action.ts)
    ↓
├─ Get Coder user by GitHub ID
├─ Parse GitHub issue URL
├─ Get template & presets
├─ Check if task exists
│  ├─ YES: Send prompt to existing task
│  └─ NO: Create new task with prompt
└─ Comment on GitHub issue with task URL
```

### Key Design Decisions

1. **API Separation**: Uses both Coder's stable API (users, templates) and experimental API (tasks)
2. **Dependency Injection**: All external dependencies (Coder client, Octokit) are injected for testability
3. **Schema Validation**: Zod schemas ensure type safety at runtime for inputs and API responses
4. **Idempotency**: Checks for existing tasks and updates comments instead of creating duplicates
5. **Error Handling**: Custom `CoderAPIError` class for detailed API error reporting

---

## File Guide

### Core Source Files (`src/`)

#### `index.ts` - Entry Point
**Responsibility**: Main entry point for the GitHub Action
- Parses GitHub Action inputs using `@actions/core`
- Validates inputs against `ActionInputsSchema`
- Initializes `RealCoderClient` and Octokit
- Creates and executes `CoderTaskAction`
- Sets GitHub Action outputs
- Handles top-level error reporting

**Key Functions**: `main()`

**When to Modify**: 
- Adding/changing GitHub Action inputs or outputs
- Modifying error handling behavior
- Changing initialization logic

---

#### `action.ts` - Core Business Logic
**Responsibility**: Orchestrates task creation and management workflow
- Parses GitHub issue URLs
- Resolves Coder users from GitHub IDs
- Manages task lifecycle (create new or update existing)
- Handles GitHub issue commenting with update logic
- Generates task URLs for the Coder web UI

**Key Classes**: `CoderTaskAction`

**Key Methods**:
- `run()` - Main workflow orchestration
- `parseGithubIssueURL()` - Extracts owner/repo/issue# from URL
- `generateTaskUrl()` - Constructs Coder task web URL
- `commentOnIssue()` - Creates/updates GitHub issue comments

**When to Modify**:
- Changing task creation/update logic
- Modifying GitHub commenting behavior
- Adding new workflow steps
- Changing task naming conventions

**Important Notes**:
- Task names are generated as `{prefix}-{issue-number}` (e.g., "task-123")
- Comments are updated if they already exist (idempotent behavior)
- URL generation strips query params and anchors from base URL

---

#### `coder-client.ts` - Coder API Client
**Responsibility**: Abstracts all interactions with Coder API
- Provides interface `CoderClient` for dependency injection
- Implements `RealCoderClient` for production use
- Handles authentication via `Coder-Session-Token` header
- Validates all API responses with Zod schemas
- Provides custom error handling with `CoderAPIError`

**Key Classes**: 
- `CoderClient` (interface)
- `RealCoderClient` (implementation)
- `CoderAPIError` (error class)

**Key Methods**:
- `getCoderUserByGitHubId()` - Look up Coder user by GitHub ID (stable API)
- `getTemplateByOrganizationAndName()` - Get template details (stable API)
- `getTemplateVersionPresets()` - Get available presets (stable API)
- `getTask()` - Check if task exists (experimental API)
- `createTask()` - Create new task (experimental API)
- `sendTaskInput()` - Send prompt to existing task (experimental API)

**API Endpoints Used**:
- Stable API:
  - `GET /api/v2/users?q=github_com_user_id:{id}` - User lookup
  - `GET /api/v2/organizations/{org}/templates/{name}` - Template details
  - `GET /api/v2/templateversions/{id}/presets` - Template presets
  - `POST /api/v2/users/{username}/tasks/{taskName}/send` - Send task input
- Experimental API:
  - `GET /api/experimental/tasks?q=owner:{username}` - List tasks (workaround)
  - `POST /api/experimental/tasks/{username}` - Create task

**Zod Schemas Defined**:
- `CoderSDKUserSchema` - User objects
- `CoderSDKTemplateSchema` - Template objects
- `CoderSDKTemplateVersionPresetSchema` - Preset objects
- `ExperimentalCoderSDKTaskSchema` - Task objects
- `ExperimentalCoderSDKCreateTaskRequestSchema` - Task creation requests

**When to Modify**:
- Adding new Coder API methods
- Updating API endpoints (especially when experimental APIs stabilize)
- Changing authentication mechanism
- Adding new Zod validation schemas

**Important Notes**:
- GitHub user ID of 0 is explicitly rejected
- Multiple users with same GitHub ID causes error (409)
- Task lookup uses list endpoint as workaround (TODO: dedicated endpoint)
- All API responses are validated at runtime

---

#### `schemas.ts` - Input/Output Validation
**Responsibility**: Defines and validates action inputs and outputs
- `ActionInputsSchema` - Validates all GitHub Action inputs
- `ActionOutputsSchema` - Validates action outputs

**Schemas**:

**ActionInputs** (Required):
- `coderTaskPrompt` - Prompt to send to task
- `coderToken` - Coder session token
- `coderURL` - Coder deployment URL (validated as URL)
- `coderOrganization` - Coder organization name
- `coderTaskNamePrefix` - Prefix for task names
- `coderTemplateName` - Template to use
- `githubIssueURL` - Issue URL (validated as URL)
- `githubToken` - GitHub token for API access
- `githubUserID` - GitHub user ID (number >= 1)

**ActionInputs** (Optional):
- `coderTemplatePreset` - Template preset name

**ActionOutputs**:
- `coderUsername` - Resolved Coder username
- `taskName` - Full task name created/updated
- `taskUrl` - URL to view task (validated as URL)
- `taskCreated` - Boolean indicating if task was newly created

**When to Modify**:
- Adding/removing/changing action inputs
- Adding/removing/changing action outputs
- Modifying validation rules

---

### Test Files (`src/*.test.ts`)

#### `test-helpers.ts` - Test Utilities
**Responsibility**: Provides mock objects and helpers for testing

**Exports**:
- `MockCoderClient` - Implements `CoderClient` interface with Bun mocks
- `createMockOctokit()` - Creates mock Octokit instance
- `createMockInputs()` - Generates valid `ActionInputs` with overrides
- `createMockResponse()` - Creates mock fetch responses
- Mock data constants: `mockUser`, `mockTask`, `mockTemplate`, etc.

**When to Modify**:
- Adding new mock data for tests
- Mocking additional methods
- Changing test data structure

---

#### `action.test.ts` - Action Logic Tests
**Responsibility**: Tests `CoderTaskAction` class behavior
- URL parsing validation
- Task creation flow
- Task update flow
- GitHub issue commenting
- Error handling scenarios

**Test Coverage**:
- Valid and invalid GitHub issue URL parsing
- Task creation with new and existing tasks
- Issue comment creation and updating
- URL generation with different inputs

---

#### `coder-client.test.ts` - API Client Tests
**Responsibility**: Tests `RealCoderClient` API interactions
- User lookup by GitHub ID
- Template retrieval
- Preset retrieval
- Task operations (get, create, send input)
- Error handling and validation
- HTTP request/response handling

---

### Configuration Files

#### `action.yaml` - GitHub Action Metadata
Defines the action's interface, inputs, outputs, and runtime configuration.

**Important Inputs**:
- All inputs have clear descriptions
- Default values: `template-preset: "Default"`, `task-name-prefix: "task"`, `organization: "coder"`, `comment-on-issue: true`
- Runtime: `node20`
- Entry point: `dist/index.js`

---

#### `package.json` - Project Metadata
**Scripts**:
- `bun run build` - Bundle to `dist/index.js` for GitHub Actions
- `bun run dev` - Watch mode for development
- `bun run format` - Format code with Biome
- `bun run format:check` - Check formatting
- `bun run lint` - Lint with Biome (error on warnings)
- `bun run typecheck` - Run TypeScript compiler checks

**Dependencies**:
- Production: `@actions/core`, `@actions/github`, `@octokit/rest`, `zod`
- Development: `@biomejs/biome`, `@types/bun`, `typescript`

---

#### `tsconfig.json` - TypeScript Configuration
- Target: ES2022
- Module: ESNext with bundler resolution
- Strict mode enabled
- Includes: `src/**/*`
- Excludes: `node_modules`, `dist`

---

## Development Workflow

### Getting Started

```bash
# Install dependencies
bun install

# Run tests
bun test

# Type checking
bun run typecheck

# Lint
bun run lint

# Format code
bun run format

# Build for production
bun run build
```

### Testing Strategy

1. **Unit Tests**: Each file has corresponding `.test.ts` file
2. **Mocking**: Use `MockCoderClient` and `createMockOctokit()` for isolation
3. **Test Runner**: Bun's built-in test runner (`bun:test`)
4. **Pattern**: Use `describe`, `test`, `expect` from `bun:test`
5. **Setup**: `beforeEach` for test isolation

### Building for GitHub Actions

```bash
bun run build
# Generates dist/index.js - commit this for GitHub Actions to use
```

**Important**: GitHub Actions runs `dist/index.js`, so this must be committed.

---

## Common Tasks

### Adding a New GitHub Action Input

1. **Update `action.yaml`**: Add input definition with description, required status, and default
2. **Update `schemas.ts`**: Add field to `ActionInputsSchema` with appropriate Zod validator
3. **Update `index.ts`**: Read the input using `core.getInput()` or `core.getBooleanInput()`
4. **Update tests**: Add test cases for new input validation
5. **Rebuild**: Run `bun run build` and commit `dist/index.js`

### Adding a New Coder API Method

1. **Update `coder-client.ts`**:
   - Add method signature to `CoderClient` interface
   - Implement method in `RealCoderClient`
   - Create Zod schema for request/response if needed
2. **Update `test-helpers.ts`**: Add mock method to `MockCoderClient`
3. **Add tests** in `coder-client.test.ts`
4. **Use in `action.ts`**: Call new method from `CoderTaskAction`

### Modifying Task Creation Logic

1. **Edit `action.ts`**: Update `CoderTaskAction.run()` method
2. **Update tests** in `action.test.ts`
3. **Test locally**: Use `bun test` to verify changes
4. **Rebuild**: Run `bun run build`

### Changing Task Naming Convention

1. **Locate logic** in `action.ts`: Search for `taskName` construction (line ~120)
2. **Update logic**: Modify string interpolation or add new input if needed
3. **Update tests**: Adjust expectations in `action.test.ts`
4. **Update docs**: Reflect changes in `action.yaml` descriptions

---

## Key Patterns & Conventions

### Dependency Injection

All external dependencies are injected through constructors for testability:

```typescript
class CoderTaskAction {
  constructor(
    private readonly coder: CoderClient,
    private readonly octokit: Octokit,
    private readonly inputs: ActionInputs,
  ) {}
}
```

This allows easy mocking in tests without complex setup.

### Schema Validation

All inputs and API responses are validated using Zod:

```typescript
const inputs = ActionInputsSchema.parse(rawInputs);
const user = CoderSDKUserSchema.parse(apiResponse);
```

This provides runtime type safety and clear error messages.

### Error Handling

- Custom `CoderAPIError` includes status code and response body
- Top-level try-catch in `index.ts` handles all errors
- Use `core.setFailed()` to report errors to GitHub Actions
- Debug logs use `core.debug()` for visibility in workflow logs

### Idempotency

- Tasks are checked for existence before creation
- Existing tasks receive new prompts instead of failing
- GitHub comments are updated instead of creating duplicates

### Testing

- Mock all external dependencies (API clients, Octokit)
- Use `test-helpers.ts` for consistent mock data
- Test both success and error paths
- Validate schema parsing in tests

---

## Troubleshooting Guide

### "No Coder user found with GitHub user ID X"

**Cause**: User hasn't connected their GitHub account in Coder or ID is incorrect.

**Solution**: 
- Verify GitHub user ID is correct
- Ensure user has linked GitHub account in Coder settings
- Check `githubUserID` input is being passed correctly

### "Multiple Coder users found with GitHub user ID X"

**Cause**: Data integrity issue - multiple Coder users claim same GitHub ID.

**Solution**: Database cleanup required in Coder deployment.

### "Preset X not found"

**Cause**: Requested preset doesn't exist in template version.

**Solution**:
- Check available presets with `getTemplateVersionPresets()`
- Use "Default" preset or verify preset name spelling
- Ensure template version is correct

### "Invalid issue URL"

**Cause**: Issue URL doesn't match expected pattern.

**Solution**:
- Ensure format: `https://github.com/{owner}/{repo}/issues/{number}`
- Check for typos or extra path segments
- Validate input in GitHub workflow file

### Build Fails

**Cause**: TypeScript errors or dependency issues.

**Solution**:
```bash
bun run typecheck  # Check for TS errors
bun run lint       # Check for linting issues
bun install        # Reinstall dependencies
```

### Tests Fail After Changes

**Cause**: Mock expectations don't match new behavior.

**Solution**:
- Update mock return values in test files
- Check `test-helpers.ts` for outdated mock data
- Verify schema changes are reflected in tests

---

## Future Improvements (TODOs in Code)

1. **Task Lookup Endpoint**: `getTask()` currently uses list endpoint filtered client-side. Waiting for dedicated endpoint: `GET /api/experimental/tasks/{owner}/{taskName}`

2. **Experimental API Stabilization**: When tasks API moves to stable, update endpoints from `/api/experimental/*` to `/api/v2/*`

3. **Template Preset Logic**: Current preset selection logic has a bug (always undefined). See `action.ts` lines 133-146.

---

## API Reference

### CoderClient Interface

```typescript
interface CoderClient {
  getCoderUserByGitHubId(githubUserId: number | undefined): Promise<CoderSDKUser>;
  getTemplateByOrganizationAndName(org: string, name: string): Promise<CoderSDKTemplate>;
  getTemplateVersionPresets(versionId: string): Promise<CoderSDKTemplateVersionPreset[]>;
  getTask(owner: string, taskName: string): Promise<ExperimentalCoderSDKTask | null>;
  createTask(owner: string, params: CreateTaskRequest): Promise<ExperimentalCoderSDKTask>;
  sendTaskInput(owner: string, taskName: string, input: string): Promise<void>;
}
```

### CoderTaskAction Methods

```typescript
class CoderTaskAction {
  parseGithubIssueURL(): { githubOrg: string; githubRepo: string; githubIssueNumber: number };
  generateTaskUrl(coderUsername: string, taskName: string): string;
  commentOnIssue(taskUrl: string, owner: string, repo: string, issueNumber: number): Promise<void>;
  run(): Promise<ActionOutputs>;
}
```

---

## Glossary

- **Coder**: Platform for creating cloud development environments
- **Coder Task**: A workspace with an AI agent working on a specific prompt
- **Template**: Blueprint for creating Coder workspaces/tasks
- **Template Version**: Specific version of a template
- **Template Preset**: Pre-configured parameter set for a template version
- **Coder Session Token**: Authentication token for Coder API
- **GitHub User ID**: Numeric ID for GitHub users (not username)
- **Octokit**: Official GitHub API client for JavaScript/TypeScript
- **Zod**: TypeScript-first schema validation library
- **Bun**: Fast all-in-one JavaScript runtime and toolkit

---

## Quick Reference

### File Sizes & Complexity
- `coder-client.ts`: ~270 lines - Most complex, handles all API interactions
- `action.ts`: ~200 lines - Core business logic
- `test-helpers.ts`: ~210 lines - Testing infrastructure
- `index.ts`: ~70 lines - Simple entry point
- `schemas.ts`: ~30 lines - Simple validation schemas

### Dependencies Flow
```
index.ts
  ↓ imports
action.ts, schemas.ts, coder-client.ts
  ↓ tested by
*.test.ts
  ↓ uses
test-helpers.ts
```

### Most Frequently Modified Files
1. `action.ts` - Business logic changes
2. `coder-client.ts` - New API methods
3. `schemas.ts` - Input/output changes
4. `action.yaml` - Exposing new inputs/outputs

---

## Contact & Resources

- **Coder API Docs**: Check Coder deployment's `/docs` endpoint
- **GitHub Actions Docs**: https://docs.github.com/actions
- **Bun Docs**: https://bun.sh/docs
- **Zod Docs**: https://zod.dev

---

*Last Updated*: Auto-generated during repository analysis
*Version*: 1.0.0 (work in progress)

