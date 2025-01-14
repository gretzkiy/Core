/*!
 * V4Fire Core
 * https://github.com/V4Fire/Core
 *
 * Released under the MIT license
 * https://github.com/V4Fire/Core/blob/master/LICENSE
 */

import $C = require('collection.js');
import toSource = require('tosource');
import { convertIfDate } from 'core/json';

/** @see {$C.extend} */
Object.mixin = $C.extend;

/**
 * Object.toSource implementation
 */
Object.defineProperty(Object.prototype, 'toSource', {
	enumerable: false,
	value(): string {
		return toSource(this);
	}
});

/**
 * Creates a hash table without prototype
 * @param fields
 */
// tslint:disable-next-line:only-arrow-functions
Object.createDict = function (...fields: unknown[]): Dictionary {
	if (fields.length) {
		return Object.assign(Object.create(null), ...fields);
	}

	return Object.create(null);
};

/**
 * Parses the specified value as a JSON / JS object and returns the result
 * @param value
 */
Object.parse = function parse<V = unknown, R = unknown>(value: V): CanUndef<R> {
	try {
		return new Function(`return ${value}`)();
	} catch {}

	return undefined;
};

/**
 * Clones the specified object using JSON.parse -> JSON.stringify
 *
 * @param obj
 * @param [params] - additional parameters:
 *   *) [replacer] - JSON.stringify replacer
 *   *) [reviver] - JSON.parse reviver (false for disable defaults)
 *   *) [freezable] - if false the object freeze state wont be copy
 */
Object.fastClone = function fastClone<T = unknown>(obj: T, params?: FastCloneParams): T {
	const
		p = params || {};

	if (Object.isFunction(obj)) {
		return obj;
	}

	if (obj) {
		const
			noJSON = !Object.isFunction((<any>obj).toJSON);

		if (noJSON && obj instanceof Map) {
			const
				map = new Map();

			for (let o = obj.entries(), el = o.next(); !el.done; el = o.next()) {
				const val = el.value;
				map.set(val[0], Object.fastClone(val[1]));
			}

			return <any>map;
		}

		if (noJSON && obj instanceof Set) {
			const
				set = new Set();

			for (let o = obj.values(), el = o.next(); !el.done; el = o.next()) {
				set.add(el.value);
			}

			return <any>set;
		}

		if (typeof obj === 'object') {
			const clone = JSON.parse(
				JSON.stringify(obj, p.replacer), p.reviver !== false ? p.reviver || convertIfDate : undefined
			);

			if (p.freezable !== false) {
				if (!Object.isExtensible(obj)) {
					Object.preventExtensions(clone);
				}

				if (Object.isSealed(obj)) {
					Object.seal(clone);
				}

				if (Object.isFrozen(obj)) {
					Object.freeze(clone);
				}
			}

			return clone;
		}
	}

	return obj;
};

Object.fastCompare = fastCompare;

/**
 * Compares two specified objects and returns the result
 *
 * @param a
 * @param b
 */
function fastCompare<T>(a: any, b: T): a is T;
function fastCompare<T>(a: any, b: any): boolean {
	if (a === b) {
		return true;
	}

	if (!a || typeof a !== 'object' || !b || typeof b !== 'object') {
		return a === b;
	}

	const
		aIsArr = Object.isArray(a),
		aIsMap = !aIsArr && Object.isMap(a),
		aIsSet = !aIsMap && Object.isSet(a),
		bIsArr = Object.isArray(b),
		bIsMap = !bIsArr && Object.isMap(b),
		bIsSet = !bIsMap && Object.isSet(b);

	if (
		!aIsArr && !Object.isObject(a) && !Object.isDate(a) && !Object.isRegExp(a) && !Object.isFunction(a.toJSON) ||
		!bIsArr && !Object.isObject(b) && !Object.isDate(b) && !Object.isRegExp(b) && !Object.isFunction(b.toJSON)
	) {
		if ((aIsMap && bIsMap || aIsSet && bIsSet) && a.size === 0 && b.size === 0) {
			return true;
		}

		return a === b;
	}

	let
		length1,
		length2;

	if (aIsArr) {
		length1 = a.length;

	} else if (aIsMap || aIsSet) {
		length1 = a.size;

	} else {
		length1 = typeof a.length === 'number' ? a.length : Object.keys(a).length;
	}

	if (bIsArr) {
		length2 = b.length;

	} else if (bIsMap || bIsSet) {
		length2 = b.size;

	} else {
		length2 = typeof b.length === 'number' ? b.length : Object.keys(b).length;
	}

	if (length1 !== length2) {
		return false;
	}

	if ((aIsArr && bIsArr || aIsMap && bIsMap || aIsSet && bIsSet) && length1 === 0) {
		return true;
	}

	return JSON.stringify(a) === JSON.stringify(b);
}

