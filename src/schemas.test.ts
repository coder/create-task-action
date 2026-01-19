import { describe, expect, test } from "bun:test";
import { type ActionInputs, ActionInputsSchema } from "./schemas";

const actionInputValid: ActionInputs = {
	coderURL: "https://coder.test",
	coderToken: "test-token",
	coderOrganization: "my-org",
	coderTaskNamePrefix: "gh",
	coderTaskPrompt: "test prompt",
	coderTemplateName: "test-template",
	githubIssueURL: "https://github.com/owner/repo/issues/123",
	githubToken: "github-token",
	githubUserID: 12345,
	coderTemplatePreset: "",
	commentOnIssue: true,
};

describe("ActionInputsSchema", () => {
	describe("Valid Input Cases", () => {
		test("accepts minimal required inputs and sets default values correctly", () => {
			const result = ActionInputsSchema.parse(actionInputValid);
			expect(result.coderURL).toBe(actionInputValid.coderURL);
			expect(result.coderToken).toBe(actionInputValid.coderToken);
			expect(result.coderOrganization).toBe(actionInputValid.coderOrganization);
			expect(result.coderTaskNamePrefix).toBe(
				actionInputValid.coderTaskNamePrefix,
			);
			expect(result.coderTaskPrompt).toBe(actionInputValid.coderTaskPrompt);
			expect(result.coderTemplateName).toBe(actionInputValid.coderTemplateName);
			expect(result.githubIssueURL).toBe(actionInputValid.githubIssueURL);
			expect(result.githubToken).toBe(actionInputValid.githubToken);
			expect(result.githubUserID).toBe(actionInputValid.githubUserID);
			expect(result.coderTemplatePreset).toBeEmpty();
		});

		test("accepts all optional inputs", () => {
			const input = {
				...actionInputValid,
				coderTemplatePreset: "custom",
			};
			const result = ActionInputsSchema.parse(input);
			expect(result.coderTemplatePreset).toBe(input.coderTemplatePreset);
		});

		test("accepts valid URL formats", () => {
			const validUrls = [
				"https://coder.test",
				"https://coder.example.com:8080",
				"http://12.34.56.78",
				"https://12.34.56.78:9000",
				"http://localhost:3000",
				"http://127.0.0.1:3000",
				"http://[::1]:3000",
			];

			for (const url of validUrls) {
				const input = {
					...actionInputValid,
					coderURL: url,
				};
				const result = ActionInputsSchema.parse(input);
				expect(result.coderURL).toBe(url);
			}
		});
	});

	describe("Invalid Input Cases", () => {
		test("rejects missing required fields", () => {
			const input = {};
			expect(() => ActionInputsSchema.parse(input)).toThrow();
		});

		test("rejects invalid URL format for coderUrl", () => {
			const input = {
				...actionInputValid,
				coderURL: "not-a-url",
			};
			expect(() => ActionInputsSchema.parse(input)).toThrow();
		});

		test("rejects invalid URL format for issueUrl", () => {
			const input = {
				...actionInputValid,
				githubIssueURL: "not-a-url",
			};
			expect(() => ActionInputsSchema.parse(input)).toThrow();
		});

		test("rejects empty strings for required fields", () => {
			const input = {
				...actionInputValid,
				coderToken: "",
			};
			expect(() => ActionInputsSchema.parse(input)).toThrow();
		});
	});

	describe("User Identification (Union Validation)", () => {
		test("accepts input with only githubUserID", () => {
			const result = ActionInputsSchema.parse(actionInputValid);
			expect(result.githubUserID).toBe(12345);
			expect(result.coderUsername).toBeUndefined();
		});

		test("accepts input with only coderUsername", () => {
			const { githubUserID: _, ...withoutGithubUserID } = actionInputValid;
			const input = { ...withoutGithubUserID, coderUsername: "testuser" };
			const result = ActionInputsSchema.parse(input);
			expect(result.coderUsername).toBe("testuser");
			expect(result.githubUserID).toBeUndefined();
		});

		test("rejects input with both githubUserID and coderUsername", () => {
			const input = {
				...actionInputValid,
				coderUsername: "testuser",
			};
			expect(() => ActionInputsSchema.parse(input)).toThrow();
		});

		test("rejects input with neither githubUserID nor coderUsername", () => {
			const { githubUserID: _, ...withoutGithubUserID } = actionInputValid;
			expect(() => ActionInputsSchema.parse(withoutGithubUserID)).toThrow();
		});

		test("rejects githubUserID of 0", () => {
			const input = {
				...actionInputValid,
				githubUserID: 0,
			};
			expect(() => ActionInputsSchema.parse(input)).toThrow();
		});

		test("rejects negative githubUserID", () => {
			const input = {
				...actionInputValid,
				githubUserID: -1,
			};
			expect(() => ActionInputsSchema.parse(input)).toThrow();
		});

		test("rejects empty coderUsername", () => {
			const { githubUserID: _, ...withoutGithubUserID } = actionInputValid;
			const input = { ...withoutGithubUserID, coderUsername: "" };
			expect(() => ActionInputsSchema.parse(input)).toThrow();
		});
	});
});
