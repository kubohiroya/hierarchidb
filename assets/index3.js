import { a as isValidFolderName, i as isFolderEntity, n as FolderError, o as normalizeFolderPeerData, r as FolderErrorType, t as FOLDER_CONSTANTS } from "./types.js";
import "@hierarchidb/common-api";
import { registerTaggable, unregisterTaggable } from "@hierarchidb/tag";
import { BaseDialogPlugin as BaseDialogPlugin$1, wrapDialogStepComponent } from "@hierarchidb/plugin-ui-sdk";
import { readRuntimeMode } from "@hierarchidb/util";

//#region src/plugin-manifest.ts
const PLUGIN_ID = "@hierarchidb/folder-plugin";
const PLUGIN_VERSION = "1.0.0";
const PLUGIN_DESCRIPTION = "Basic folder plugin for HierarchiDB UI layer";
const PLUGIN_NODE_TYPE = "folder";
const PLUGIN_MANIFEST = {
	id: PLUGIN_ID,
	name: "Folder Plugin",
	displayName: "Folder",
	nodeType: PLUGIN_NODE_TYPE,
	version: PLUGIN_VERSION,
	description: PLUGIN_DESCRIPTION,
	priority: 1e3,
	dependencies: [],
	icon: {
		mui: "Folder",
		emoji: "📁",
		color: "#c0eeff",
		component: {
			specifier: "@hierarchidb/folder-plugin/icon",
			exportName: "FolderPluginIcon"
		}
	},
	category: {
		id: "core",
		menuGroup: "core",
		createOrder: 1e3
	},
	capabilities: {
		canHaveChildren: true,
		canBeRoot: true,
		canBeDeleted: true,
		canBeRenamed: true,
		canBeMoved: true,
		canBeCopied: true
	},
	schema: { fields: [{
		name: "name",
		type: "string",
		required: true
	}, {
		name: "description",
		type: "string",
		required: false
	}] },
	worker: { preload: ["registerFolderWorkerStores"] }
};

//#endregion
//#region src/common/api/NodeDialogExtensionAPI.ts
/**
* @deprecated Use `folderExtensionRegistry` instead.
*/
/**
* @deprecated Prefer importing from `@hierarchidb/base-plugin` directly.
*/
function createFolderExtension$1(config) {
	return {
		id: config.id,
		name: config.name,
		description: config.description,
		metadata: {
			id: config.id,
			name: config.name,
			version: config.version,
			dependencies: config.dependencies || [],
			description: config.description
		},
		dialog: config.dialog,
		entity: config.entity,
		lifecycle: config.lifecycle
	};
}

