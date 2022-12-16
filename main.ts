import {
	App,
	Editor,
	MarkdownView,
	SuggestModal,
	TFile,
	Notice,
	Plugin,
	PluginSettingTab,
	Setting,
	TFolder,
} from "obsidian";

// Remember to rename these classes and interfaces!

interface MyPluginSettings {
	mySetting: string;
}

const DEFAULT_SETTINGS: MyPluginSettings = {
	mySetting: "default",
};

export default class MyPlugin extends Plugin {
	settings: MyPluginSettings;

	async onload() {
		await this.loadSettings();

		// This adds an editor command that can perform some operation on the current editor instance
		// Todo: EditorCallbacks only work if there is a file selected
		this.addCommand({
			id: "move-to-new-or-existing-folder",
			name: "Move to new or existing folder",
			editorCallback: (editor: Editor, view: MarkdownView) => {
				new Notice("Hello from 'move to new or existing folder'");
				const currentFile = view.file;
				new Notice("open: " + currentFile.path);
				new TargetFolderModal(this.app).open();
			},
		});

		// This adds a settings tab so the user can configure various aspects of the plugin
		this.addSettingTab(new SampleSettingTab(this.app, this));

		// If the plugin hooks up any global DOM events (on parts of the app that doesn't belong to this plugin)
		// Using this function will automatically remove the event listener when this plugin is disabled.
		this.registerDomEvent(document, "click", (evt: MouseEvent) => {
			console.log("click", evt);
		});

		// When registering intervals, this function will automatically clear the interval when the plugin is disabled.
		this.registerInterval(
			window.setInterval(() => console.log("setInterval"), 5 * 60 * 1000)
		);
	}

	onunload() {}

	async loadSettings() {
		this.settings = Object.assign(
			{},
			DEFAULT_SETTINGS,
			await this.loadData()
		);
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}

export class TargetFolderModal extends SuggestModal<TFolder> {
	
	markdownFiles: TFile[]; 
	folders: TFolder[];

	constructor(app: App) {
		super(app);
		this.markdownFiles = app.vault.getMarkdownFiles();
		this.folders = this.markdownFiles.map(file => file.parent).unique()
	}

	// Returns all available suggestions.
	getSuggestions(query: string): TFolder[] {
		return this.folders
			.filter((file) =>
				file.path.toLowerCase().includes(query.toLowerCase())
			);
	}

	// Renders each suggestion item.
	renderSuggestion(folder: TFolder, el: HTMLElement) {
		el.createEl("div", { text: folder.path });
	}

	selectSuggestion(folder: TFolder, evt: MouseEvent | KeyboardEvent): void {	
		new Notice("selectSuggestion");
		this.setPlaceholder(folder.path);
	}

	onChooseSuggestion(item: TFolder, evt: MouseEvent | KeyboardEvent) {
		new Notice("onChooseSuggestion");
		this.setPlaceholder(item.path);
	}
}

class SampleSettingTab extends PluginSettingTab {
	plugin: MyPlugin;

	constructor(app: App, plugin: MyPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;

		containerEl.empty();

		containerEl.createEl("h2", {
			text: "Options for Move to New or Existing Folder",
		});

		new Setting(containerEl)
			.setName("Setting #1")
			.setDesc("It's a secret")
			.addText((text) =>
				text
					.setPlaceholder("Enter your secret")
					.setValue(this.plugin.settings.mySetting)
					.onChange(async (value) => {
						console.log("Secret: " + value);
						this.plugin.settings.mySetting = value;
						await this.plugin.saveSettings();
					})
			);
	}
}
