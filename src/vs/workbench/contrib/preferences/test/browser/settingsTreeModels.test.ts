/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { settingKeyToDisplayFormat, parseQuery, IParsedQuery, sanitizeId, SearchResultModel, SearchResultIdx, ISettingsEditorViewState, SettingsTreeSettingElement, SettingsTreeModel } from '../../browser/settingsTreeModels.js';
import { mock } from '../../../../../base/test/common/mock.js';
import { ILanguageService } from '../../../../../editor/common/languages/language.js';
import { ConfigurationTarget } from '../../../../../platform/configuration/common/configuration.js';
import { ConfigurationScope } from '../../../../../platform/configuration/common/configurationRegistry.js';
import { TestConfigurationService } from '../../../../../platform/configuration/test/common/testConfigurationService.js';
import { TestInstantiationService } from '../../../../../platform/instantiation/test/common/instantiationServiceMock.js';
import { IProductService } from '../../../../../platform/product/common/productService.js';
import { AgentNetworkDomainSettingId } from '../../../../../platform/networkFilter/common/settings.js';
import { IManagedSettingsService, NullManagedSettingsService } from '../../../../../platform/policy/common/copilotManagedSettings.js';
import { AgentSandboxSettingId } from '../../../../../platform/sandbox/common/settings.js';
import { IWorkbenchConfigurationService } from '../../../../services/configuration/common/configuration.js';
import { ExperimentalSettingsService, IExperimentalSettingsService } from '../../../../services/configuration/common/experimentalSettings.js';
import { IWorkbenchEnvironmentService } from '../../../../services/environment/common/environmentService.js';
import { ISetting, SettingMatchType } from '../../../../services/preferences/common/preferences.js';
import { IUserDataProfileService } from '../../../../services/userDataProfile/common/userDataProfile.js';
import { TestProductService, TestUserDataProfileService } from '../../../../test/common/workbenchTestServices.js';
import { EXP_ASSIGNMENT_SETTING_TAG } from '../../common/preferences.js';
import { IManagedSettingsPresentationService, ManagedSettingsPresentationService } from '../../../../services/configuration/common/managedSettingsPresentation.js';

