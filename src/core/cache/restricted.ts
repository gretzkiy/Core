/*!
 * V4Fire Core
 * https://github.com/V4Fire/Core
 *
 * Released under the MIT license
 * https://github.com/V4Fire/Core/blob/master/LICENSE
 */

import $C = require('collection.js');
import Cache, { ClearFilter } from 'core/cache/cache';

export default class RestrictedCache<V = unknown, K = string> extends Cache<V, K> {
	/**
	 * Queue object
	 */
	protected readonly queue: Set<K> = new Set();

	/**
	 * Number of maximum records in a cache
	 */
	protected max: number = 20;

	/**
	 * @override
	 * @param [max] - number of maximum records in a cache
	 */
	constructor(max?: number) {
		super();

		if (max) {
			this.max = max;
		}
	}

	/** @override */
	get(key: K): CanUndef<V> {
		if (this.has(key)) {
			this.queue.delete(key);
			this.queue.add(key);
		}

		return super.get(key);
	}

	/** @override */
	set(key: K, value: V): V {
		this.remove(key);

		if (this.queue.size === this.max) {
			const
				key = $C(this.queue).one.get();

			if (key !== undefined) {
				this.remove(key);
			}
		}

		this.queue.add(key);
		return super.set(key, value);
	}

	/** @override */
	remove(key: K): CanUndef<V> {
		if (this.has(key)) {
			this.queue.delete(key);
			return super.remove(key);
		}
	}

	/** @override */
	clear(filter?: ClearFilter<V, K>): Set<K> {
		const removed = super.clear();
		$C(this.queue).remove((el) => removed.has(el));
		return removed;
	}
}
