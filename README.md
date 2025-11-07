# Coder Task GitHub Action

This GitHub action starts a [Coder Task](https://coder.com/docs/ai-coder/tasks) and optionally posts a comment on a GitHub issue. It's designed to be used as part of a wider workflow.

## Overview

- When creating a Coder task, you must specify the Github user ID as an input.
- The action then queries the Coder deployment to find the Coder user associated with the given Github user ID.
  - Note that this requires the Coder deployment to be configured with [GitHub OAuth](https://coder.com/docs/admin/external-auth#configure-a-github-oauth-app) and for the Coder user to have linked their GitHub account.
  - If no corresponding Coder user is found, the action will fail.
- The action will then create a [Coder Task](https://coder.com/docs/ai-coder/tasks) for the user with the given template and prompt.
- Once the task has been created successfully, the action will post a comment on the GitHub issue with the task URL.

## Requirements

- A running Coder deployment (v2.28 or higher) accessible to the GitHub Actions runner.
- A [Tasks-capable](https://coder.com/docs/ai-coder/tasks#getting-started-with-tasks) Coder template
- A Coder session token with the required permissions to:
  - Read all users in the given organization
  - Create tasks for any user in the given organization

## Example Usage

The below example will start a Coder task when the `coder` label is applied to an issue.

```yaml
name: Start Coder Task

on:
  issues:
    types:
      - labeled

permissions:
  issues: write

jobs:
  start-coder-task:
    runs-on: ubuntu-latest
    if: github.event.label.name == 'coder'
    steps:
      - name: Start Coder Task
        uses: coder/start-coder-task@v0.0.2
        with:
          coder-url: ${{ secrets.CODER_URL }}
          coder-token: ${{ secrets.CODER_TOKEN }}
          coder-organization: "default"
          coder-template-name: "my-template"
          coder-task-name-prefix: "gh-task"
          coder-task-prompt: "Use the gh CLI to read ${{ github.event.issue.html_url }}, write an appropriate plan for solving the issue to PLAN.md, and then wait for feedback."
          github-user-id: ${{ github.event.sender.id }}
          github-issue-url: ${{ github.event.issue.html_url }}
          github-token: ${{ github.token }}
          comment-on-issue: true
```

## Inputs

<!--
yq -r '.inputs | to_entries[] | "| \(.key) | \(.value.description) | \(.value.required // false ) | \(.value.default // \"-\") |"' action.yaml
-->

| Name                   | Description                             | Required | Default |
| ---------------------- | --------------------------------------- | -------- | ------- |
| coder-task-prompt      | Prompt/instructions to send to the task | true     | -       |
| coder-token            | Coder session token for authentication  | true     | -       |
| coder-url              | Coder deployment URL                    | true     | -       |
| coder-organization     | Coder organization name                 | true     | -       |
| coder-task-name-prefix | Prefix for task name                    | true     | -       |
| coder-template-name    | Coder template to use for workspace     | true     | -       |
| github-issue-url       | GitHub issue URL to link this task to   | true     | -       |
| github-token           | GitHub token for API operations         | true     | -       |
| github-user-id         | GitHub user ID to create task for       | true     | -       |
| coder-template-preset  | Template preset to use (optional)       | false    | -       |
| comment-on-issue       | Whether to comment on the GitHub issue  | false    | true    |

## Outputs

<!--
yq -r '.outputs | to_entries[] | "| \(.key) | \(.value.description) |"' action.yaml
-->

| Name           | Description                                                          |
| -------------- | -------------------------------------------------------------------- |
| coder-username | The Coder username resolved from GitHub user                         |
| task-name      | The task name                                                        |
| task-url       | The URL to view the task in Coder                                    |
| task-created   | Whether the task was newly created (true) or already existed (false) |
