/*!
 * V4Fire Core
 * https://github.com/V4Fire/Core
 *
 * Released under the MIT license
 * https://github.com/V4Fire/Core/blob/master/LICENSE
 */

import $C = require('collection.js');

export const enum State {
	pending,
	fulfilled,
	rejected
}

export type Value<T = unknown> = PromiseLike<T> | T;
export type ExecValue<T = unknown> = (() => T) | Value<T>;

export interface OnError {
	(reason?: unknown): void;
}

export interface Executor<T = unknown> {
	(
		resolve: (value?: Value<T>) => void,
		reject: (reason?: unknown) => void,
		onAbort: (cb: OnError) => void
	): void;
}

export default class Then<T = unknown> implements PromiseLike<T> {
	/**
	 * Promise that never will be resolved
	 */
	static readonly never: Promise<never> = new Promise(() => undefined);

	/**
	 * Returns true if the specified value is PromiseLike
	 * @param obj
	 */
	static isThenable(obj: unknown): obj is PromiseLike<unknown> {
		if (obj instanceof Object) {
			return Object.isFunction((<Dictionary>obj).then);
		}

		return false;
	}

	/**
	 * Wraps the specified value with Then, that will be resolved after setImmediate
	 *
	 * @param [value] - if function, it will be executed
	 * @param [parent] - parent promise
	 */
	static immediate<T = unknown>(value?: ExecValue<T>, parent?: Then): Then<T> {
		return new Then((res, rej, onAbort) => {
			const id = setImmediate(() => {
				res(value && Object.isFunction(value) ? (<Function>value)() : value);
			});

			onAbort((err) => {
				clearImmediate(id);
				if (value instanceof Then) {
					value.abort(err);
				}
			});

		}, parent);
	}

	/**
	 * @see {Promise.resolve}
	 * @param value
	 * @param [parent] - parent promise
	 */
	static resolve<T = unknown>(value?: Value<T>, parent?: Then): Then<T> {
		if (value instanceof Then) {
			if (parent) {
				parent.catch((err) => value.abort(err));
			}

			return value;
		}

		return new Then((res, rej) => {
			if (Then.isThenable(value)) {
				value.then(res, rej);

			} else {
				res(value);
			}

		}, parent);
	}

	/**
	 * @see {Promise.reject}
	 * @param reason
	 * @param [parent] - parent promise
	 */
	static reject<T = unknown>(reason?: Value<T>, parent?: Then): Then<never> {
		return new Then((res, rej) => rej(reason), parent);
	}

	/**
	 * @see {Promise.all}
	 * @param values
	 * @param [parent] - parent promise
	 */
	// @ts-ignore
	static all<T extends Iterable<Value>>(
		values: T,
		parent?: Then
	): Then<(T extends Iterable<Value<infer V>> ? V : unknown)[]> {
		return new Then((res, rej, onAbort) => {
			const
				promises = $C(values).map((el) => Then.resolve(el)),
				resolved = <any[]>[];

			if (!$C(promises).length()) {
				res(resolved);
				return;
			}

			onAbort((reason) => {
				$C(promises).forEach((el) => {
					el.abort(reason);
				});
			});

			let
				counter = 0;

			$C(promises).forEach((promise, i) => {
				promise.then(
					(val) => {
						resolved[i] = val;

						if (++counter === promises.length) {
							res(resolved);
						}
					},

					rej
				);
			});

		}, parent);
	}

	/**
	 * @see {Promise.race}
	 * @param values
	 * @param [parent] - parent promise
	 */
	static race<T extends Iterable<Value>>(
		values: T,
		parent?: Then
	): Then<T extends Iterable<Value<infer V>> ? V : unknown> {
		return new Then<any>((res, rej, onAbort) => {
			const
				promises = $C(values).map((el) => Then.resolve(el));

			if (!$C(promises).length()) {
				res();
				return;
			}

			onAbort((reason) => {
				$C(promises).forEach((el) => {
					el.abort(reason);
				});
			});

			$C(promises).forEach((promise) => {
				promise.then(res, rej);
			});

		}, parent);
	}

	/**
	 * Returns true if current promise is pending
	 */
	get isPending(): boolean {
		return this.state === State.pending;
	}

	/**
	 * Number of child promises
	 */
	protected pendingChildren: number = 0;

	/**
	 * Promise state
	 */
	protected state: State = State.pending;

	/**
	 * If true, then the promise was be aborted
	 */
	protected aborted: boolean = false;

	/**
	 * Internal promise
	 */
	protected promise: Promise<T>;

	/**
	 * Resolve function
	 */
	protected resolve!: (value?: Value<T>) => void;

	/**
	 * Reject function
	 */
	protected reject!: OnError;

	/**
	 * Abort handler
	 */
	protected onAbort!: OnError;

