/**
 * POST a JSON body and return the parsed response. Throws an Error carrying the
 * server-provided message when the response is not OK, so callers can surface a
 * real error toast instead of silently showing "success" on a 4xx/5xx.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const submitJson = async (url: string, body: unknown): Promise<any> => {
	const response = await fetch(url, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(body)
	});

	const result = await response.json().catch(() => ({}));

	if (!response.ok || result?.status === 'Error') {
		const message =
			result?.error || result?.message || `Request failed (${response.status})`;
		throw new Error(message);
	}

	return result;
};