//#endregion
//#region src/common/api/DialogExtensionAPI.ts
/**
* Registry for folder-plugin extensions
*/
var FolderExtensionRegistry = class FolderExtensionRegistry {
	static instance = null;
	extensions = /* @__PURE__ */ new Map();
	dependencyGraph = /* @__PURE__ */ new Map();
	/**
	* Get singleton instance
	*/
	static getInstance() {
		if (!FolderExtensionRegistry.instance) FolderExtensionRegistry.instance = new FolderExtensionRegistry();
		return FolderExtensionRegistry.instance;
	}
	/**
	* Reset instance (mainly for testing)
	*/
	static resetInstance() {
		FolderExtensionRegistry.instance = null;
	}
	/**
	* Register a folder-plugin extension
	*/
	register(extension) {
		if (this.wouldCreateCircularDependency(extension)) throw new Error(`Circular dependency detected when registering extension: ${extension.id}`);
		const dependencies = extension.metadata.dependencies || [];
		for (const dep of dependencies) if (!this.extensions.has(dep)) throw new Error(`Extension ${extension.id} depends on ${dep}, which is not registered`);
		this.extensions.set(extension.id, extension);
		this.updateDependencyGraph(extension);
	}
	/**
	* Unregister a folder-plugin extension
	*/
	unregister(extensionId) {
		const dependents = this.getDependents(extensionId);
		if (dependents.length > 0) throw new Error(`Cannot unregister ${extensionId}, the following extensions depend on it: ${dependents.join(", ")}`);
		this.extensions.delete(extensionId);
		this.dependencyGraph.delete(extensionId);
	}
	/**
	* Get all registered extensions
	*/
	getAllExtensions() {
		return Array.from(this.extensions.values());
	}
	/**
	* Get extension by ID
	*/
	getExtension(id) {
		return this.extensions.get(id);
	}
	/**
	* Get extensions in dependency order
	*/
	getExtensionsInOrder() {
		const visited = /* @__PURE__ */ new Set();
		const result = [];
		const visit = (id) => {
			if (visited.has(id)) return;
			visited.add(id);
			const extension = this.extensions.get(id);
			if (!extension) return;
			const dependencies = extension.metadata.dependencies || [];
			for (const dep of dependencies) visit(dep);
			result.push(extension);
		};
		for (const id of this.extensions.keys()) visit(id);
		return result;
	}
	/**
	* Get all base-dialog steps for create mode
	*/
	getCreateDialogSteps() {
		const steps = [];
		const extensions = this.getExtensionsInOrder();
		for (const ext of extensions) if (ext.dialog?.createSteps) steps.push(...ext.dialog.createSteps);
		return steps.sort((a, b) => a.stepNumber - b.stepNumber);
	}
	/**
	* Get all base-dialog steps for edit mode
	*/
	getEditDialogSteps() {
		const steps = [];
		const extensions = this.getExtensionsInOrder();
		for (const ext of extensions) if (ext.dialog?.editSteps) steps.push(...ext.dialog.editSteps);
		return steps.sort((a, b) => a.stepNumber - b.stepNumber);
	}
	/**
	* Get all dialog evaluators registered by extensions (dependency order).
	*/
	getDialogEvaluators() {
		const evaluators = [];
		const extensions = this.getExtensionsInOrder();
		for (const ext of extensions) if (ext.dialog?.evaluateSteps) evaluators.push(ext.dialog.evaluateSteps);
		return evaluators;
	}
	/**
	* Get all submit-eligibility evaluators registered by extensions.
	*/
	getSubmitEvaluators() {
		const result = [];
		const extensions = this.getExtensionsInOrder();
		for (const ext of extensions) if (ext.dialog?.canSubmit) result.push(ext.dialog.canSubmit);
		return result;
	}
	/**
	* Apply all data transformations
	*/
	async transformData(data) {
		let result = { ...data };
		const extensions = this.getExtensionsInOrder();
		for (const ext of extensions) if (ext.dialog?.transformData) result = ext.dialog.transformData(result);
		return result;
	}
	/**
	* Apply all entity transformations before save
	*/
	async beforeSaveEntity(entity) {
		let result = { ...entity };
		const extensions = this.getExtensionsInOrder();
		for (const ext of extensions) if (ext.entity?.beforeSave) result = await ext.entity.beforeSave(result);
		return result;
	}
	/**
	* Apply all entity transformations after load
	*/
	async afterLoadEntity(entity) {
		let result = { ...entity };
		const extensions = this.getExtensionsInOrder();
		for (const ext of extensions) if (ext.entity?.afterLoad) result = await ext.entity.afterLoad(result);
		return result;
	}
	/**
	* Validate entity with all extensions
	*/
	async validateEntity(entity) {
		const errors = [];
		const extensions = this.getExtensionsInOrder();
		for (const ext of extensions) if (ext.entity?.validateEntity) {
			const extErrors = await ext.entity.validateEntity(entity);
			errors.push(...extErrors);
		}
		return errors;
	}
	/**
	* Execute lifecycle hook: afterCreate
	*/
	async executeAfterCreate(node, entity) {
		const extensions = this.getExtensionsInOrder();
		for (const ext of extensions) if (ext.lifecycle?.afterCreate) await ext.lifecycle.afterCreate(node, entity);
	}
	/**
	* Execute lifecycle hook: beforeUpdate
	*/
	async executeBeforeUpdate(node, entity, changes) {
		const extensions = this.getExtensionsInOrder();
		for (const ext of extensions) if (ext.lifecycle?.beforeUpdate) await ext.lifecycle.beforeUpdate(node, entity, changes);
	}
	/**
	* Execute lifecycle hook: afterUpdate
	*/
	async executeAfterUpdate(node, entity) {
		const extensions = this.getExtensionsInOrder();
		for (const ext of extensions) if (ext.lifecycle?.afterUpdate) await ext.lifecycle.afterUpdate(node, entity);
	}
	/**
	* Execute lifecycle hook: beforeDelete
	*/
	async executeBeforeDelete(node, entity) {
		const extensions = this.getExtensionsInOrder();
		for (const ext of extensions) if (ext.lifecycle?.beforeDelete) await ext.lifecycle.beforeDelete(node, entity);
	}
	/**
	* Build plugin extension config from registered extensions
	*/
	buildExtensionConfig() {
		const extensions = this.getExtensionsInOrder();
		const createSteps = [];
		const editSteps = [];
		let combinedValidation;
		let combinedEntity;
		for (const ext of extensions) {
			if (ext.dialog?.createSteps) createSteps.push(...ext.dialog.createSteps);
			if (ext.dialog?.editSteps) editSteps.push(...ext.dialog.editSteps);
			if (ext.dialog?.validation) combinedValidation = ext.dialog.validation;
			if (ext.entity) combinedEntity = ext.entity;
		}
		return {
			dialog: {
				createSteps: createSteps.length > 0 ? createSteps : void 0,
				editSteps: editSteps.length > 0 ? editSteps : void 0
			},
			validation: combinedValidation,
			entity: combinedEntity,
			metadata: {
				id: "folder-plugin-extension-combined",
				name: "Combined Folder Extensions",
				version: "1.0.0",
				description: "Combined configuration from all folder-plugin extensions",
				dependencies: extensions.flatMap((ext) => ext.metadata.dependencies || [])
			}
		};
	}
	/**
	* Create an ExtendingNodeTypeDefinition from the base folder-plugin definition and extensions
	*/
	createExtendableDefinition(baseDefinition) {
		const config = this.buildExtensionConfig();
		const extensions = this.getExtensionsInOrder();
		return {
			extends: baseDefinition.extends,
			nodeType: baseDefinition.nodeType,
			name: baseDefinition.name,
			displayName: baseDefinition.displayName,
			extendedSteps: config.dialog?.createSteps || config.dialog?.editSteps,
			extendedFields: extensions.flatMap((ext) => ext.metadata.dependencies || []).map((dep) => ({
				name: dep,
				type: "string",
				required: false
			})),
			extendedValidation: config.validation,
			baseDefinition: baseDefinition.baseDefinition
		};
	}
	wouldCreateCircularDependency(extension) {
		const dependencies = extension.metadata.dependencies || [];
		for (const dep of dependencies) if (this.hasPathTo(dep, extension.id)) return true;
		return false;
	}
	hasPathTo(from, to) {
		if (from === to) return true;
		const visited = /* @__PURE__ */ new Set();
		const queue = [from];
		while (queue.length > 0) {
			const current = queue.shift();
			if (visited.has(current)) continue;
			visited.add(current);
			const deps = this.dependencyGraph.get(current) || /* @__PURE__ */ new Set();
			if (deps.has(to)) return true;
			queue.push(...deps);
		}
		return false;
	}
	updateDependencyGraph(extension) {
		const dependencies = extension.metadata.dependencies || [];
		this.dependencyGraph.set(extension.id, new Set(dependencies));
	}
	getDependents(extensionId) {
		const dependents = [];
		for (const [id, deps] of this.dependencyGraph.entries()) if (deps.has(extensionId)) dependents.push(id);
		return dependents;
	}
};
const nodeDialogExtensionRegistry = FolderExtensionRegistry.getInstance();
/**
* Helper function to create a folder-plugin extension
*/
function createFolderExtension(config) {
	return {
		id: config.id,
		name: config.name,
		description: config.description,
		metadata: {
			id: config.id,
			name: config.name,
			version: config.version,
			dependencies: config.dependencies || [],
			description: config.description
		},
		dialog: config.dialog,
		entity: config.entity,
		lifecycle: config.lifecycle
	};
}
const folderExtensionRegistry = FolderExtensionRegistry.getInstance();

