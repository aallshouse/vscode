/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IDefaultAccount, IDefaultAccountAuthenticationProvider } from '../../../base/common/defaultAccount.js';
import { Event } from '../../../base/common/event.js';
import { createDecorator } from '../../instantiation/common/instantiation.js';

export const IDefaultAccountService = createDecorator<IDefaultAccountService>('defaultAccountService');

export interface IDefaultAccountService {
	readonly _serviceBrand: undefined;
	readonly onDidChangeDefaultAccount: Event<IDefaultAccount | null>;
	readonly currentDefaultAccount: IDefaultAccount | null;
	getDefaultAccount(): Promise<IDefaultAccount | null>;
	getDefaultAccountAuthenticationProvider(): IDefaultAccountAuthenticationProvider;
	signIn(options?: { additionalScopes?: readonly string[];[key: string]: unknown }): Promise<IDefaultAccount | null>;

	/**
	 * Resolves a GitHub path against the selected session's enterprise server, or `https://github.com` for a non-enterprise provider.
	 * Returns `undefined` when enterprise authentication is selected but the session's server is unavailable.
	 */
	resolveGitHubUrl(path: string): string | undefined;
}
