/*!
 * V4Fire Core
 * https://github.com/V4Fire/Core
 *
 * Released under the MIT license
 * https://github.com/V4Fire/Core/blob/master/LICENSE
 */

import config from 'config';
import { EventEmitter2 as EventEmitter } from 'eventemitter2';
import { asyncLocal } from 'core/kv-storage';

export const
	event = new EventEmitter();

const
	storage = asyncLocal.namespace('[[NET]]');

let
	status,
	lastOnline,
	cache,
	syncTimer;

/**
 * If online returns true
 *
 * @emits online()
 * @emits offline(lastOnline: Date)
 * @emits status({status: boolean, lastOnline?: Date})
 */
export function isOnline(): Promise<{status: boolean; lastOnline?: Date}> {
	if (cache) {
		return cache;
	}

	cache = (async () => {
		const
			url = config.onlineCheckURL,
			prevStatus = status;

		let
			loadFromStorage;

		if (!lastOnline && url) {
			loadFromStorage = storage.get('lastOnline').then((v) => {
				if (v) {
					lastOnline = v;
				}
			});
		}

		status = await new Promise<boolean>((resolve) => {
			if (!url) {
				resolve(true);
				return;
			}

			const
				img = new Image(),
				timer = setTimeout(() => resolve(false), config.onlineCheckTimeout);

			img.onload = () => (clearTimeout(timer), resolve(true));
			img.onerror = () => (clearTimeout(timer), resolve(true));
			img.src = `${url}?d=${Date.now()}`;
		});

		setTimeout(() => cache = undefined, config.onlineCheckCacheTTL);

		const res = {
			status,
			lastOnline
		};

		const updateDate = () => {
			clearTimeout(syncTimer);
			syncTimer = undefined;

			if (url) {
				storage.set('lastOnline', lastOnline = new Date()).catch(stderr);
			}
		};

		if (prevStatus === undefined || status !== prevStatus) {
			if (status) {
				updateDate();
				event.emit('online', lastOnline);

			} else {
				event.emit('offline');
			}

			event.emit('status', res);

		} else if (status && syncTimer != null) {
			syncTimer = setTimeout(updateDate, config.onlineLastDateSyncInterval);
		}

		try {
			await loadFromStorage;
		} catch (_) {}

		return res;
	})();

	return cache;
}

async function onlineCheck(): Promise<void> {
	await isOnline();
	setTimeout(onlineCheck, config.onlineCheckInterval);
}

onlineCheck().catch(stderr);
