export const ssr = false;

/** @type {import('./$types').PageServerLoad} */
export async function load({ locals }: { locals: unknown }) {
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const { user }: any = locals;

	return {
		user
	};
}
