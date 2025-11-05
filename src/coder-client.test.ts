import { describe, expect, test, beforeEach, mock } from "bun:test";
import {
	RealCoderClient,
	CoderAPIError,
	type ExperimentalCoderSDKTask,
} from "./coder-client";
import {
	mockUser,
	mockUserList,
	mockUserListEmpty,
	mockUserListDuplicate,
	mockTemplate,
	mockTemplateVersionPresets,
	mockTask,
	mockTaskList,
	mockTaskListEmpty,
	createMockInputs,
	createMockResponse,
	mockTemplateVersionPreset,
} from "./test-helpers";

describe("CoderClient", () => {
	let client: RealCoderClient;
	let mockFetch: ReturnType<typeof mock>;

	beforeEach(() => {
		const mockInputs = createMockInputs();
		client = new RealCoderClient(mockInputs.coderURL, mockInputs.coderToken);
		mockFetch = mock(() => Promise.resolve(createMockResponse([])));
		global.fetch = mockFetch as unknown as typeof fetch;
	});

	describe("getCoderUserByGitHubId", () => {
		test("returns the user when found", async () => {
			mockFetch.mockResolvedValue(createMockResponse(mockUserList));
			const result = await client.getCoderUserByGitHubId(
				mockUser.github_com_user_id,
			);
			expect(mockFetch).toHaveBeenCalledWith(
				`https://coder.test/api/v2/users?q=github_com_user_id%3A${mockUser.github_com_user_id?.toString()}`,
				expect.objectContaining({
					headers: expect.objectContaining({
						"Coder-Session-Token": "test-token",
					}),
				}),
			);
			expect(result.id).toBe(mockUser.id);
			expect(result.username).toBe(mockUser.username);
			expect(result.github_com_user_id).toBe(mockUser.github_com_user_id);
		});

		test("throws an error if multiple Coder users are found with the same GitHub ID", async () => {
			mockFetch.mockResolvedValue(createMockResponse(mockUserListDuplicate));
			expect(
				client.getCoderUserByGitHubId(mockUser.github_com_user_id ?? 0),
			).rejects.toThrow(CoderAPIError);
			expect(mockFetch).toHaveBeenCalledWith(
				`https://coder.test/api/v2/users?q=github_com_user_id%3A${mockUser.github_com_user_id?.toString()}`,
				expect.objectContaining({
					headers: expect.objectContaining({
						"Coder-Session-Token": "test-token",
					}),
				}),
			);
		});

		test("throws an error if no Coder user is found with the given GitHub ID", async () => {
			mockFetch.mockResolvedValue(createMockResponse(mockUserListEmpty));
			expect(
				client.getCoderUserByGitHubId(mockUser.github_com_user_id ?? 0),
			).rejects.toThrow(CoderAPIError);
			expect(mockFetch).toHaveBeenCalledWith(
				`https://coder.test/api/v2/users?q=github_com_user_id%3A${mockUser.github_com_user_id}`,
				expect.objectContaining({
					headers: expect.objectContaining({
						"Coder-Session-Token": "test-token",
					}),
				}),
			);
		});

		test("throws error on 401 unauthorized", async () => {
			mockFetch.mockResolvedValue(
				createMockResponse(
					{ error: "Unauthorized" },
					{ ok: false, status: 401, statusText: "Unauthorized" },
				),
			);
			expect(
				client.getCoderUserByGitHubId(mockUser.github_com_user_id ?? 0),
			).rejects.toThrow(CoderAPIError);
		});

		test("throws error on 500 server error", async () => {
			mockFetch.mockResolvedValue(
				createMockResponse(
					{ error: "Internal Server Error" },
					{ ok: false, status: 500, statusText: "Internal Server Error" },
				),
			);
			expect(
				client.getCoderUserByGitHubId(mockUser.github_com_user_id ?? 0),
			).rejects.toThrow(CoderAPIError);
		});

		test("throws an error when GitHub user ID is 0", async () => {
			mockFetch.mockResolvedValue(createMockResponse([mockUser]));
			expect(client.getCoderUserByGitHubId(0)).rejects.toThrow(
				"GitHub user ID cannot be 0",
			);
		});
	});

	describe("getTemplateByOrganizationAndName", () => {
		test("the given template is returned successfully if it exists", async () => {
			mockFetch.mockResolvedValue(createMockResponse(mockTemplate));
			const mockInputs = createMockInputs();
			const result = await client.getTemplateByOrganizationAndName(
				mockInputs.coderOrganization,
				mockTemplate.name,
			);
			expect(mockFetch).toHaveBeenCalledWith(
				`https://coder.test/api/v2/organizations/${mockInputs.coderOrganization}/templates/${mockTemplate.name}`,
				expect.objectContaining({
					headers: expect.objectContaining({
						"Coder-Session-Token": "test-token",
					}),
				}),
			);
			expect(result.id).toBe(mockTemplate.id);
			expect(result.name).toBe(mockTemplate.name);
			expect(result.active_version_id).toBe(mockTemplate.active_version_id);
		});

		test("throws an error when the given template is not found", async () => {
			mockFetch.mockResolvedValue(
				createMockResponse(
					{ error: "Not found" },
					{ ok: false, status: 404, statusText: "Not Found" },
				),
			);
			const mockInputs = createMockInputs();
			expect(
				client.getTemplateByOrganizationAndName(
					mockInputs.coderOrganization,
					"nonexistent",
				),
			).rejects.toThrow(CoderAPIError);
		});
	});

	describe("getTemplateVersionPresets", () => {
		test("returns template version presets", async () => {
			mockFetch.mockResolvedValue(
				createMockResponse(mockTemplateVersionPresets),
			);
			const result = await client.getTemplateVersionPresets(
				mockTemplate.active_version_id,
			);
			expect(result).not.toBeNull();
			expect(result).toHaveLength(mockTemplateVersionPresets.length);
			for (let idx = 0; idx < result.length; idx++) {
				expect(result[idx].ID).toBe(mockTemplateVersionPresets[idx].ID);
				expect(result[idx].Name).toBe(mockTemplateVersionPresets[idx].Name);
			}
			expect(mockFetch).toHaveBeenCalledWith(
				`https://coder.test/api/v2/templateversions/${mockTemplate.active_version_id}/presets`,
				expect.objectContaining({
					headers: expect.objectContaining({
						"Coder-Session-Token": "test-token",
					}),
				}),
			);
		});
	});

	describe("getTask", () => {
		test("returns task when task exists", async () => {
			mockFetch.mockResolvedValue(createMockResponse(mockTaskList));
			const result = await client.getTask(mockUser.username, mockTask.name);
			expect(result).not.toBeNull();
			expect(result?.id).toBe(mockTask.id);
			expect(result?.name).toBe(mockTask.name);
			expect(mockFetch).toHaveBeenCalledWith(
				`https://coder.test/api/experimental/tasks?q=owner%3A${mockUser.username}`,
				expect.objectContaining({
					headers: expect.objectContaining({
						"Coder-Session-Token": "test-token",
					}),
				}),
			);
		});

		test("returns null when task doesn't exist (404)", async () => {
			mockFetch.mockResolvedValue(createMockResponse(mockTaskListEmpty));
			const result = await client.getTask(mockUser.username, mockTask.name);
			expect(result).toBeNull();
			expect(mockFetch).toHaveBeenCalledWith(
				`https://coder.test/api/experimental/tasks?q=owner%3A${mockUser.username}`,
				expect.objectContaining({
					headers: expect.objectContaining({
						"Coder-Session-Token": "test-token",
					}),
				}),
			);
		});
	});

	describe("createTask", () => {
		test("creates task successfully given valid input", async () => {
			mockFetch.mockResolvedValueOnce(createMockResponse(mockTask));
			const mockInputs = createMockInputs();
			const result = await client.createTask(mockUser.username, {
				name: mockTask.name,
				template_version_id: mockTemplate.active_version_id,
				input: mockInputs.coderTaskPrompt,
			});
			expect(result.id).toBe(mockTask.id);
			expect(result.name).toBe(mockTask.name);
			expect(mockFetch).toHaveBeenNthCalledWith(
				1,
				`https://coder.test/api/experimental/tasks/${mockUser.username}`,
				expect.objectContaining({
					method: "POST",
					headers: expect.objectContaining({
						"Coder-Session-Token": "test-token",
					}),
					body: JSON.stringify({
						name: mockTask.name,
						template_version_id: mockTemplate.active_version_id,
						input: mockInputs.coderTaskPrompt,
					}),
				}),
			);
		});

		test("creates task successfully with a given preset", async () => {
			mockFetch.mockResolvedValueOnce(createMockResponse(mockTask));
			const mockInputs = {
				...createMockInputs(),
				template_version_preset_id: mockTemplateVersionPreset.ID,
			};
			const result = await client.createTask(mockUser.username, {
				name: mockTask.name,
				template_version_id: mockTemplate.active_version_id,
				template_version_preset_id: mockTemplateVersionPreset.ID,
				input: mockInputs.coderTaskPrompt,
			});
			expect(result.id).toBe(mockTask.id);
			expect(result.name).toBe(mockTask.name);
			expect(mockFetch).toHaveBeenNthCalledWith(
				1,
				`https://coder.test/api/experimental/tasks/${mockUser.username}`,
				expect.objectContaining({
					method: "POST",
					headers: expect.objectContaining({
						"Coder-Session-Token": "test-token",
					}),
					body: JSON.stringify({
						name: mockTask.name,
						template_version_id: mockTemplate.active_version_id,
						template_version_preset_id: mockTemplateVersionPreset.ID,
						input: mockInputs.coderTaskPrompt,
					}),
				}),
			);
		});
	});

	describe("getTaskById", () => {
		test("returns task when found", async () => {
			mockFetch.mockResolvedValue(createMockResponse(mockTask));
			const result = await client.getTaskById(mockUser.username, mockTask.id);

			expect(result.id).toBe(mockTask.id);
			expect(result.name).toBe(mockTask.name);
			expect(result.status).toBe(mockTask.status);
			expect(mockFetch).toHaveBeenCalledWith(
				`https://coder.test/api/experimental/tasks/${mockUser.username}/${mockTask.id}`,
				expect.objectContaining({
					headers: expect.objectContaining({
						"Coder-Session-Token": "test-token",
					}),
				}),
			);
		});

		test("throws error when task not found (404)", async () => {
			mockFetch.mockResolvedValue(
				createMockResponse(
					{ error: "Not Found" },
					{ ok: false, status: 404, statusText: "Not Found" },
				),
			);

			expect(
				client.getTaskById(mockUser.username, mockTask.id),
			).rejects.toThrow(CoderAPIError);
		});
	});

	describe("waitForTaskActive", () => {
		test("returns immediately when task is already active", async () => {
			const readyTask: ExperimentalCoderSDKTask = {
				...mockTask,
				status: "active",
				current_state: {
					state: "idle",
				},
			};
			mockFetch.mockResolvedValue(createMockResponse(readyTask));

			expect(
				client.waitForTaskActive(
					mockUser.username,
					mockTask.id,
					console.log,
					1000,
				),
			).resolves.toBeUndefined();

			expect(mockFetch).toHaveBeenCalledWith(
				`https://coder.test/api/experimental/tasks/${mockUser.username}/${mockTask.id}`,
				expect.objectContaining({
					headers: expect.objectContaining({
						"Coder-Session-Token": "test-token",
					}),
				}),
			);
		});

		test("polls until task becomes active", async () => {
			const pendingTask: ExperimentalCoderSDKTask = {
				...mockTask,
				status: "pending",
			};
			const activeTask: ExperimentalCoderSDKTask = {
				...mockTask,
				status: "active",
			};
			const readyTask: ExperimentalCoderSDKTask = {
				...mockTask,
				status: "active",
				current_state: {
					state: "idle",
				},
			};

			mockFetch
				.mockResolvedValueOnce(createMockResponse(pendingTask))
				.mockResolvedValueOnce(createMockResponse(activeTask))
				.mockResolvedValueOnce(createMockResponse(readyTask));

			expect(
				client.waitForTaskActive(
					mockUser.username,
					mockTask.id,
					console.log,
					7000,
				),
			).resolves.toBeUndefined();

			expect(mockFetch).toHaveBeenCalledTimes(3);
		});

		test("throws error when task enters error state", async () => {
			const errorTask: ExperimentalCoderSDKTask = {
				...mockTask,
				status: "error",
			};
			mockFetch.mockResolvedValue(createMockResponse(errorTask));

			expect(
				client.waitForTaskActive(
					mockUser.username,
					mockTask.id,
					console.log,
					1000,
				),
			).rejects.toThrow(CoderAPIError);
			expect(
				client.waitForTaskActive(
					mockUser.username,
					mockTask.id,
					console.log,
					1000,
				),
			).rejects.toThrow(
				"Task entered error state while waiting for active state",
			);
		});

		test("throws timeout error when task doesn't become active in time", async () => {
			const pendingTask: ExperimentalCoderSDKTask = {
				...mockTask,
				status: "pending",
			};
			mockFetch.mockResolvedValue(createMockResponse(pendingTask));

			expect(
				client.waitForTaskActive(
					mockUser.username,
					mockTask.id,
					console.log,
					1,
				), // Very short timeout
			).rejects.toThrow(CoderAPIError);
			expect(
				client.waitForTaskActive(
					mockUser.username,
					mockTask.id,
					console.log,
					1,
				),
			).rejects.toThrow("Timeout waiting for task to reach active state");
		});
	});

	describe("sendTaskInput", () => {
		test("sends input successfully", async () => {
			mockFetch.mockResolvedValue(createMockResponse({}));

			const testInput = "Test input";
			await client.sendTaskInput(mockUser.username, mockTask.id, testInput);

			expect(mockFetch).toHaveBeenCalledWith(
				`https://coder.test/api/experimental/tasks/${mockUser.username}/${mockTask.id}/send`,
				expect.objectContaining({
					method: "POST",
					body: expect.stringContaining(testInput),
				}),
			);
		});

		test("request body contains input field", async () => {
			mockFetch.mockResolvedValue(createMockResponse({}));

			const testInput = "Test input";
			await client.sendTaskInput(mockUser.username, mockTask.id, testInput);

			const call = mockFetch.mock.calls[0];
			const body = JSON.parse(call[1].body);
			expect(body.input).toBe(testInput);
		});

		test("throws error when task not found (404)", async () => {
			mockFetch.mockResolvedValue(
				createMockResponse(
					{ error: "Not Found" },
					{ ok: false, status: 404, statusText: "Not Found" },
				),
			);

			const testInput = "Test input";
			expect(
				client.sendTaskInput(mockUser.username, mockTask.id, testInput),
			).rejects.toThrow(CoderAPIError);
		});

		test("throws error when task not running (400)", async () => {
			mockFetch.mockResolvedValue(
				createMockResponse(
					{ error: "Bad Request" },
					{ ok: false, status: 400, statusText: "Bad Request" },
				),
			);

			const testInput = "Test input";
			expect(
				client.sendTaskInput(mockUser.username, mockTask.id, testInput),
			).rejects.toThrow(CoderAPIError);
		});
	});
});
