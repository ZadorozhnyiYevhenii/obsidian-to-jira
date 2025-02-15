import { requestUrl } from "obsidian";
import { ObsidianToJiraPluginSettings } from "settingTabs";

export class ApiService {
	settings: ObsidianToJiraPluginSettings;

	constructor(settings: ObsidianToJiraPluginSettings) {
		this.settings = settings;
	}

	getHeaders() {
		return {
			Authorization: `Basic ${btoa(
				`${this.settings.email}:${this.settings.token}`
			)}`,
			'Content-Type': "application/json",
			Origin: this.settings.domain,
		};
	}

	async get<T>(url: string): Promise<T> {
		const response = await requestUrl({
			url: `${this.settings.domain}/rest/api/3${url}`,
			headers: {
				...this.getHeaders(),
			},
		});

		const data = await response.json;

		return data;
	}

	async post<T>(url: string, body: T) {
		const response = await requestUrl({
			url: `${this.settings.domain}/rest/api/3${url}`,
			method: "POST",
			body: JSON.stringify(body),
			headers: {
				...this.getHeaders(),
			},
		});

		const data = await response.json;

		return data;
	}

	async put<T>(url: string, body: T) {
		await requestUrl({
			url: `${this.settings.domain}/rest/api/3${url}`,
			method: "PUT",
			body: JSON.stringify(body),
			headers: {
				...this.getHeaders(),
			},
		});
	}

	async delete(url: string) {
		const response = await requestUrl({
			url: `${this.settings.domain}/rest/api/3${url}`,
			method: "DELETE",
			headers: {
				...this.getHeaders(),
			},
		});

		const data = await response.json;

		return data;
	}
}
