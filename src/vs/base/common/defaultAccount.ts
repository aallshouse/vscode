/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

export interface IDefaultAccountAuthenticationProvider {
	readonly id: string;
	readonly name: string;
	readonly enterprise: boolean;
}

export interface IDefaultAccount {
	readonly authenticationProvider: IDefaultAccountAuthenticationProvider;
	readonly accountName: string;
	readonly sessionId: string;
	readonly enterprise: boolean;
}
