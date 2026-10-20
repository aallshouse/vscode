/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// AI removed: this build has no chat, language models, MCP, speech or AI
// search. The `vscode.ai`, `vscode.chat`, `vscode.lm` and `vscode.speech`
// namespaces keep their full API shape so that extensions using them still
// activate, but every call is inert: registrations return a no-op disposable,
// queries resolve to empty results, events never fire, and requests that
// would need a model or chat session reject with a clear error.

import { Event } from '../../../base/common/event.js';
import { IExtensionDescription } from '../../../platform/extensions/common/extensions.js';
import { checkProposedApiEnabled } from '../../services/extensions/common/extensions.js';
import type * as vscode from 'vscode';

const UNAVAILABLE = 'AI features are not available in this build.';

function noopDisposable(): vscode.Disposable {
	return { dispose() { } };
}

function unavailable(): Promise<never> {
	return Promise.reject(new Error(UNAVAILABLE));
}

export function createInertLanguageModelAccessInformation(): vscode.LanguageModelAccessInformation {
	return {
		onDidChange: Event.None,
		canSendRequest: () => undefined,
	};
}

export function createInertChatStatusItem(id: string): vscode.ChatStatusItem {
	return {
		id,
		title: '',
		description: '',
		detail: undefined,
		tooltip: undefined,
		show() { },
		hide() { },
		dispose() { },
	};
}

export function createInertAgentEditorComments(): vscode.AgentEditorCommentsProvider {
	return {
		comments: [],
		acceptsComments: false,
		onDidChange: Event.None,
		onDidRevealComment: Event.None,
		addComment() { },
		deleteComment() { },
		dispose() { },
	};
}

export function transferActiveChatUnavailable(): Promise<void> {
	return Promise.resolve();
}

function createInertChatParticipant(id: string, requestHandler: vscode.ChatRequestHandler): vscode.ChatParticipant {
	return {
		id,
		iconPath: undefined,
		requestHandler,
		followupProvider: undefined,
		onDidReceiveFeedback: Event.None,
		onDidPerformAction: Event.None,
		onDidChangePauseState: Event.None,
		dispose() { },
	};
}

function createInertChatInputNotification(id: string): vscode.ChatInputNotification {
	return {
		id,
		severity: 0 as vscode.ChatInputNotificationSeverity,
		message: '',
		description: undefined,
		actions: [],
		dismissible: true,
		autoDismissOnMessage: false,
		sessionTypes: undefined,
		show() { },
		hide() { },
		dispose() { },
	};
}

export function createInertAiApi(extension: IExtensionDescription): typeof vscode.ai {
	return {
		getRelatedInformation() {
			checkProposedApiEnabled(extension, 'aiRelatedInformation');
			return Promise.resolve([]);
		},
		registerRelatedInformationProvider() {
			checkProposedApiEnabled(extension, 'aiRelatedInformation');
			return noopDisposable();
		},
		registerEmbeddingVectorProvider() {
			checkProposedApiEnabled(extension, 'aiRelatedInformation');
			return noopDisposable();
		},
		registerSettingsSearchProvider() {
			checkProposedApiEnabled(extension, 'aiSettingsSearch');
			return noopDisposable();
		},
	};
}