//#endregion
//#region src/common/base/BaseDialogPlugin.ts
/**
* Base class for dialog-based extensions wired into the folder-plugin dialog system
*/
var BaseDialogPlugin = class extends BaseDialogPlugin$1 {
	/**
	* Other dialog extensions this plugin depends on
	*/
	dependencies = [];
	async initialize() {
		await super.onInitialize();
		registerTaggable("folder");
	}
	async cleanup() {
		await super.onCleanup();
		folderExtensionRegistry.unregister(this.pluginId);
		unregisterTaggable("folder");
	}
	/**
	* Create the dialog extension configuration
	*/
	createExtension() {
		const base = super.createExtension();
		return createFolderExtension$1({
			id: base.id,
			name: base.name,
			description: base.description,
			version: base.metadata.version,
			dependencies: base.metadata.dependencies,
			dialog: base.dialog,
			entity: this.createEntityExtension(),
			lifecycle: {
				afterCreate: this.afterCreate?.bind(this),
				beforeUpdate: this.beforeUpdate?.bind(this),
				afterUpdate: this.afterUpdate?.bind(this),
				beforeDelete: this.beforeDelete?.bind(this)
			}
		});
	}
	/**
	* Create entity extension configuration
	*/
	createEntityExtension() {
		const additionalFields = this.getAdditionalEntityFields();
		const beforeSave = this.beforeSaveEntity?.bind(this);
		const afterLoad = this.afterLoadEntity?.bind(this);
		const validateEntity = this.validateEntity?.bind(this);
		const getExtendedData = this.getExtendedData?.bind(this) ?? (async (_nodeId) => ({}));
		const saveExtendedData = this.saveExtendedData?.bind(this) ?? (async (_nodeId, _data) => {});
		if (!additionalFields?.length && !beforeSave && !afterLoad && !validateEntity) return;
		return {
			additionalFields,
			beforeSave,
			afterLoad,
			validateEntity,
			getExtendedData,
			saveExtendedData
		};
	}
	/**
	* Override to specify additional entity fields
	*/
	getAdditionalEntityFields() {}
	/**
	* Override to transform entity before saving
	*/
	async beforeSaveEntity(entity) {
		return entity;
	}
	/**
	* Override to transform entity after loading
	*/
	async afterLoadEntity(entity) {
		return entity;
	}
	/**
	* Override to validate entity
	*/
	async validateEntity(_entity) {
		return [];
	}
	/**
	* Override to get extended data from entity
	*/
	async getExtendedData(_nodeId) {
		return {};
	}
	/**
	* Override to save extended data to entity
	*/
	async saveExtendedData(_nodeId, _data) {}
	/**
	* Lifecycle hook: called after folder-plugin creation
	*/
	async afterCreate(_node, _entity) {}
	/**
	* Lifecycle hook: called before folder-plugin update
	*/
	async beforeUpdate(_node, _entity, _changes) {}
	/**
	* Lifecycle hook: called after folder-plugin update
	*/
	async afterUpdate(_node, _entity) {}
	/**
	* Lifecycle hook: called before folder-plugin deletion
	*/
	async beforeDelete(_node, _entity) {}
	/**
	* Helper method to create a field extension
	*/
	createFieldExtension(config) {
		return {
			fieldName: `${this.pluginId}_${config.fieldName}`,
			fieldType: config.fieldType,
			label: config.label,
			description: config.description,
			required: config.required,
			defaultValue: config.defaultValue,
			validation: config.validation,
			pluginId: this.pluginId
		};
	}
};

