/*!
 * V4Fire Core
 * https://github.com/V4Fire/Core
 *
 * Released under the MIT license
 * https://github.com/V4Fire/Core/blob/master/LICENSE
 */

import config from 'config';

import { event } from 'core/net/const';
import { NetStatus } from 'core/net/interface';

const
	{online} = config;

const
	storage = import('core/kv-storage').then(({asyncLocal}) => asyncLocal.namespace('[[NET]]'));

let
	status,
	lastOnline,
	cache,
	syncTimer,
	retryCount = 0;

/**
 * If online returns true
 *
 * @emits online()
 * @emits offline(lastOnline: Date)
 * @emits status(value: NetStatus)
 */
export function isOnline(): Promise<NetStatus> {
	if (cache) {
		return cache;
	}

	const res = (async () => {
		const
			url = online.checkURL,
			prevStatus = status;

		if (!url) {
			return {
				status: true,
				lastOnline: undefined
			};
		}

		let
			loadFromStorage;

		if (online.persistence && !lastOnline) {
			if (!storage) {
				throw new ReferenceError('kv-storage module is not loaded');
			}

			loadFromStorage = storage.then((storage) => storage.get('lastOnline').then((v) => {
				if (v) {
					lastOnline = v;
				}
			})).catch(stderr);
		}

		status = await new Promise<boolean>((resolve) => {
			const retry = () => {
				if (!online.retryCount || status === undefined || ++retryCount > online.retryCount) {
					resolve(false);

				} else {
					checkOnline();
				}
			};

			const checkOnline = () => {
				const
					img = new Image(),
					timer = setTimeout(retry, online.checkTimeout || 0);

				img.onload = () => {
					clearTimeout(timer);
					retryCount = 0;
					resolve(true);
				};

				img.onerror = () => {
					clearTimeout(timer);
					retry();
				};

				img.src = `${url}?d=${Date.now()}`;
			};

			checkOnline();
		});

		if (online.cacheTTL) {
			setTimeout(() => cache = undefined, online.cacheTTL);
		}

		const updateDate = () => {
			clearTimeout(syncTimer);
			syncTimer = undefined;

			if (online.persistence && url) {
				if (!storage) {
					throw new ReferenceError('kv-storage module is not loaded');
				}

				storage.then((storage) => storage.set('lastOnline', lastOnline = new Date())).catch(stderr);
			}
		};

		if (prevStatus === undefined || status !== prevStatus) {
			if (status) {
				event.emit('online', lastOnline);

			} else {
				event.emit('offline');
			}

			updateDate();
			event.emit('status', {status, lastOnline});

		} else if (status && syncTimer != null) {
			if (online.lastDateSyncInterval) {
				syncTimer = setTimeout(updateDate, online.lastDateSyncInterval);
			}
		}

		try {
			await loadFromStorage;
		} catch {}

		return {status, lastOnline};
	})();

	if (online.cacheTTL) {
		cache = res;
	}

	return res;
}

async function onlineCheck(): Promise<void> {
	if (online.checkInterval) {
		await isOnline();
		setTimeout(onlineCheck, online.checkInterval);
	}
}

onlineCheck().catch(stderr);