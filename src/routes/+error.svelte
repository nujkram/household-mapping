<script lang="ts">
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';

	// Contextual copy per status — a 403 must not read as "page not found".
	$: status = $page.status;
	$: title =
		status === 404
			? 'Page not found'
			: status === 403
				? 'Access denied'
				: status === 401
					? 'Please sign in'
					: 'Something went wrong';
	$: message =
		$page.error?.message ||
		(status === 404
			? "Sorry, the page you're looking for doesn't exist."
			: status === 403
				? "You don't have permission to view this."
				: status === 401
					? 'Your session may have expired. Please log in again.'
					: 'An unexpected error occurred. Please try again.');
</script>

<div class="flex flex-col items-center justify-center min-h-screen bg-surface-100-800-token p-4">
	<div class="text-center p-8 rounded-lg bg-surface-100-900-token shadow-xl flex flex-col gap-4">
		<h1 class="h1 text-4xl font-bold mb-2 text-primary-500">{status} — {title}</h1>
		<p class="text-xl mb-6 text-secondary-500">{message}</p>
		<div class="flex gap-2 justify-center">
			{#if status === 401}
				<button type="button" class="btn variant-filled-primary" on:click={() => goto('/auth/login')}>
					Go to login
				</button>
			{:else}
				<button type="button" class="btn variant-filled-primary" on:click={() => goto('/dashboard')}>
					Return to Home
				</button>
			{/if}
		</div>
	</div>
</div>