//#endregion
//#region src/common/base/BaseFolderPlugin.ts
/**
* Base class for plugin-loader that extend the folder-plugin plugin
*/
var BaseFolderPlugin = class {
	/**
	* Other folder-plugin extensions this plugin depends on
	*/
	dependencies = [];
	/**
	* Initialize the plugin and register with folder-plugin extension system
	*/
	async initialize() {
		const extension = this.createExtension();
		folderExtensionRegistry.register(extension);
		await this.onInitialize();
		registerTaggable("folder");
	}
	/**
	* Cleanup when plugin is unloaded
	*/
	async cleanup() {
		await this.onCleanup();
		folderExtensionRegistry.unregister(this.pluginId);
		unregisterTaggable("folder");
	}
	/**
	* Create the folder-plugin extension configuration
	*/
	createExtension() {
		return createFolderExtension({
			id: this.pluginId,
			name: this.pluginName,
			description: this.pluginDescription,
			version: this.pluginVersion,
			dependencies: this.dependencies,
			dialog: this.createDialogExtension(),
			entity: this.createEntityExtension(),
			lifecycle: {
				afterCreate: this.afterCreate?.bind(this),
				beforeUpdate: this.beforeUpdate?.bind(this),
				afterUpdate: this.afterUpdate?.bind(this),
				beforeDelete: this.beforeDelete?.bind(this)
			}
		});
	}
	/**
	* Create base-dialog extension configuration
	*/
	createDialogExtension() {
		const createSteps = this.getCreateDialogSteps();
		const editSteps = this.getEditDialogSteps();
		const transformData = this.transformDialogData?.bind(this);
		const validation = this.getValidationExtension();
		const evaluateSteps = this.getStepStateEvaluator?.bind(this)();
		const canSubmit = this.getSubmitEligibility?.bind(this)();
		if (!createSteps && !editSteps && !transformData && !validation && !evaluateSteps && !canSubmit) return;
		return {
			createSteps,
			editSteps,
			transformData,
			validation,
			evaluateSteps,
			canSubmit
		};
	}
	/**
	* Create entity extension configuration
	*/
	createEntityExtension() {
		const additionalFields = this.getAdditionalEntityFields();
		const beforeSave = this.beforeSaveEntity?.bind(this);
		const afterLoad = this.afterLoadEntity?.bind(this);
		const validateEntity = this.validateEntity?.bind(this);
		const getExtendedData = this.getExtendedData?.bind(this) ?? (async (_nodeId) => ({}));
		const saveExtendedData = this.saveExtendedData?.bind(this) ?? (async (_nodeId, _data) => {});
		if (!additionalFields?.length && !beforeSave && !afterLoad && !validateEntity) return;
		return {
			additionalFields,
			beforeSave,
			afterLoad,
			validateEntity,
			getExtendedData,
			saveExtendedData
		};
	}
	/**
	* Override to provide additional base-dialog steps for create mode
	*/
	getCreateDialogSteps() {}
	/**
	* Override to provide additional base-dialog steps for edit mode
	*/
	getEditDialogSteps() {}
	/**
	* Override to transform base-dialog data before submission
	*/
	transformDialogData(data) {
		return data;
	}
	/**
	* Override to provide validation extension
	*/
	getValidationExtension() {}
	/**
	* Override to specify additional entity fields
	*/
	getAdditionalEntityFields() {}
	/**
	* Override to transform entity before saving
	*/
	async beforeSaveEntity(entity) {
		return entity;
	}
	/**
	* Override to transform entity after loading
	*/
	async afterLoadEntity(entity) {
		return entity;
	}
	/**
	* Override to validate entity
	*/
	async validateEntity(_entity) {
		return [];
	}
	/**
	* Override to get extended data from entity
	*/
	async getExtendedData(_nodeId) {
		return {};
	}
	/**
	* Override to save extended data to entity
	*/
	async saveExtendedData(_nodeId, _data) {}
	/**
	* Lifecycle hook: called after folder-plugin creation
	*/
	async afterCreate(_node, _entity) {}
	/**
	* Lifecycle hook: called before folder-plugin update
	*/
	async beforeUpdate(_node, _entity, _changes) {}
	/**
	* Lifecycle hook: called after folder-plugin update
	*/
	async afterUpdate(_node, _entity) {}
	/**
	* Lifecycle hook: called before folder-plugin deletion
	*/
	async beforeDelete(_node, _entity) {}
	/**
	* Override to perform additional initialization
	*/
	async onInitialize() {}
	/**
	* Override to perform additional cleanup
	*/
	async onCleanup() {}
	/**
	* Helper method to create a base-dialog step definition
	*/
	createDialogStep(config) {
		const StepWrapper = wrapDialogStepComponent(config.component);
		return {
			stepNumber: config.order ?? 0,
			title: config.label,
			component: StepWrapper,
			validation: config.validation ? { validate: async (data) => {
				const result = await config.validation.validate(data);
				return result.isValid ? { valid: true } : {
					valid: false,
					message: (result.errors || []).join(", ")
				};
			} } : void 0
		};
	}
	/**
	* Helper method to create a field extension
	*/
	createFieldExtension(config) {
		return {
			fieldName: `${this.pluginId}_${config.fieldName}`,
			fieldType: config.fieldType,
			label: config.label,
			description: config.description,
			required: config.required,
			defaultValue: config.defaultValue,
			validation: config.validation,
			pluginId: this.pluginId
		};
	}
};

