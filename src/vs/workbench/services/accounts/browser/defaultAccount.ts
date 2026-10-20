/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IDefaultAccount, IDefaultAccountAuthenticationProvider } from '../../../../base/common/defaultAccount.js';
import { Event } from '../../../../base/common/event.js';
import { IDefaultAccountService } from '../../../../platform/defaultAccount/common/defaultAccount.js';

/**
 * AI removed: the default account was the GitHub account used for Copilot
 * entitlements and Copilot-managed policies. This build never resolves one.
 */
export class DefaultAccountService implements IDefaultAccountService {
	declare _serviceBrand: undefined;

	readonly onDidChangeDefaultAccount: Event<IDefaultAccount | null> = Event.None;
	readonly currentDefaultAccount: IDefaultAccount | null = null;

	async getDefaultAccount(): Promise<IDefaultAccount | null> {
		return null;
	}

	getDefaultAccountAuthenticationProvider(): IDefaultAccountAuthenticationProvider {
		return { id: 'github', name: 'GitHub', enterprise: false };
	}

	async signIn(): Promise<IDefaultAccount | null> {
		return null;
	}

	resolveGitHubUrl(path: string): string {
		return `https://github.com/${path}`;
	}
}
