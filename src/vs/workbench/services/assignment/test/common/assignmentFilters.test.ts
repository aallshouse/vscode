/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ICopilotTokenInfo } from '../../../../../base/common/defaultAccount.js';
import { Emitter, Event } from '../../../../../base/common/event.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { IDefaultAccountService } from '../../../../../platform/defaultAccount/common/defaultAccount.js';
import { IExtensionDescription } from '../../../../../platform/extensions/common/extensions.js';
import { TestInstantiationService } from '../../../../../platform/instantiation/test/common/instantiationServiceMock.js';
import { ILogService, NullLogService } from '../../../../../platform/log/common/log.js';
import { IStorageService, InMemoryStorageService } from '../../../../../platform/storage/common/storage.js';
import { IExtensionService } from '../../../extensions/common/extensions.js';
import { mock } from '../../../../test/common/workbenchTestServices.js';
import { CopilotAssignmentFilterProvider, ExtensionsFilter, GitHubAssignmentsFilter, GitHubCoreAssignmentsFilterProvider } from '../../common/assignmentFilters.js';

suite('CopilotAssignmentFilterProvider', () => {

	const disposables = ensureNoDisposablesAreLeakedInTestSuite();

	test('maps available filters to new TAS names and refreshes token-derived values', async () => {
		const onDidChangeCopilotTokenInfo = disposables.add(new Emitter<ICopilotTokenInfo | null>());
		const account = new class extends mock<IDefaultAccountService>() {
			override copilotTokenInfo: ICopilotTokenInfo | null = { sn: '1', fcv1: '1' };
			override readonly onDidChangeCopilotTokenInfo = onDidChangeCopilotTokenInfo.event;
		}();
		const extension = new class extends mock<IExtensionDescription>() {
			override readonly version = '0.68.0-insider';
		}();
		const extensionService = new class extends mock<IExtensionService>() {
			override readonly onDidChangeExtensionsStatus = Event.None;
			override async getExtension(id: string): Promise<IExtensionDescription | undefined> {
				return id === 'github.copilot-chat' ? extension : undefined;
			}
		}();
		const instantiationService = disposables.add(new TestInstantiationService());
		instantiationService.stub(IExtensionService, extensionService);
		instantiationService.stub(ILogService, new NullLogService());
		instantiationService.stub(IStorageService, disposables.add(new InMemoryStorageService()));
		instantiationService.stub(IDefaultAccountService, account);

		const provider = disposables.add(instantiationService.createInstance(CopilotAssignmentFilterProvider));
		await Event.toPromise(provider.onDidChangeFilters);
		const initial = Object.fromEntries(provider.getAssignmentsFilters());
		let changes = 0;
		disposables.add(provider.onDidChangeFilters(() => changes++));
		account.copilotTokenInfo = { sn: '1', fcv1: '0' };
		onDidChangeCopilotTokenInfo.fire(account.copilotTokenInfo);
		const fcv1Changed = Object.fromEntries(provider.getAssignmentsFilters());
		account.copilotTokenInfo = { sn: '0' };
		onDidChangeCopilotTokenInfo.fire(account.copilotTokenInfo);
		const refreshed = Object.fromEntries(provider.getAssignmentsFilters());

		assert.deepStrictEqual({
			initial,
			fcv1Changed,
			refreshed,
			changes,
			legacy: [
				provider.getFilterValue(ExtensionsFilter.CopilotChatExtensionVersion),
				provider.getFilterValue(ExtensionsFilter.CopilotSku),
				provider.getFilterValue(ExtensionsFilter.CopilotTrackingId),
			],
		}, {
			initial: {
				github_core_copilotsku: null,
				github_core_issn: '1',
				github_core_isfcv1: '1',
				vscode_core_copilotchatextensionversion: '0.68.0',
			},
			fcv1Changed: {
				github_core_copilotsku: null,
				github_core_issn: '1',
				github_core_isfcv1: '0',
				vscode_core_copilotchatextensionversion: '0.68.0',
			},
			refreshed: {
				github_core_copilotsku: null,
				github_core_issn: '0',
				github_core_isfcv1: '0',
				vscode_core_copilotchatextensionversion: '0.68.0',
			},
			changes: 2,
			legacy: ['0.68.0', null, null],
		});
	});
});

suite('GitHubCoreAssignmentsFilterProvider', () => {

	const disposables = ensureNoDisposablesAreLeakedInTestSuite();

	test('reports an external user without a tracking id', () => {
		const provider = disposables.add(new GitHubCoreAssignmentsFilterProvider());
		assert.deepStrictEqual(Object.fromEntries(provider.getFilters()), {
			[GitHubAssignmentsFilter.CopilotTrackingId]: null,
			[GitHubAssignmentsFilter.IsGhOrMsftStaff]: '0',
			[GitHubAssignmentsFilter.GhMsftOrExternal]: 'external',
		});
	});
});