export function createInertChatApi(extension: IExtensionDescription): typeof vscode.chat {
	return {
		registerMappedEditsProvider() {
			checkProposedApiEnabled(extension, 'mappedEditsProvider');
			return noopDisposable();
		},
		registerMappedEditsProvider2() {
			checkProposedApiEnabled(extension, 'mappedEditsProvider');
			return noopDisposable();
		},
		createChatParticipant(id, handler) {
			return createInertChatParticipant(id, handler);
		},
		createDynamicChatParticipant(id, _dynamicProps, handler) {
			checkProposedApiEnabled(extension, 'chatParticipantPrivate');
			return createInertChatParticipant(id, handler);
		},
		registerChatParticipantDetectionProvider() {
			checkProposedApiEnabled(extension, 'chatParticipantPrivate');
			return noopDisposable();
		},
		onDidDisposeChatSession: (...args) => {
			checkProposedApiEnabled(extension, 'chatParticipantPrivate');
			return Event.None(...args);
		},
		updateQuotas() {
			checkProposedApiEnabled(extension, 'chatParticipantPrivate');
		},
		registerChatSessionItemProvider() {
			checkProposedApiEnabled(extension, 'chatSessionsProvider');
			return noopDisposable();
		},
		createChatSessionItemController() {
			checkProposedApiEnabled(extension, 'chatSessionsProvider');
			throw new Error(UNAVAILABLE);
		},
		registerChatSessionContentProvider() {
			checkProposedApiEnabled(extension, 'chatSessionsProvider');
			return noopDisposable();
		},
		registerChatOutputRenderer() {
			checkProposedApiEnabled(extension, 'chatOutputRenderer');
			return noopDisposable();
		},
		registerChatWorkspaceContextProvider() {
			checkProposedApiEnabled(extension, 'chatContextProvider');
			return noopDisposable();
		},
		registerChatAttachContextProvider() {
			checkProposedApiEnabled(extension, 'chatContextProvider');
			return noopDisposable();
		},
		registerChatTabContextProvider() {
			checkProposedApiEnabled(extension, 'chatContextProvider');
			return noopDisposable();
		},
		registerChatExplicitContextProvider() {
			checkProposedApiEnabled(extension, 'chatContextProvider');
			return noopDisposable();
		},
		registerChatResourceContextProvider() {
			checkProposedApiEnabled(extension, 'chatContextProvider');
			return noopDisposable();
		},
		registerCustomAgentProvider() {
			checkProposedApiEnabled(extension, 'chatPromptFiles');
			return noopDisposable();
		},
		registerInstructionsProvider() {
			checkProposedApiEnabled(extension, 'chatPromptFiles');
			return noopDisposable();
		},
		registerPromptFileProvider() {
			checkProposedApiEnabled(extension, 'chatPromptFiles');
			return noopDisposable();
		},
		registerSkillProvider() {
			checkProposedApiEnabled(extension, 'chatPromptFiles');
			return noopDisposable();
		},
		registerHookProvider() {
			checkProposedApiEnabled(extension, 'chatPromptFiles');
			return noopDisposable();
		},
		registerChatDebugLogProvider() {
			checkProposedApiEnabled(extension, 'chatDebug');
			return noopDisposable();
		},
		onDidReceiveChatDebugEvent: (...args) => {
			checkProposedApiEnabled(extension, 'chatDebug');
			return Event.None(...args);
		},
		getCustomAgents() {
			checkProposedApiEnabled(extension, 'chatPromptFiles');
			return Promise.resolve([]);
		},
		onDidChangeCustomAgents: (...args) => {
			checkProposedApiEnabled(extension, 'chatPromptFiles');
			return Event.None(...args);
		},
		getInstructions() {
			checkProposedApiEnabled(extension, 'chatPromptFiles');
			return Promise.resolve([]);
		},
		onDidChangeInstructions: (...args) => {
			checkProposedApiEnabled(extension, 'chatPromptFiles');
			return Event.None(...args);
		},
		getSkills() {
			checkProposedApiEnabled(extension, 'chatPromptFiles');
			return Promise.resolve([]);
		},
		onDidChangeSkills: (...args) => {
			checkProposedApiEnabled(extension, 'chatPromptFiles');
			return Event.None(...args);
		},
		getSlashCommands() {
			checkProposedApiEnabled(extension, 'chatPromptFiles');
			return Promise.resolve([]);
		},
		onDidChangeSlashCommands: (...args) => {
			checkProposedApiEnabled(extension, 'chatPromptFiles');
			return Event.None(...args);
		},
		getHooks() {
			checkProposedApiEnabled(extension, 'chatPromptFiles');
			return Promise.resolve([]);
		},
		onDidChangeHooks: (...args) => {
			checkProposedApiEnabled(extension, 'chatPromptFiles');
			return Event.None(...args);
		},
		getPlugins() {
			checkProposedApiEnabled(extension, 'chatPromptFiles');
			return Promise.resolve([]);
		},
		onDidChangePlugins: (...args) => {
			checkProposedApiEnabled(extension, 'chatPromptFiles');
			return Event.None(...args);
		},
		registerChatSessionCustomizationProvider() {
			checkProposedApiEnabled(extension, 'chatSessionCustomizationProvider');
			return noopDisposable();
		},
		createInputNotification(id) {
			checkProposedApiEnabled(extension, 'chatInputNotification');
			return createInertChatInputNotification(id);
		},
	};
}

export function createInertLanguageModelApi(extension: IExtensionDescription): typeof vscode.lm {
	return {
		selectChatModels: () => Promise.resolve([]),
		onDidChangeChatModels: Event.None,
		registerLanguageModelChatProvider: () => noopDisposable(),
		get isModelProxyAvailable() {
			checkProposedApiEnabled(extension, 'languageModelProxy');
			return false;
		},
		onDidChangeModelProxyAvailability: (...args) => {
			checkProposedApiEnabled(extension, 'languageModelProxy');
			return Event.None(...args);
		},
		getModelProxy: () => {
			checkProposedApiEnabled(extension, 'languageModelProxy');
			return unavailable();
		},
		registerLanguageModelProxyProvider: () => {
			checkProposedApiEnabled(extension, 'chatParticipantPrivate');
			return noopDisposable();
		},
		get embeddingModels() {
			checkProposedApiEnabled(extension, 'embeddings');
			return [];
		},
		onDidChangeEmbeddingModels: (...args) => {
			checkProposedApiEnabled(extension, 'embeddings');
			return Event.None(...args);
		},
		registerEmbeddingsProvider() {
			checkProposedApiEnabled(extension, 'embeddings');
			return noopDisposable();
		},
		computeEmbeddings() {
			checkProposedApiEnabled(extension, 'embeddings');
			return unavailable();
		},
		registerTool: () => noopDisposable(),
		registerToolDefinition: () => noopDisposable(),
		invokeTool(nameOrInfo) {
			if (typeof nameOrInfo !== 'string') {
				checkProposedApiEnabled(extension, 'chatParticipantAdditions');
			}
			return unavailable();
		},
		get tools() {
			return [];
		},
		fileIsIgnored: () => Promise.resolve(false),
		registerIgnoredFileProvider: () => noopDisposable(),
		registerMcpServerDefinitionProvider: () => noopDisposable(),
		onDidChangeMcpServerDefinitions: (...args) => {
			checkProposedApiEnabled(extension, 'mcpServerDefinitions');
			return Event.None(...args);
		},
		get mcpServerDefinitions() {
			checkProposedApiEnabled(extension, 'mcpServerDefinitions');
			return [];
		},
		startMcpGateway() {
			checkProposedApiEnabled(extension, 'mcpServerDefinitions');
			return Promise.resolve(undefined);
		},
		onDidChangeChatRequestTools: (...args) => {
			checkProposedApiEnabled(extension, 'chatParticipantAdditions');
			return Event.None(...args);
		},
	};
}

export function createInertSpeechApi(extension: IExtensionDescription): typeof vscode.speech {
	return {
		registerSpeechProvider() {
			checkProposedApiEnabled(extension, 'speech');
			return noopDisposable();
		},
	};
}