/**
 * Creates an object {key: value, value: key} from the specified
 * @param obj
 */
Object.createMap = function createMap<T extends object>(obj: T): T & Dictionary {
	const
		map = {};

	if (Object.isArray(obj)) {
		for (let i = 0; i < obj.length; i++) {
			const el = obj[i];
			map[i] = el;
			map[<string>el] = i;
		}

	} else {
		const
			keys = Object.keys(obj);

		for (let i = 0; i < keys.length; i++) {
			const
				key = keys[i],
				el = obj[key];

			map[key] = el;
			map[el] = key;
		}
	}

	return <T & Dictionary>map;
};

/**
 * Creates an object from the specified array
 * @param arr
 */
Object.fromArray = function fromArray(arr: unknown[]): Dictionary<boolean> {
	const
		map = {};

	for (let i = 0; i < arr.length; i++) {
		map[String(arr[i])] = true;
	}

	return map;
};

const
	protoChains = new WeakMap<Function, object[]>();

/**
 * Returns a prototype chain from the specified constructor
 * @param constructor
 */
Object.getPrototypeChain = function getPrototypeChain(constructor: Function): object[] {
	if (protoChains.has(constructor)) {
		return (<object[]>protoChains.get(constructor)).slice();
	}

	const
		chain: object[] = [];

	let
		proto = constructor.prototype;

	while (proto && proto.constructor !== Object) {
		chain.push(proto);
		proto = Object.getPrototypeOf(proto);
	}

	protoChains.set(constructor, chain.reverse());
	return chain.slice();
};

/** @override */
Object.isArray = Array.isArray;

/** @override */
Object.isFunction = function isFunction(obj: unknown): obj is Function {
	return typeof obj === 'function';
};

/** @override */
Object.isString = function isString(obj: unknown): obj is string {
	return typeof obj === 'string';
};

/** @override */
Object.isNumber = function isNumber(obj: unknown): obj is number {
	return typeof obj === 'number';
};

/** @override */
Object.isBoolean = function isBoolean(obj: unknown): obj is boolean {
	return typeof obj === 'boolean';
};

/** @override */
Object.isRegExp = function isRegExp(obj: unknown): obj is RegExp {
	return obj instanceof RegExp;
};

/** @override */
Object.isDate = function isDate(obj: unknown): obj is Date {
	return obj instanceof Date;
};

/** @override */
Object.isMap = function isMap(obj: unknown): obj is Map<unknown, unknown> {
	return obj instanceof Map;
};

/**
 * Returns true if the specified object is WeakMap
 * @param obj
 */
Object.isWeakMap = function isWeakMap(obj: unknown): obj is WeakMap<object, unknown> {
	return obj instanceof WeakMap;
};

/** @override */
Object.isSet = function isSet(obj: unknown): obj is Set<unknown> {
	return obj instanceof Set;
};

/**
 * Returns true if the specified object is WeakSet
 * @param obj
 */
Object.isWeakSet = function isWeakSet(obj: unknown): obj is WeakSet<object> {
	return obj instanceof WeakSet;
};

const
	toString = Object.prototype.toString;

/**
 * Returns true if the specified object is Promise
 * @param obj
 */
Object.isPromise = function isPromise(obj: unknown): obj is Promise<unknown> {
	if (toString.call(obj) === '[object Promise]') {
		return true;
	}

	if (obj instanceof Object) {
		const v = <Dictionary>obj;
		return Object.isFunction(v.then) && Object.isFunction(v.catch);
	}

	return false;
};

/**
 * Returns true if the specified object is a hash table
 * @param obj
 */
Object.isTable = function isTable(obj: unknown): obj is Dictionary {
	return toString.call(obj) === '[object Object]';
};
