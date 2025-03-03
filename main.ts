import { Notice, Plugin, TFile } from "obsidian";
import {
	EXAMPLE_DEFAULT_SETTINGS,
	ObsidianToJiraPluginSettings,
	ObsidianToJiraPluginSettingsTab,
} from "./settingTabs";
import { ApiService } from "api";

interface ObsidianHealtcheckResponse {
	active: boolean;
}

interface Task {
	id?: string;
	title: string;
	description: {
		type: string;
		version: number;
		content: Array<JiraContent>;
	};
}

interface JiraTasks {
	issues: Array<{
		fields: {
			summary: string;
		};
		id: string;
	}>;
}

interface JiraContent {
	type: string;
	content: Array<{
		type: string;
		text: string;
	}>;
}

export default class ObsidianToJiraPlugin extends Plugin {
	settings: ObsidianToJiraPluginSettings;
	apiService: ApiService;
	activeFile: TFile | null = null;
	tasks: Task[] = [];

	async onload() {
		await this.loadSettings();

		this.addSettingTab(
			new ObsidianToJiraPluginSettingsTab(this.app, this, this.settings)
		);

		this.apiService = new ApiService(this.settings);

		await this.jiraConnectionHealthCheck();

		this.setCreateTasksButtonState();

		this.registerEvent(
			this.app.workspace.on("file-open", async (file) => {
				this.activeFile = file;

				if (!file) return;

				const tasksFromFile = await this.extractDataFromCurrentFile(
					file
				);

				if (tasksFromFile) {
					this.tasks = tasksFromFile;
				}
			})
		);
	}

	async loadSettings() {
		this.settings = Object.assign(
			{},
			EXAMPLE_DEFAULT_SETTINGS,
			await this.loadData()
		);
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	async jiraConnectionHealthCheck() {
		const statusCheck = this.addStatusBarItem();
		const statusCheckBar = statusCheck.createEl("span");

		try {
			const data = await this.apiService.get<ObsidianHealtcheckResponse>(
				"/myself"
			);

			if (data) {
				const text = data.active
					? "Jira connected ✅"
					: "Failed to connect to Jira ❌";

				statusCheckBar.textContent = text;
			}
		} catch (error) {
			statusCheckBar.textContent = "Failed to connect to Jira ❌";
		}
	}

	async sycnronizeTasks() {
		let synchrounizedTasksCount = 0;
		const tasksFromJira = await this.getTasks();

		const mappedTasksFromJira = Object.fromEntries(
			tasksFromJira.issues.map((task) => [task.fields.summary, task.id])
		);

		this.tasks.map((task) => {
			const currentTask = mappedTasksFromJira[task.title];

			if (currentTask) {
				synchrounizedTasksCount++;
				task.id = mappedTasksFromJira[task.title];
			}
		});

		new Notice(
			`Synchronized ${synchrounizedTasksCount} tasks with Jira`,
			2000
		);
	}

	setCreateTasksButtonState() {
		const createBarItem = this.addStatusBarItem();
		const createTasksButton = createBarItem.createEl("button", {
			text: "Create Tasks",
		});

		createTasksButton.addEventListener("click", async () => {
			if (!this.activeFile) {
				new Notice("No active file found.");
				return;
			}

			await this.createTasks(this.tasks);
		});

		const synchronizeBarItem = this.addStatusBarItem();
		const synchronizeTasksButton = synchronizeBarItem.createEl("button", {
			text: "Synchronize Tasks",
		});

		synchronizeTasksButton.addEventListener("click", async () => {
			await this.sycnronizeTasks();
		});

		const updateBarItem = this.addStatusBarItem();
		const updateTasksButton = updateBarItem.createEl("button", {
			text: "Update Tasks",
		});
		updateTasksButton.addEventListener("click", async () => {
			await this.updateTasks(this.tasks);
		});
	}

	async createTasks(tasks: Task[]) {
		let tasksCount = 0;

		try {
			await Promise.all(
				tasks.map(async (task) => {
					if (!task.id) {
						tasksCount++;
						const newTask = await this.apiService.post("/issue", {
							fields: {
								project: {
									key: this.settings.projectId,
								},
								summary: task.title,
								description: task.description,
								issuetype: {
									name: "Task",
								},
							},
						});

						task.id = newTask.id;
					}
				})
			);

			new Notice(`Created ${tasksCount} tasks.`, 2000);
		} catch (error) {
			new Notice("Failed to create tasks.");
		}
	}

	async updateTasks(tasks: Task[]) {
		let tasksCount = 0;
		await Promise.all(
			tasks.map(async (task) => {
				console.log(task.description);
				if (task.id) {
					tasksCount++;
					await this.apiService.put(`/issue/${task.id}`, {
						fields: {
							summary: task.title,
							description: task.description,
							issuetype: {
								name: "Task",
							},
						},
					});
				}
			})
		);

		new Notice(`Updated ${tasksCount} tasks.`, 2000);
	}

	async getTasks(): Promise<JiraTasks> {
		const tasks = await this.apiService.get<JiraTasks>(
			`/search?jql=project=${this.settings.projectId}`
		);
		return tasks;
	}

	async extractDataFromCurrentFile(file: TFile) {
		if (file) {
			const fileContents = await this.app.vault.read(file);

			const extractedData = this.extractData(fileContents);
			// this.app.vault.modify(file);
			console.log(fileContents);
			return extractedData;
		} else {
			new Notice("No active file found.");
		}
	}

	setJiraContent(type: string, text: string): JiraContent {
		return {
			type,
			content: [
				{
					type: "text",
					text,
				},
			],
		};
	}

	extractData(content: string): Task[] {
		const data: Task[] = [];

		const blockRegex = /###\s(.*?)\n([\s\S]*?)(?=\n###|\n*$)/g;
		let match;

		while ((match = blockRegex.exec(content)) !== null) {
			const title = match[1].trim();
			const descriptionContent = match[2].trim();

			const description = {
				text: "",
				code: "",
			};

			const descriptionMatch = descriptionContent.match(
				/(?<=\*\*Description\*\*:\s)([\s\S]*?)(?=\n*(?:```|\*\*|$))/
			);
			if (descriptionMatch) {
				description.text = descriptionMatch[1].trim();
			}

			const codeBlocks: string[] = [];
			descriptionContent.replace(
				/```[a-zA-Z]*\s*([\s\S]*?)```/g,
				(_, code) => {
					codeBlocks.push(code.trim());
					return "";
				}
			);

			description.code = codeBlocks.join("\n");

			const textWithoutCode = descriptionContent
				.replace(/```[a-zA-Z]*\s*([\s\S]*?)```/g, "")
				.trim();
			description.text = description.text || textWithoutCode;

			data.push({
				title,
				description: {
					type: "doc",
					version: 1,
					content: [
						this.setJiraContent("paragraph", description.text),
						...(description.code
							? [
									this.setJiraContent(
										"codeBlock",
										description.code
									),
							]
							: []),
					],
				},
			});
		}

		return data;
	}
}
