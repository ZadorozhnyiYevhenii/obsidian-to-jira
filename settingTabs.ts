import { App, PluginSettingTab, Setting } from "obsidian";
import ObsidianToJiraPlugin from "main";

export interface ObsidianToJiraPluginSettings {
	domain: string;
	email: string;
	token: string;
  projectId: string;
}

export const EXAMPLE_DEFAULT_SETTINGS: Record<
	keyof ObsidianToJiraPluginSettings,
	{ name: string; description?: string }
> = {
	domain: {
		name: "Your Jira Domain",
		description: "e.g. https://your-domain.atlassian.net",
	},
	email: {
		name: "Your Jira Email",
	},
	token: {
		name: "Your Jira API Token",
	},
  projectId: {
    name: "Your Jira Project ID",
  }
};

export class ObsidianToJiraPluginSettingsTab extends PluginSettingTab {
	plugin: ObsidianToJiraPlugin;
	settings: ObsidianToJiraPluginSettings;

	constructor(
		app: App,
		plugin: ObsidianToJiraPlugin,
		settings: ObsidianToJiraPluginSettings
	) {
		super(app, plugin);
		this.plugin = plugin;
		this.settings = settings;
	}

	display(): void {
		const { containerEl } = this;

		containerEl.empty();

		containerEl.createEl("h2", {
			text: "Obsidian to Jira Plugin Settings",
		});

		Object.keys(this.settings).forEach(
			(key: keyof ObsidianToJiraPluginSettings) => {
				new Setting(containerEl)
					.setName(EXAMPLE_DEFAULT_SETTINGS[key].name)
          .setDesc(EXAMPLE_DEFAULT_SETTINGS[key].description ?? '')
					.addText((text) =>
						text
							.setPlaceholder(this.settings[key])
							.setValue(this.settings[key])
							.onChange(async (value) => {
								this.settings[key] = value;
								await this.plugin.saveSettings();
							})
					);
			}
		);
	}
}