	/**
	 * @param executor - executor function
	 * @param [parent] - parent promise
	 */
	constructor(executor: Executor<T>, parent?: Then) {
		this.promise = new Promise((res, rej) => {
			const resolve = this.resolve = (val) => {
				if (!this.isPending) {
					return;
				}

				this.state = State.fulfilled;
				res(val);
			};

			const reject = this.reject = (err) => {
				if (!this.isPending) {
					return;
				}

				this.state = State.rejected;
				rej(err);
			};

			let
				setOnAbort;

			if (parent) {
				const abortParent = this.onAbort = (reason) => {
					parent.abort(reason);
				};

				parent.catch((err) => {
					this.abort(err);
				});

				setOnAbort = (cb) => {
					this.onAbort = (r) => {
						abortParent(r);
						cb.call(this, r);
					};
				};

			} else {
				setOnAbort = (cb) => {
					this.onAbort = Object.assign(cb.bind(this), {cb});
				};
			}

			if (this.isPending && (!parent || parent.state !== State.rejected)) {
				this.evaluate(executor, [resolve, reject, setOnAbort], reject);
			}
		});
	}

	/** @see {Promise.prototype.then} */
	// @ts-ignore
	then(
		onFulfilled?: Nullable<(value: T) => Value<T>>,
		onRejected?: Nullable<(reason: unknown) => Value<T>>,
		abortCb?: Nullable<OnError>
	): Then<T>;

	then<R>(
		onFulfilled: Nullable<(value: T) => Value<T>>,
		onRejected: (reason: unknown) => Value<R>,
		abortCb?: Nullable<OnError>
	): Then<T | R>;

	then<V>(
		onFulfilled: (value: T) => Value<V>,
		onRejected?: Nullable<(reason: unknown) => Value<V>>,
		abortCb?: Nullable<OnError>
	): Then<V>;

	then<V, R>(
		onFulfilled: (value: T) => Value<V>,
		onRejected: (reason: unknown) => Value<R>,
		abortCb?: Nullable<OnError>
	): Then<V | R>;

	then(onFulfilled: any, onRejected: any, abortCb: any): any {
		this.pendingChildren++;
		return new Then((res, rej, onAbort) => {
			let
				resolve,
				reject;

			if (Object.isFunction(onFulfilled)) {
				resolve = (val) => {
					this.evaluate(onFulfilled, [val], rej, res);
				};

			} else {
				resolve = res;
			}

			if (Object.isFunction(onRejected)) {
				reject = (err) => {
					this.evaluate(onRejected, [err], rej, res);
				};

			} else {
				reject = rej;
			}

			const
				that = this;

			onAbort(function (this: Then, reason: unknown): void {
				if (Object.isFunction(abortCb)) {
					try {
						abortCb(reason);

					} catch {}
				}

				this.aborted = true;

				if (!that.abort(reason)) {
					reject(reason);
				}
			});

			this.promise.then(resolve, reject);
		});
	}

	/** @see {Promise.prototype.catch} */
	catch(onRejected?: Nullable<(reason: unknown) => Value<T>>): Then<T>;
	catch<R>(onRejected: (reason: unknown) => Value<R>): Then<R>;
	catch(onRejected?: any): Then<any> {
		return new Then((res, rej, onAbort) => {
			let
				reject;

			if (Object.isFunction(onRejected)) {
				reject = (err) => {
					this.evaluate(onRejected, [err], rej, res);
				};

			} else {
				reject = rej;
			}

			const
				that = this;

			onAbort(function (this: Then, reason: unknown): void {
				this.aborted = true;

				if (!that.abort(reason)) {
					reject(reason);
				}
			});

			this.promise.then(res, reject);
		});
	}

	/**
	 * Aborts current promise
	 * @param [reason] - abort reason
	 */
	abort(reason?: unknown): boolean {
		if (!this.isPending || this.aborted) {
			return false;
		}

		if (this.pendingChildren) {
			this.pendingChildren--;
		}

		if (!this.pendingChildren) {
			this.evaluate(this.onAbort, [reason]);

			if (!this.aborted) {
				this.reject(reason);
				this.aborted = true;
			}

			return true;
		}

		return false;
	}

	/**
	 * Executes a function with the specified parameters
	 *
	 * @param fn
	 * @param args - arguments
	 * @param [onError] - error handler
	 * @param [onValue] - success handler
	 */
	protected evaluate<A = unknown, V = unknown>(
		fn: (...args: A[]) => V,
		args: A[] = [],
		onError?: OnError,
		onValue?: (value: V) => void
	): void {
		const
			loopback = () => undefined,
			reject = onError || loopback,
			resolve = onValue || loopback;

		try {
			const
				v = fn(...args);

			if (Object.isPromise(v)) {
				v.then(<any>resolve, reject);

			} else {
				resolve(v);
			}

		} catch (err) {
			reject(err);
		}
	}
}

Then.prototype = Object.mixin({withAccessors: true}, Object.create(Promise.prototype), Then.prototype);
