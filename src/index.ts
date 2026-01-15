import * as core from "@actions/core";
import * as github from "@actions/github";
import { CoderTaskAction } from "./action";
import { RealCoderClient } from "./coder-client";
import { ActionInputsSchema } from "./schemas";

async function main() {
	try {
		// Parse and validate inputs
		const githubUserIdInput = core.getInput("github-user-id");
		const githubUserID = githubUserIdInput
			? Number.parseInt(githubUserIdInput, 10)
			: undefined;

		const inputs = ActionInputsSchema.parse({
			coderURL: core.getInput("coder-url", { required: true }),
			coderToken: core.getInput("coder-token", { required: true }),
			coderTemplateName: core.getInput("coder-template-name", {
				required: true,
			}),
			coderTaskPrompt: core.getInput("coder-task-prompt", { required: true }),
			coderOrganization: core.getInput("coder-organization", {
				required: true,
			}),
			coderTaskNamePrefix: core.getInput("coder-task-name-prefix", {
				required: true,
			}),
			githubIssueURL: core.getInput("github-issue-url", { required: true }),
			githubToken: core.getInput("github-token", { required: true }),
			githubUserID,
			coderUsername: core.getInput("coder-username") || undefined,
			coderTemplatePreset: core.getInput("coder-template-preset") || undefined,
			commentOnIssue: core.getBooleanInput("comment-on-issue"),
		});

		core.debug("Inputs validated successfully");
		core.debug(`Coder URL: ${inputs.coderURL}`);
		core.debug(`Template: ${inputs.coderTemplateName}`);
		core.debug(`Organization: ${inputs.coderOrganization}`);

		// Initialize clients
		const coder = new RealCoderClient(inputs.coderURL, inputs.coderToken);
		const octokit = github.getOctokit(inputs.githubToken);

		core.debug("Clients initialized");

		// Execute action
		const action = new CoderTaskAction(coder, octokit, inputs);
		const outputs = await action.run();

		// Set outputs
		core.setOutput("coder-username", outputs.coderUsername);
		core.setOutput("task-name", outputs.taskName);
		core.setOutput("task-url", outputs.taskUrl);
		core.setOutput("task-created", outputs.taskCreated.toString());

		core.debug("Action completed successfully");
		core.debug(`Outputs: ${JSON.stringify(outputs, null, 2)}`);
	} catch (error) {
		if (error instanceof Error) {
			core.setFailed(error.message);
			console.error("Action failed:", error);
			if (error.stack) {
				console.error("Stack trace:", error.stack);
			}
		} else {
			core.setFailed("Unknown error occurred");
			console.error("Unknown error:", error);
		}
		process.exit(1);
	}
}

main();
