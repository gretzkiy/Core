/*!
 * V4Fire Core
 * https://github.com/V4Fire/Core
 *
 * Released under the MIT license
 * https://github.com/V4Fire/Core/blob/master/LICENSE
 */

import $C = require('collection.js');
import Then from 'core/then';

import Response from 'core/request/response';
import RequestError from 'core/request/error';
import { RequestOptions } from 'core/request/interface';

/**
 * Creates request by XMLHttpRequest with the specified parameters and returns a promise
 * @param params
 */
export default function createTransport(params: RequestOptions): Then<Response> {
	const
		p = params,
		xhr = new XMLHttpRequest();

	let
		data = p.body,
		{contentType} = p;

	if (data) {
		if (data instanceof FormData) {
			contentType = '';

		} else if (Object.isObject(data)) {
			data = JSON.stringify(data);
			contentType = 'application/json;charset=UTF-8';
		}
	}

	xhr.open(<string>p.method, p.url, true);

	if (p.timeout != null) {
		xhr.timeout = p.timeout;
	}

	if (p.responseType) {
		xhr.responseType = p.responseType === 'json' ?
			'text' :
			<XMLHttpRequestResponseType>p.responseType.toLowerCase();
	}

	if (p.credentials) {
		xhr.withCredentials = true;
	}

	$C(p.headers).forEach((val, name) => {
		if (Object.isArray(val)) {
			$C(val as string[]).forEach((val) => xhr.setRequestHeader(name, val));

		} else {
			xhr.setRequestHeader(name, val);
		}
	});

	if (contentType) {
		xhr.setRequestHeader('Content-Type', contentType);
	}

	return new Then<Response>((resolve, reject, onAbort) => {
		onAbort(() => {
			xhr.abort();
		});

		xhr.addEventListener('load', () => {
			resolve(new Response(xhr.response, {
				parent: p.parent,
				important: p.important,
				responseType: p.responseType,
				okStatuses: p.okStatuses,
				status: xhr.status,
				headers: xhr.getAllResponseHeaders(),
				decoder: p.decoder
			}));
		});

		xhr.addEventListener('error', (err) => {
			reject(err);
		});

		xhr.addEventListener('timeout', () => {
			reject(new RequestError('timeout'));
		});

		xhr.send(<any>data);
	}, p.parent);
}
