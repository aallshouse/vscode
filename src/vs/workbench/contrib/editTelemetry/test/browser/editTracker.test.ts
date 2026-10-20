/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { IObservableWithChange, ISettableObservable, observableValue } from '../../../../../base/common/observable.js';
import { Disposable } from '../../../../../base/common/lifecycle.js';
import { OffsetRange } from '../../../../../editor/common/core/ranges/offsetRange.js';
import { AnnotatedStringEdit, StringEdit } from '../../../../../editor/common/core/edits/stringEdit.js';
import { StringText } from '../../../../../editor/common/core/text/abstractText.js';
import { EditSources, TextModelEditSource } from '../../../../../editor/common/textModelEditSource.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { EditKeySourceData, EditSourceData, IDocumentWithAnnotatedEdits } from '../../browser/helpers/documentWithAnnotatedEdits.js';
import { DocumentEditSourceTracker } from '../../browser/telemetry/editTracker.js';

suite('DocumentEditSourceTracker', () => {
	const disposables = ensureNoDisposablesAreLeakedInTestSuite();

	test('ignores an initial external edit', () => {
		const document = disposables.add(new TestAnnotatedDocument('initial'));
		const tracker = disposables.add(new DocumentEditSourceTracker(document, undefined));

		document.apply(StringEdit.replace(OffsetRange.ofLength(7), 'external'), EditSources.reloadFromDisk());

		assert.deepStrictEqual(snapshot(tracker), []);
	});

	test('applies queued external edits before the next attributed edit', () => {
		const document = disposables.add(new TestAnnotatedDocument(''));
		const tracker = disposables.add(new DocumentEditSourceTracker(document, undefined));
		const paste = EditSources.cursor({ kind: 'paste' });
		const type = EditSources.cursor({ kind: 'type' });

		document.apply(StringEdit.insert(0, 'abcdef'), paste);
		document.apply(StringEdit.delete(new OffsetRange(2, 4)), EditSources.reloadFromDisk());

		assert.deepStrictEqual(snapshot(tracker), [{
			key: 'source:cursor-kind:paste',
			delta: 6,
			retained: 6,
		}]);

		document.apply(StringEdit.insert(4, 'X'), type);

		assert.deepStrictEqual(snapshot(tracker), [
			{
				key: 'source:cursor-kind:paste',
				delta: 6,
				retained: 4,
			},
			{
				key: 'source:cursor-kind:type',
				delta: 1,
				retained: 1,
			},
			{
				key: 'source:reloadFromDisk',
				delta: 0,
				retained: 0,
			},
		]);
	});
});

class TestAnnotatedDocument extends Disposable implements IDocumentWithAnnotatedEdits<EditKeySourceData> {
	private readonly _value: ISettableObservable<StringText, { edit: AnnotatedStringEdit<EditKeySourceData> }>;
	readonly value: IObservableWithChange<StringText, { edit: AnnotatedStringEdit<EditKeySourceData> }>;

	constructor(initialValue: string) {
		super();
		this.value = this._value = observableValue(this, new StringText(initialValue));
	}

	apply(edit: StringEdit, source: TextModelEditSource): void {
		const data = new EditSourceData(source).toEditSourceData();
		this._value.set(edit.applyOnText(this._value.get()), undefined, { edit: edit.mapData(() => data) });
	}

	waitForQueue(): Promise<void> {
		return Promise.resolve();
	}
}

function snapshot(tracker: DocumentEditSourceTracker): Array<{ key: string; delta: number; retained: number }> {
	const retained = new Map<string, number>();
	for (const range of tracker.getTrackedRanges()) {
		retained.set(range.sourceKey, (retained.get(range.sourceKey) ?? 0) + range.range.length);
	}
	return tracker.getAllKeys().map(key => ({
		key,
		delta: tracker.getTotalInsertedCharactersCount(key),
		retained: retained.get(key) ?? 0,
	})).sort((a, b) => a.key.localeCompare(b.key));
}
