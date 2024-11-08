<script lang="ts">
	import { goto } from '$app/navigation';
</script>

<div class="flex flex-col items-center justify-center min-h-screen bg-surface-100-800-token p-4">
	<div class="text-center p-8 rounded-lg bg-surface-100-900-token shadow-xl flex flex-col gap-4">
		<h1 class="h1 text-4xl font-bold mb-4 text-primary-500">Unauthorized Access</h1>
		<p class="text-xl mb-6 text-secondary-500">
			Sorry, you don't have permission to access this page.
		</p>
		<button type="button" class="btn variant-filled-primary" on:click={() => goto('/')}>
			Return to Home
		</button>
	</div>
</div>
