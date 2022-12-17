import {
	App,
	Editor,
	MarkdownView,
	SuggestModal,
	TFile,
	Plugin,
	PluginSettingTab,
	Setting,
	TFolder,
	Vault,
} from "obsidian";

// Remember to rename these classes and interfaces!
interface PluginSettings {
	openNextFileInFolder: boolean;
}

const DEFAULT_SETTINGS: PluginSettings = {
	openNextFileInFolder: false,
};

export default class BetterMoverPlugin extends Plugin {
	settings: PluginSettings;

	async onload() {
		await this.loadSettings();

		// Commands with editorCallbacks only work if there is a file open. 
		this.addCommand({
			id: "move-to-new-or-existing-folder",
			name: "Move to new or existing folder",
			editorCallback: (editor: Editor, view: MarkdownView) => {
				const currentFile = view.file;
				new TargetFolderModal(this.app, currentFile).open();
			},
		});

		// This adds a settings tab so the user can configure various aspects of the plugin
		this.addSettingTab(new MoveToNewOrExistingFolderSettingsTab(this.app, this));

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
	createFolder = false;
	currentFile: TFile;
	currentFilePath: string;
	vault: Vault;

	constructor(app: App, currentFile: TFile) {
		super(app);
		this.vault = app.vault;
		this.currentFile = currentFile;
		this.currentFolder = currentFile.parent;
		this.currentFilePath = this.vault.getResourcePath(this.currentFile);

		// add "Tab"-key listener
		this.scope.register([], "Tab", (e) => {
			e.preventDefault();
			this.setSelectedEntryToTextEntryField();
		});
	}

	private setSelectedEntryToTextEntryField() {
		this.inputEl.value = this.getSelectedEntryPath();
	}

	private getSelectedEntryPath() {
		const selectedItem = this.modalEl
			.getElementsByClassName("is-selected");
		return selectedItem.length > 0 ? selectedItem[0].getText() : "";
	}

	// list suggestions against the query
	getSuggestions(query: string): TFolder[] {
		// since a new query was entered, reset the createFolder flag.
		if (this.createFolder) {
			this.createFolder = false;
		}

		const allMarkdownFiles = this.vault.getMarkdownFiles();
		const allFolders = allMarkdownFiles.map((file) => file.parent).unique();

		return allFolders.filter((file) =>
			file.path.toLowerCase().includes(query.toLowerCase())
		);
	}

	// override original "no match" behaviour
	onNoSuggestion(): void {
		// prop up the flag
		this.createFolder = true;

		const resultsBlock = this.modalEl.getElementsByClassName("prompt-results");
		if (resultsBlock.length > 0) {
			const resultBox = resultsBlock[0];
			resultBox.empty();
			resultBox.createEl("div", {
				text: "Create folder and move",
				cls: "suggestion-empty",
			});
		}
	}

	// Renders each suggestion item.
	renderSuggestion(folder: TFolder, el: HTMLElement): void {
		el.createEl("div", { text: folder.path });
	}

	selectSuggestion(folder: TFolder, evt: MouseEvent | KeyboardEvent): void {
		const originalFolder = this.currentFile.parent
		if (this.createFolder) {
			// We will need to create the new folder first
			const newFolderName = this.inputEl.value;
			(async (newFolderName) => {
				await app.vault.createFolder(newFolderName);
				console.log("Created new folder: " + newFolderName);
				const targetPath = newFolderName + "/" + this.currentFile.name;
				await app.fileManager.renameFile(this.currentFile, targetPath)
				console.log("Moved the file to " + targetPath);
			})(newFolderName)
		} else {
			const targetPath = folder.path + "/" + this.currentFile.name;
			(async (file, targetPath) => {
				await app.fileManager.renameFile(file, targetPath)
				console.log("Moved file to: " + targetPath);
			})(this.currentFile, targetPath)
			
		}

		// find the next file to open in the folder. 
		const nextFile = originalFolder.children.find(fileOrFolder => fileOrFolder instanceof TFile)
		const newLeaf = app.workspace.getLeaf();
		newLeaf.openFile(nextFile)
		this.close();
	}

	// not sure what this is for because I can't trigger it.
	onChooseSuggestion(item: TFolder, evt: MouseEvent | KeyboardEvent):void {
		throw new Error("Method not implemented.");
	}
}

class MoveToNewOrExistingFolderSettingsTab extends PluginSettingTab {
	plugin: BetterMoverPlugin;

	constructor(app: App, plugin: BetterMoverPlugin) {
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
			.setName("Automatically proceed to the next file")
			.setDesc("Allows you to process a folder like an Inbox quickly.")
			.addToggle((setting) => {
				setting
				.setValue(this.plugin.settings.openNextFileInFolder)
				.onChange(async (value) => {
					this.plugin.settings.openNextFileInFolder = value;
					await this.plugin.saveSettings();
				})
			});
	}
}