suite('SettingsTree ExP assignments', () => {
	const store = ensureNoDisposablesAreLeakedInTestSuite();

	function createModel() {
		const instantiationService = store.add(new TestInstantiationService());
		const configuration = new class extends TestConfigurationService {
			isSettingAppliedForAllProfiles(): boolean { return false; }
		}({ 'test.modified': true });
		store.add(configuration.onDidChangeConfigurationEmitter);
		const assignments = store.add(new ExperimentalSettingsService());
		instantiationService.stub(IWorkbenchConfigurationService, configuration);
		instantiationService.stub(ILanguageService, { isRegisteredLanguageId: () => true });
		instantiationService.stub(IUserDataProfileService, new TestUserDataProfileService());
		instantiationService.stub(IProductService, TestProductService);
		instantiationService.stub(IWorkbenchEnvironmentService, {});
		instantiationService.stub(IExperimentalSettingsService, assignments);
		instantiationService.stub(IManagedSettingsService, new NullManagedSettingsService());
		instantiationService.stub(IManagedSettingsPresentationService, store.add(instantiationService.createInstance(ManagedSettingsPresentationService)));
		const viewState: ISettingsEditorViewState = { settingsTarget: ConfigurationTarget.USER_LOCAL, tagFilters: new Set([EXP_ASSIGNMENT_SETTING_TAG]) };
		const model = store.add(instantiationService.createInstance(SearchResultModel, viewState, null, true));
		const settings = ['test.assigned', 'test.experimental', 'test.modified', 'test.spoofed'].map(key => new class extends mock<ISetting>() {
			override key = key;
			override type = 'boolean';
			override description = [];
			override scope = ConfigurationScope.RESOURCE;
			override tags = key === 'test.experimental' ? ['experimental'] : key === 'test.spoofed' ? [EXP_ASSIGNMENT_SETTING_TAG] : [];
		}());
		model.setResult(SearchResultIdx.Local, {
			filterMatches: settings.map(setting => ({ setting, matches: [], matchType: SettingMatchType.None, keyMatchScore: 0, score: 0 })),
			exactMatch: false,
		});
		const read = () => ({
			count: model.getUniqueResultsCount(),
			settings: model.root.children.filter((child): child is SettingsTreeSettingElement => child instanceof SettingsTreeSettingElement)
				.map(child => ({ key: child.setting.key, assigned: child.hasExPAssignment })),
		});
		return { assignments, model, viewState, configuration, read };
	}

	test('filters real assignments, not experimental or statically supplied tags', () => {
		const { assignments, model, read } = createModel();
		const empty = read();
		assignments.setAssignment('test.assigned', true);
		assignments.setAssignment('test.modified', true);
		model.updateChildren();
		const assigned = read();
		assignments.setAssignment('test.assigned', false);
		model.updateChildren();

		assert.deepStrictEqual({ empty, assigned, removed: read() }, {
			empty: { count: 0, settings: [] },
			assigned: { count: 2, settings: [{ key: 'test.assigned', assigned: true }, { key: 'test.modified', assigned: true }] },
			removed: { count: 1, settings: [{ key: 'test.modified', assigned: true }] },
		});
	});

	test('composes with modified and settings scope without changing assignment state', () => {
		const { assignments, model, viewState, read } = createModel();
		assignments.setAssignment('test.assigned', true);
		assignments.setAssignment('test.modified', true);
		viewState.tagFilters!.add('modified');
		model.updateChildren();
		const user = read();
		viewState.settingsTarget = ConfigurationTarget.WORKSPACE;
		model.updateChildren();
		const workspace = read();
		viewState.tagFilters!.delete('modified');
		model.updateChildren();

		assert.deepStrictEqual({ user, workspace, assignedInWorkspace: read() }, {
			user: { count: 1, settings: [{ key: 'test.modified', assigned: true }] },
			workspace: { count: 0, settings: [] },
			assignedInWorkspace: { count: 2, settings: [{ key: 'test.assigned', assigned: true }, { key: 'test.modified', assigned: true }] },
		});
	});

	test('resetting a modified setting leaves its assignment intact', async () => {
		const { assignments, model, viewState, configuration, read } = createModel();
		assignments.setAssignment('test.modified', true);
		viewState.tagFilters!.add('modified');
		model.updateChildren();
		const beforeReset = read();
		await configuration.setUserConfiguration('test.modified', undefined);
		model.updateChildren();
		const afterReset = read();
		viewState.tagFilters!.delete('modified');
		model.updateChildren();

		assert.deepStrictEqual({ beforeReset, afterReset, assignmentOnly: read() }, {
			beforeReset: { count: 1, settings: [{ key: 'test.modified', assigned: true }] },
			afterReset: { count: 0, settings: [] },
			assignmentOnly: { count: 1, settings: [{ key: 'test.modified', assigned: true }] },
		});
	});

	test('policy values do not hide an assignment or mark it as user-modified', () => {
		const { assignments, model, configuration } = createModel();
		assignments.setAssignment('test.modified', true);
		configuration.inspect = <T>(key: string) => ({
			value: configuration.getValue<T>(key),
			policyValue: configuration.getValue<T>(key),
		});
		model.updateChildren();
		const element = model.getElementsByName('test.modified')![0];
		assert.deepStrictEqual({
			assigned: element.hasExPAssignment,
			policy: element.hasPolicyValue,
			modified: element.isConfigured,
			matchesAssignment: element.matchesAllTags(new Set([EXP_ASSIGNMENT_SETTING_TAG])),
		}, { assigned: true, policy: true, modified: false, matchesAssignment: true });
	});

	test('parses assignment and modified filters separately from free text', () => {
		assert.deepStrictEqual(parseQuery('@modified @tag:expassigned font'), {
			tags: [EXP_ASSIGNMENT_SETTING_TAG, 'modified'],
			extensionFilters: [],
			featureFilters: [],
			idFilters: [],
			languageFilter: undefined,
			query: 'font',
		});
	});
});

