/*!
 * V4Fire Core
 * https://github.com/V4Fire/Core
 *
 * Released under the MIT license
 * https://github.com/V4Fire/Core/blob/master/LICENSE
 */

import { GLOBAL } from 'core/const/links';
import log from 'core/log';

/**
 * Converts the specified unknown value to any
 * @param obj
 */
GLOBAL.Any = function Any(obj: unknown): any {
	return obj;
};

/**
 * STDERR wrapper
 * @param err
 */
GLOBAL.stderr = function stderr(err: unknown): void {
	if (err instanceof Object) {
		if ({clearAsync: true, abort: true}[String((<Dictionary>err).type)]) {
			return;
		}

		log.error('stderr', err);
	}
};

/**
 * dev/null wrapper
 * @param obj
 */
GLOBAL.devNull = function stderr(obj: unknown): void {
	return undefined;
};
