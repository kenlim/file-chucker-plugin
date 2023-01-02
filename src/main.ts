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
	TAbstractFile,
	Notice,
} from "obsidian";

// Remember to rename these classes and interfaces!
interface FileChuckerPluginSettings {
	proceedToNextFileInFolder: boolean;
	debugMode: boolean;
}

const DEFAULT_SETTINGS: FileChuckerPluginSettings = {
	proceedToNextFileInFolder: false,
	debugMode: false,
};

export default class FileChuckerPlugin extends Plugin {
	settings: FileChuckerPluginSettings;

	async onload() {
		await this.loadSettings();

		// Commands with editorCallbacks only work if there is a file open.
		this.addCommand({
			id: "move-to-new-or-existing-folder",
			name: "Move to new or existing folder",
			checkCallback: (checking) => {
				if (checking) {
					// make sure the active view is a MarkdownView.
					return !!this.app.workspace.getActiveViewOfType(
						MarkdownView
					);
				}
				let view = this.app.workspace.getActiveViewOfType(MarkdownView);
				if (!view || !(view instanceof MarkdownView)) return;

				const currentFile = view.file;
				new FileChuckerModal(
					this.app,
					currentFile,
					this.settings
				).open();
			},
		});

		// This adds a settings tab so the user can configure various aspects of the plugin
		this.addSettingTab(new FileChuckerSettingsTab(this.app, this));
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

export class FileChuckerModal extends SuggestModal<TFolder> {
	showingNoSuggestions = false;
	currentFile: TFile;
	currentFilePath: string;
	settings: FileChuckerPluginSettings;
	vault: Vault;
	inputListener: EventListener;

	constructor(
		app: App,
		currentFile: TFile,
		settings: FileChuckerPluginSettings
	) {
		super(app);
		this.vault = app.vault;
		this.currentFile = currentFile;
		this.settings = settings;
		this.currentFilePath = this.vault.getResourcePath(this.currentFile);
		this.inputListener = this.listenInput.bind(this);
	}

	onOpen() {
		this.inputEl.addEventListener("keydown", this.inputListener);
		super.onOpen();
	}

	onClose() {
		this.inputEl.removeEventListener("keydown", this.inputListener);
	}

	listenInput(evt: KeyboardEvent) {
		if (evt.key === "Tab") {
			this.setSelectedEntryToTextEntryField();
		}
	}

	private setSelectedEntryToTextEntryField() {
		this.inputEl.value = this.getSelectedEntryPath();
	}

	private getSelectedEntryPath() {
		const selectedItem = this.modalEl.getElementsByClassName("is-selected");
		return selectedItem.length > 0 ? selectedItem[0].getText() : "";
	}

	// list suggestions against the query
	getSuggestions(query: string): TFolder[] {
		// since a new query was entered, reset the createFolder flag.
		if (this.showingNoSuggestions) {
			this.showingNoSuggestions = false;
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
		this.showingNoSuggestions = true;

		const resultsBlock =
			this.modalEl.getElementsByClassName("prompt-results");
		if (resultsBlock.length > 0) {
			const resultBox = resultsBlock[0];
			resultBox.empty();
			resultBox.createEl("div", {
				text: "Create folder and move file to it",
				cls: "suggestion-empty",
			});
		}
	}

	// Renders each suggestion item.
	renderSuggestion(folder: TFolder, el: HTMLElement): void {
		el.createEl("div", { text: folder.path });
	}

	selectSuggestion(folder: TFolder, evt: MouseEvent | KeyboardEvent): void {
		const originalFolder = this.currentFile.parent;

		const specifiedFolderPath = this.showingNoSuggestions
			? this.inputEl.value
			: folder.path;

		// Make sure the selected folder exists
		(async () => {
			const targetFolder =
				app.vault.getAbstractFileByPath(specifiedFolderPath);

			if (targetFolder === null) {
				if (this.settings.debugMode) {
					console.log(
						`${specifiedFolderPath} does not exist. Creating now...`
					);
				}
				await app.vault.createFolder(specifiedFolderPath);
			}
			const newFilePath =
				specifiedFolderPath + "/" + this.currentFile.name;
			if (this.settings.debugMode) {
				console.log(
					`Moving ${this.currentFile.path} to ${newFilePath}`
				);
			}
			await app.fileManager.renameFile(this.currentFile, newFilePath);
			if (this.settings.proceedToNextFileInFolder) {
				const isAFile = (thing: TAbstractFile): thing is TFile => {
					return thing instanceof TFile;
				};
				if (this.settings.debugMode) {
					console.log(`Auto-proceeding to the next file.`);
				}

				const nextFile: TFile[] =
					originalFolder.children.filter(isAFile);

				if (nextFile.length > 0) {
					const newLeaf = app.workspace.getLeaf();
					const toOpen = nextFile[0];
					if (this.settings.debugMode) {
						console.log(`Opening ${toOpen.path}`);
					}
					await newLeaf.openFile(toOpen);
				} else {
					if (this.settings.debugMode) {
						console.log(`Nothing to open. Folder is now empty.`);
					}
					new Notice("Folder now empty.");
				}
			}
		})();

		this.close();
	}

	// not sure what this is for because I can't trigger it.
	onChooseSuggestion(item: TFolder, evt: MouseEvent | KeyboardEvent): void {
		throw new Error("Method not implemented.");
	}
}

class FileChuckerSettingsTab extends PluginSettingTab {
	plugin: FileChuckerPlugin;

	constructor(app: App, plugin: FileChuckerPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;

		containerEl.empty();

		containerEl.createEl("h2", {
			text: "Options for File Chucker",
		});

		new Setting(containerEl)
			.setName("Automatically proceed to the next file")
			.setDesc("Allows you to process a folder like an Inbox quickly.")
			.addToggle((setting) => {
				setting
					.setValue(this.plugin.settings.proceedToNextFileInFolder)
					.onChange(async (value) => {
						this.plugin.settings.proceedToNextFileInFolder = value;
						await this.plugin.saveSettings();
					});
			});

		new Setting(containerEl)
			.setName("Enable debug mode")
			.setDesc(
				"Prints out message in the Console to help diagnose issues with this plugin."
			)
			.addToggle((setting) => {
				setting
					.setValue(this.plugin.settings.debugMode)
					.onChange(async (value) => {
						this.plugin.settings.debugMode = value;
						await this.plugin.saveSettings();
					});
			});
	}
}