suite('SettingsTree deprecation warnings', () => {
	const store = ensureNoDisposablesAreLeakedInTestSuite();

	for (const search of [false, true]) {
		test(`keeps opted-in warnings visible without exposing unconfigured deprecated settings (search=${search})`, async () => {
			const instantiationService = store.add(new TestInstantiationService());
			const configuration = new class extends TestConfigurationService {
				isSettingAppliedForAllProfiles(): boolean { return false; }
			}({ 'test.configured': true });
			store.add(configuration.onDidChangeConfigurationEmitter);
			instantiationService.stub(IWorkbenchConfigurationService, configuration);
			instantiationService.stub(ILanguageService, { isRegisteredLanguageId: () => true });
			instantiationService.stub(IUserDataProfileService, new TestUserDataProfileService());
			instantiationService.stub(IProductService, TestProductService);
			instantiationService.stub(IWorkbenchEnvironmentService, {});
			instantiationService.stub(IExperimentalSettingsService, store.add(new ExperimentalSettingsService()));
			instantiationService.stub(IManagedSettingsService, new NullManagedSettingsService());
			instantiationService.stub(IManagedSettingsPresentationService, store.add(instantiationService.createInstance(ManagedSettingsPresentationService)));
			const viewState: ISettingsEditorViewState = { settingsTarget: ConfigurationTarget.USER_LOCAL };
			const model = store.add(search
				? instantiationService.createInstance(SearchResultModel, viewState, null, true)
				: instantiationService.createInstance(SettingsTreeModel, viewState, true));
			const settings = ['test.upcoming', 'test.deprecated', 'test.configured', 'test.explicitlyHidden', 'test.normal'].map(key => new class extends mock<ISetting>() {
				override key = key;
				override type = 'boolean';
				override description = [];
				override scope = ConfigurationScope.RESOURCE;
				override deprecationMessage = key === 'test.normal' ? undefined : 'This setting will be deprecated soon.';
				override deprecationMessageShowInSettings = key === 'test.upcoming' ? true : key === 'test.explicitlyHidden' ? false : undefined;
			}());
			const update = () => {
				if (model instanceof SearchResultModel) {
					model.setResult(SearchResultIdx.Local, {
						filterMatches: settings.map(setting => ({ setting, matches: [], matchType: SettingMatchType.None, keyMatchScore: 0, score: 0 })),
						exactMatch: false,
					});
				} else {
					model.update({ id: 'deprecationWarnings', label: '', settings });
				}
			};
			const visible = () => model.root.children
				.filter((child): child is SettingsTreeSettingElement => child instanceof SettingsTreeSettingElement)
				.map(child => ({ key: child.setting.key, warning: child.setting.deprecationMessage }));
			update();
			const initial = visible();
			await configuration.setUserConfiguration('test.configured', undefined);
			update();
			assert.deepStrictEqual({ initial, reset: visible() }, {
				initial: [
					{ key: 'test.upcoming', warning: 'This setting will be deprecated soon.' },
					{ key: 'test.configured', warning: 'This setting will be deprecated soon.' },
					{ key: 'test.normal', warning: undefined },
				],
				reset: [
					{ key: 'test.upcoming', warning: 'This setting will be deprecated soon.' },
					{ key: 'test.normal', warning: undefined },
				],
			});
		});
	}
});

suite('SettingsTree search results', () => {
	const store = ensureNoDisposablesAreLeakedInTestSuite();

	function createModel() {
		const configuration = new class extends TestConfigurationService {
			isSettingAppliedForAllProfiles(): boolean { return false; }
		}();
		store.add(configuration.onDidChangeConfigurationEmitter);
		const instantiationService = store.add(new TestInstantiationService());
		instantiationService.stub(IWorkbenchConfigurationService, configuration);
		instantiationService.stub(ILanguageService, { isRegisteredLanguageId: () => true });
		instantiationService.stub(IUserDataProfileService, new TestUserDataProfileService());
		instantiationService.stub(IProductService, TestProductService);
		instantiationService.stub(IWorkbenchEnvironmentService, {});
		instantiationService.stub(IExperimentalSettingsService, store.add(new ExperimentalSettingsService()));
		instantiationService.stub(IManagedSettingsService, new NullManagedSettingsService());
		instantiationService.stub(IManagedSettingsPresentationService, store.add(instantiationService.createInstance(ManagedSettingsPresentationService)));
		return store.add(instantiationService.createInstance(SearchResultModel,
			{ settingsTarget: ConfigurationTarget.USER_LOCAL, query: 'test' }, null, true));
	}

	function createMatch(key: string) {
		return {
			setting: new class extends mock<ISetting>() {
				override key = key;
				override type = 'boolean';
				override description = [];
				override scope = ConfigurationScope.APPLICATION;
			}(),
			matches: [], matchType: SettingMatchType.RemoteMatch, keyMatchScore: 0, score: 0,
		};
	}

	test('refreshes after local results are cleared', () => {
		const model = createModel();
		model.setResult(SearchResultIdx.Local, { filterMatches: [createMatch('test.local')], exactMatch: true });
		model.setResult(SearchResultIdx.Local, null);
		model.updateChildren();

		assert.deepStrictEqual({
			results: model.getUniqueSearchResults(),
			count: model.getUniqueResultsCount(),
		}, { results: { filterMatches: [], exactMatch: false }, count: 0 });
	});

	test('retains remote results without local results', () => {
		const model = createModel();
		const match = createMatch('test.remote');
		model.setResult(SearchResultIdx.Local, null);
		model.setResult(SearchResultIdx.Remote, { filterMatches: [match], exactMatch: false });
		model.updateChildren();

		assert.deepStrictEqual({
			results: model.getUniqueSearchResults(),
			keys: model.root.children.map(child => child instanceof SettingsTreeSettingElement ? child.setting.key : child.id),
			count: model.getUniqueResultsCount(),
		}, { results: { filterMatches: [match], exactMatch: false }, keys: ['test.remote'], count: 1 });
	});

	test('preserves local exact matches and remote deduplication', () => {
		const model = createModel();
		const localMatch = createMatch('test.local');
		const remoteMatch = createMatch('test.remote');
		model.setResult(SearchResultIdx.Local, { filterMatches: [localMatch], exactMatch: true });
		model.setResult(SearchResultIdx.Remote, { filterMatches: [localMatch, remoteMatch], exactMatch: false });

		assert.deepStrictEqual(model.getUniqueSearchResults(), {
			filterMatches: [localMatch, remoteMatch],
			exactMatch: true,
		});
	});
});

