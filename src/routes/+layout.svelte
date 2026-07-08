<script lang="ts">
	import { page } from '$app/stores';
	import { navigating } from '$app/stores';
	import '../app.postcss';
	import { AppShell, AppBar, initializeStores, Toast } from '@skeletonlabs/skeleton';

	// Highlight JS
	import hljs from 'highlight.js/lib/core';
	import 'highlight.js/styles/github-dark.css';
	import { storeHighlightJs } from '@skeletonlabs/skeleton';
	import xml from 'highlight.js/lib/languages/xml'; // for HTML
	import css from 'highlight.js/lib/languages/css';
	import javascript from 'highlight.js/lib/languages/javascript';
	import typescript from 'highlight.js/lib/languages/typescript';
	import Navbar from '$lib/components/dashboard/Navbar.svelte';
	import Sidebar from '$lib/components/dashboard/Sidebar.svelte';

	hljs.registerLanguage('xml', xml); // for HTML
	hljs.registerLanguage('css', css);
	hljs.registerLanguage('javascript', javascript);
	hljs.registerLanguage('typescript', typescript);
	storeHighlightJs.set(hljs);

	// Floating UI for Popups
	import { computePosition, autoUpdate, flip, shift, offset, arrow } from '@floating-ui/dom';
	import { storePopup } from '@skeletonlabs/skeleton';
	storePopup.set({ computePosition, autoUpdate, flip, shift, offset, arrow });

	initializeStores();
</script>

<!-- Global navigation progress bar: instant feedback while the next page's
     server load runs, so navigation never looks frozen. -->
{#if $navigating}
	<div class="nav-progress" aria-hidden="true"></div>
{/if}

<!-- App Shell -->
<AppShell>
	<svelte:fragment slot="header">
		<!-- App Bar -->
		<AppBar>
			<svelte:fragment slot="lead">
				<a href="/dashboard">
					<strong class="text-xl uppercase">HOUSEHOLD MAPPING</strong>
				</a>
			</svelte:fragment>
			<svelte:fragment slot="trail">
				<Navbar />
			</svelte:fragment>
		</AppBar>
	</svelte:fragment>
	<svelte:fragment slot="sidebarLeft">
		{#if $page.data.user}
			<Sidebar />
		{/if}
	</svelte:fragment>
	<!-- Page Route Content -->
	<div class="p-4">
		<slot />
	</div>
</AppShell>
<Toast />

<style>
	.nav-progress {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		height: 3px;
		z-index: 9999;
		background: linear-gradient(
			90deg,
			transparent,
			rgb(var(--color-primary-500)),
			transparent
		);
		background-size: 50% 100%;
		background-repeat: no-repeat;
		animation: nav-progress-slide 1s ease-in-out infinite;
	}

	@keyframes nav-progress-slide {
		0% {
			background-position: -50% 0;
		}
		100% {
			background-position: 150% 0;
		}
	}
</style>
