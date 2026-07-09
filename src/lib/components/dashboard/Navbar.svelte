<script lang="ts">
	import { page } from '$app/stores';
	import { LightSwitch } from '@skeletonlabs/skeleton';
	import { ROLE_LABELS, type Role } from '$lib/utils/roles';

	$: roleLabel = ROLE_LABELS[$page.data.user?.role as Role] ?? '';

	const handleLogout = () => {
		// Full document request → server clears the session and redirects to login,
		// discarding all cached client-side page data from this session.
		window.location.href = '/auth/logout/';
	};
</script>

<div class="flex items-center gap-2 md:gap-3">
	<LightSwitch />

	{#if $page.data.user}
		<span class="hidden sm:inline text-sm">
			Hi, {$page.data.user.firstName || 'User'}
			{#if roleLabel}
				<span class="badge variant-soft ml-1">{roleLabel}</span>
			{/if}
		</span>
		<!-- Always-visible logout button (no hidden dropdown to discover). -->
		<button type="button" class="btn btn-sm variant-filled-error" on:click={handleLogout}>
			Logout
		</button>
	{/if}
</div>
