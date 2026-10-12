import adapter from '@sveltejs/adapter-vercel';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	extensions: ['.svelte'],
	// Consult https://kit.svelte.dev/docs/integrations#preprocessors
	// for more information about preprocessors
	preprocess: [vitePreprocess()],

	vitePlugin: {
		inspector: true
	},
	kit: {
		// Deployed on Vercel. adapter-auto installed adapter-vercel@4 at build time,
		// which only knows Node 18/20 — both discontinued on Vercel — so the adapter is
		// pinned EXACTLY to 6.3.0: the newest release that supports Node 24 and still
		// works with this project's SvelteKit 2.8 (6.3.1+ read a Kit 2.27+ option and
		// crash; 7.x needs Kit 3). The runtime is explicit so it doesn't depend on the
		// build image's Node version; keep it in step with `engines.node`.
		adapter: adapter({ runtime: 'nodejs24.x' })
	}
};
export default config;
