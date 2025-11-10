import { z } from "zod";

export type ActionInputs = z.infer<typeof ActionInputsSchema>;

export const ActionInputsSchema = z.object({
	// Required
	coderTaskPrompt: z.string().min(1),
	coderToken: z.string().min(1),
	coderURL: z.string().url(),
	coderTemplateName: z.string().min(1),
	githubIssueURL: z.string().url(),
	githubToken: z.string(),
	githubUserID: z.number().min(1),
	// Optional
	coderOrganization: z.string().min(1).optional().default("default"),
	coderTaskNamePrefix: z.string().min(1).optional().default("gh"),
	coderTemplatePreset: z.string().optional(),
	commentOnIssue: z.boolean().default(true),
});

export const ActionOutputsSchema = z.object({
	coderUsername: z.string(),
	taskName: z.string(),
	taskUrl: z.string().url(),
	taskCreated: z.boolean(),
});

export type ActionOutputs = z.infer<typeof ActionOutputsSchema>;