//#endregion
//#region src/common/init/register-default-extensions.ts
/**
* register-default-extensions
* Initializes common folder dialog extensions (shape, spreadsheet, basemap, styler) if available.
* Safe to call multiple times; underlying registry ignores duplicate registrations.
*/
async function registerNodeDialogDefaults() {
	const inits = [];
	const tryInit = async (loader, pick) => {
		try {
			const fn = pick(await loader());
			if (typeof fn === "function") inits.push(fn);
		} catch {}
	};
	const SHAPE = "@hierarchidb/shape-plugin";
	const SHEET = "@hierarchidb/spreadsheet-plugin";
	const BASEMAP = "@hierarchidb/basemap-plugin";
	const BASEMAP_WORKER = "@hierarchidb/basemap-plugin/worker";
	const STYLER = "@hierarchidb/styler-plugin";
	await Promise.all([
		tryInit(() => import(
			/* @vite-ignore */
			SHAPE
), (mod) => mod.initializeShapeDialogExtension),
		tryInit(() => import(
			/* @vite-ignore */
			BASEMAP_WORKER
), (mod) => mod.registerBasemapWorkerStores),
		tryInit(() => import(
			/* @vite-ignore */
			SHEET
), (mod) => mod.initializeSpreadsheetDialogExtension),
		tryInit(() => import(
			/* @vite-ignore */
			BASEMAP
), (mod) => mod.initializeBaseMapDialogExtension),
		tryInit(() => import(
			/* @vite-ignore */
			STYLER
), (mod) => mod.initializeStylerDialogExtension)
	]);
	for (const fn of inits) await fn();
}
/**
* Generic name that doesn’t assume “folder” as a concept.
* Prefer this in new code.
*/
async function initializeDefaultNodeDialogExtensions() {
	await registerNodeDialogDefaults();
}
async function initializeDefaultFolderExtensions() {
	if (readRuntimeMode() !== "production") console.warn("[Deprecation] initializeDefaultFolderExtensions is deprecated. Use initializeDefaultNodeDialogExtensions instead.");
	await registerNodeDialogDefaults();
}

//#endregion
//#region src/index.ts
var RuntimeWiring = class {
	static async registerRuntimeWorkerAdapters() {}
};

//#endregion
export { BaseDialogPlugin, BaseFolderPlugin, FOLDER_CONSTANTS, FolderError, FolderErrorType, PLUGIN_MANIFEST as FolderPluginManifest, RuntimeWiring, initializeDefaultFolderExtensions, initializeDefaultNodeDialogExtensions, isFolderEntity, isValidFolderName, normalizeFolderPeerData };
//# sourceMappingURL=index.js.map