suite('SettingsTree', () => {
	test('settingKeyToDisplayFormat - sandbox outbound connections', () => {
		assert.deepStrictEqual([
			settingKeyToDisplayFormat(AgentSandboxSettingId.AgentSandboxAllowNetwork),
			settingKeyToDisplayFormat(AgentSandboxSettingId.AgentSandboxAllowNetwork, 'chat'),
			settingKeyToDisplayFormat(AgentSandboxSettingId.AgentSandboxAllowNetwork, 'chat.agent.sandbox'),
			settingKeyToDisplayFormat(AgentSandboxSettingId.AgentSandboxAllowNetwork, 'chat.agent.sandbox.network'),
			settingKeyToDisplayFormat('other.allowNetwork'),
		], [
			{ category: 'Chat › Agent › Sandbox › Network', label: 'Allow Outbound Connections' },
			{ category: 'Agent › Sandbox › Network', label: 'Allow Outbound Connections' },
			{ category: 'Network', label: 'Allow Outbound Connections' },
			{ category: '', label: 'Allow Outbound Connections' },
			{ category: 'Other', label: 'Allow Network' },
		]);
	});

	test('settingKeyToDisplayFormat - allowed network domains', () => {
		assert.deepStrictEqual([
			settingKeyToDisplayFormat(AgentNetworkDomainSettingId.AllowedNetworkDomains),
			settingKeyToDisplayFormat(AgentNetworkDomainSettingId.AllowedNetworkDomains, 'chat'),
			settingKeyToDisplayFormat(AgentNetworkDomainSettingId.AllowedNetworkDomains, 'chat.agent.sandbox'),
			settingKeyToDisplayFormat(AgentNetworkDomainSettingId.AllowedNetworkDomains, 'chat.agent.sandbox.network'),
		], [
			{ category: 'Chat › Agent › Sandbox › Network', label: 'Allowed Domains' },
			{ category: 'Agent › Sandbox › Network', label: 'Allowed Domains' },
			{ category: 'Network', label: 'Allowed Domains' },
			{ category: '', label: 'Allowed Domains' },
		]);
	});

	test('settingKeyToDisplayFormat - denied network domains', () => {
		assert.deepStrictEqual([
			settingKeyToDisplayFormat(AgentNetworkDomainSettingId.DeniedNetworkDomains),
			settingKeyToDisplayFormat(AgentNetworkDomainSettingId.DeniedNetworkDomains, 'chat.agent.sandbox'),
			settingKeyToDisplayFormat(AgentNetworkDomainSettingId.DeniedNetworkDomains, 'chat.agent.sandbox.network'),
		], [
			{ category: 'Chat › Agent › Sandbox › Network', label: 'Denied Domains' },
			{ category: 'Network', label: 'Denied Domains' },
			{ category: '', label: 'Denied Domains' },
		]);
	});

	test('settingKeyToDisplayFormat - sandbox bypass', () => {
		assert.deepStrictEqual([
			settingKeyToDisplayFormat(AgentSandboxSettingId.AgentSandboxAllowUnsandboxedCommands),
			settingKeyToDisplayFormat(AgentSandboxSettingId.AgentSandboxAllowUnsandboxedCommands, 'chat'),
			settingKeyToDisplayFormat(AgentSandboxSettingId.AgentSandboxAllowUnsandboxedCommands, 'chat.agent.sandbox'),
			settingKeyToDisplayFormat('other.allowUnsandboxedCommands'),
		], [
			{ category: 'Chat › Agent › Sandbox', label: 'Allow Sandbox Bypass' },
			{ category: 'Agent › Sandbox', label: 'Allow Sandbox Bypass' },
			{ category: '', label: 'Allow Sandbox Bypass' },
			{ category: 'Other', label: 'Allow Unsandboxed Commands' },
		]);
	});

	test('settingKeyToDisplayFormat - sandbox local network', () => {
		assert.deepStrictEqual({
			keys: [AgentSandboxSettingId.AgentSandboxAllowNetwork, AgentSandboxSettingId.AgentSandboxAllowLocalNetwork],
			display: ['', 'chat', 'chat.agent.sandbox', 'chat.agent.sandbox.network'].map(group =>
				settingKeyToDisplayFormat(AgentSandboxSettingId.AgentSandboxAllowLocalNetwork, group)),
		}, {
			keys: ['chat.agent.sandbox.network.allowNetwork', 'chat.agent.sandbox.network.allowLocalNetwork'],
			display: [
				{ category: 'Chat › Agent › Sandbox › Network', label: 'Allow Local Network' },
				{ category: 'Agent › Sandbox › Network', label: 'Allow Local Network' },
				{ category: 'Network', label: 'Allow Local Network' },
				{ category: '', label: 'Allow Local Network' },
			],
		});
	});

	test('settingKeyToDisplayFormat', () => {
		assert.deepStrictEqual(
			settingKeyToDisplayFormat('foo.bar'),
			{
				category: 'Foo',
				label: 'Bar'
			});

		assert.deepStrictEqual(
			settingKeyToDisplayFormat('foo.bar.etc'),
			{
				category: 'Foo › Bar',
				label: 'Etc'
			});

		assert.deepStrictEqual(
			settingKeyToDisplayFormat('fooBar.etcSomething'),
			{
				category: 'Foo Bar',
				label: 'Etc Something'
			});

		assert.deepStrictEqual(
			settingKeyToDisplayFormat('foo'),
			{
				category: '',
				label: 'Foo'
			});

		assert.deepStrictEqual(
			settingKeyToDisplayFormat('foo.1leading.number'),
			{
				category: 'Foo › 1leading',
				label: 'Number'
			});

		assert.deepStrictEqual(
			settingKeyToDisplayFormat('foo.1Leading.number'),
			{
				category: 'Foo › 1 Leading',
				label: 'Number'
			});
	});

	test('settingKeyToDisplayFormat - sandbox placeholder settings', () => {
		assert.deepStrictEqual([
			settingKeyToDisplayFormat(AgentSandboxSettingId.AgentSandboxMcpServers, 'chat.agent.sandbox'),
			settingKeyToDisplayFormat(AgentSandboxSettingId.AgentSandboxLspServers, 'chat.agent.sandbox'),
		], [
			{ category: '', label: 'Sandbox MCP Servers' },
			{ category: '', label: 'Sandbox LSP Servers' },
		]);
	});

	test('settingKeyToDisplayFormat - sandbox developer tool file system access', () => {
		assert.deepStrictEqual({
			key: AgentSandboxSettingId.AgentSandboxAllowDevToolAccess,
			display: ['', 'chat', 'chat.agent.sandbox', 'chat.agent.sandbox.fileSystem'].map(group =>
				settingKeyToDisplayFormat(AgentSandboxSettingId.AgentSandboxAllowDevToolAccess, group)),
		}, {
			key: 'chat.agent.sandbox.fileSystem.allowDevToolAccess',
			display: [
				{ category: 'Chat › Agent › Sandbox › File System', label: 'Allow Dev Tool Access' },
				{ category: 'Agent › Sandbox › File System', label: 'Allow Dev Tool Access' },
				{ category: 'File System', label: 'Allow Dev Tool Access' },
				{ category: '', label: 'Allow Dev Tool Access' },
			],
		});
	});

	test('settingKeyToDisplayFormat - sandbox credential authentication', () => {
		for (const [key, label] of [
			[AgentSandboxSettingId.AgentSandboxAuthenticateGit, 'Authenticate git'],
			[AgentSandboxSettingId.AgentSandboxAuthenticateGh, 'Authenticate gh'],
		] as const) {
			assert.deepStrictEqual(
				['', 'chat.agent.sandbox', 'chat.agent.sandbox.credentials'].map(group => settingKeyToDisplayFormat(key, group)),
				[
					{ category: 'Chat › Agent › Sandbox › Credentials', label },
					{ category: 'Credentials', label },
					{ category: '', label },
				],
			);
		}
	});

	test('settingKeyToDisplayFormat - sandbox user-configured paths', () => {
		assert.deepStrictEqual(
			['', 'chat.agent.sandbox', 'chat.agent.sandbox.fileSystem'].map(group =>
				settingKeyToDisplayFormat(AgentSandboxSettingId.AgentSandboxUserConfiguredPaths, group)),
			[
				{ category: 'Chat › Agent › Sandbox › File System', label: 'User-Configured Paths' },
				{ category: 'File System', label: 'User-Configured Paths' },
				{ category: '', label: 'User-Configured Paths' },
			],
		);
	});

	test('settingKeyToDisplayFormat - with category', () => {
		assert.deepStrictEqual(
			settingKeyToDisplayFormat('foo.bar', 'foo'),
			{
				category: '',
				label: 'Bar'
			});

		assert.deepStrictEqual(
			settingKeyToDisplayFormat('disableligatures.ligatures', 'disableligatures'),
			{
				category: '',
				label: 'Ligatures'
			});

		assert.deepStrictEqual(
			settingKeyToDisplayFormat('foo.bar.etc', 'foo'),
			{
				category: 'Bar',
				label: 'Etc'
			});

		assert.deepStrictEqual(
			settingKeyToDisplayFormat('fooBar.etcSomething', 'foo'),
			{
				category: 'Foo Bar',
				label: 'Etc Something'
			});

		assert.deepStrictEqual(
			settingKeyToDisplayFormat('foo.bar.etc', 'foo/bar'),
			{
				category: '',
				label: 'Etc'
			});

		assert.deepStrictEqual(
			settingKeyToDisplayFormat('foo.bar.etc', 'something/foo'),
			{
				category: 'Bar',
				label: 'Etc'
			});

		assert.deepStrictEqual(
			settingKeyToDisplayFormat('bar.etc', 'something.bar'),
			{
				category: '',
				label: 'Etc'
			});

		assert.deepStrictEqual(
			settingKeyToDisplayFormat('fooBar.etc', 'fooBar'),
			{
				category: '',
				label: 'Etc'
			});


		assert.deepStrictEqual(
			settingKeyToDisplayFormat('fooBar.somethingElse.etc', 'fooBar'),
			{
				category: 'Something Else',
				label: 'Etc'
			});
	});

	test('settingKeyToDisplayFormat - known acronym/term', () => {
		assert.deepStrictEqual(
			settingKeyToDisplayFormat('css.someCssSetting'),
			{
				category: 'CSS',
				label: 'Some CSS Setting'
			});

		assert.deepStrictEqual(
			settingKeyToDisplayFormat('powershell.somePowerShellSetting'),
			{
				category: 'PowerShell',
				label: 'Some PowerShell Setting'
			});

		assert.deepStrictEqual(
			settingKeyToDisplayFormat('ocaml.server.extendedHover'),
			{
				category: 'OCaml › Server',
				label: 'Extended Hover'
			});
	});

	test('parseQuery', () => {
		function testParseQuery(input: string, expected: IParsedQuery) {
			assert.deepStrictEqual(
				parseQuery(input),
				expected,
				input
			);
		}

		testParseQuery(
			'',
			<IParsedQuery>{
				tags: [],
				extensionFilters: [],
				query: '',
				featureFilters: [],
				idFilters: [],
				languageFilter: undefined
			});

		testParseQuery(
			'@modified',
			<IParsedQuery>{
				tags: ['modified'],
				extensionFilters: [],
				query: '',
				featureFilters: [],
				idFilters: [],
				languageFilter: undefined
			});

		testParseQuery(
			'@tag:foo',
			<IParsedQuery>{
				tags: ['foo'],
				extensionFilters: [],
				query: '',
				featureFilters: [],
				idFilters: [],
				languageFilter: undefined
			});

		testParseQuery(
			'@modified foo',
			<IParsedQuery>{
				tags: ['modified'],
				extensionFilters: [],
				query: 'foo',
				featureFilters: [],
				idFilters: [],
				languageFilter: undefined
			});

		testParseQuery(
			'@tag:foo @modified',
			<IParsedQuery>{
				tags: ['foo', 'modified'],
				extensionFilters: [],
				query: '',
				featureFilters: [],
				idFilters: [],
				languageFilter: undefined
			});

		testParseQuery(
			'@tag:foo @modified my query',
			<IParsedQuery>{
				tags: ['foo', 'modified'],
				extensionFilters: [],
				query: 'my query',
				featureFilters: [],
				idFilters: [],
				languageFilter: undefined
			});

		testParseQuery(
			'test @modified query',
			<IParsedQuery>{
				tags: ['modified'],
				extensionFilters: [],
				query: 'test  query',
				featureFilters: [],
				idFilters: [],
				languageFilter: undefined
			});

		testParseQuery(
			'test @modified',
			<IParsedQuery>{
				tags: ['modified'],
				extensionFilters: [],
				query: 'test',
				featureFilters: [],
				idFilters: [],
				languageFilter: undefined
			});

		testParseQuery(
			'query has @ for some reason',
			<IParsedQuery>{
				tags: [],
				extensionFilters: [],
				query: 'query has @ for some reason',
				featureFilters: [],
				idFilters: [],
				languageFilter: undefined
			});

		testParseQuery(
			'@ext:github.vscode-pull-request-github',
			<IParsedQuery>{
				tags: [],
				extensionFilters: ['github.vscode-pull-request-github'],
				query: '',
				featureFilters: [],
				idFilters: [],
				languageFilter: undefined
			});

		testParseQuery(
			'@ext:github.vscode-pull-request-github,vscode.git',
			<IParsedQuery>{
				tags: [],
				extensionFilters: ['github.vscode-pull-request-github', 'vscode.git'],
				query: '',
				featureFilters: [],
				idFilters: [],
				languageFilter: undefined
			});
		testParseQuery(
			'@feature:scm',
			<IParsedQuery>{
				tags: [],
				extensionFilters: [],
				featureFilters: ['scm'],
				query: '',
				idFilters: [],
				languageFilter: undefined
			});

		testParseQuery(
			'@feature:scm,terminal',
			<IParsedQuery>{
				tags: [],
				extensionFilters: [],
				featureFilters: ['scm', 'terminal'],
				query: '',
				idFilters: [],
				languageFilter: undefined
			});
		testParseQuery(
			'@id:files.autoSave',
			<IParsedQuery>{
				tags: [],
				extensionFilters: [],
				featureFilters: [],
				query: '',
				idFilters: ['files.autoSave'],
				languageFilter: undefined
			});

		testParseQuery(
			'@id:files.autoSave,terminal.integrated.commandsToSkipShell',
			<IParsedQuery>{
				tags: [],
				extensionFilters: [],
				featureFilters: [],
				query: '',
				idFilters: ['files.autoSave', 'terminal.integrated.commandsToSkipShell'],
				languageFilter: undefined
			});

		testParseQuery(
			'@lang:cpp',
			<IParsedQuery>{
				tags: [],
				extensionFilters: [],
				featureFilters: [],
				query: '',
				idFilters: [],
				languageFilter: 'cpp'
			});

		testParseQuery(
			'@lang:cpp,python',
			<IParsedQuery>{
				tags: [],
				extensionFilters: [],
				featureFilters: [],
				query: '',
				idFilters: [],
				languageFilter: 'cpp'
			});
	});

	test('sanitizeId replaces all dots and slashes', () => {
		assert.deepStrictEqual(
			[
				sanitizeId('root.editor.font.size'),
				sanitizeId('group/subgroup/setting.key'),
				sanitizeId('no-special-chars'),
				sanitizeId('single.dot'),
			],
			[
				'root_editor_font_size',
				'group_subgroup_setting_key',
				'no-special-chars',
				'single_dot',
			]
		);
	});

	ensureNoDisposablesAreLeakedInTestSuite();
});
