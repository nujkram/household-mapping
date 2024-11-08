<script lang="ts">
	import { SHA256 } from 'crypto-js';
	import { focusTrap, getToastStore } from '@skeletonlabs/skeleton';
	import type { ToastSettings } from '@skeletonlabs/skeleton';

	export let drawerStore = () => {};
	export let id: string;
	let isFocused: boolean = true;
	let password: string, confirmPassword: string;

	// toast settings
	const toastStore = getToastStore();
	const toastSettings: ToastSettings = {
		message: '',
		timeout: 5000
	};
</script>

<form
	method="POST"
	autocomplete="off"
	class="p-6"
	use:focusTrap={isFocused}
	on:submit|preventDefault={async () => {
		try {
			if (password != confirmPassword) {
				toastSettings.message = 'Password and confirm password does not match';
				toastSettings.background = 'bg-red-500';
				toastStore.trigger(toastSettings);
				return;
			}
			const hashedPassword = await SHA256(password).toString();
			let response = await fetch('/api/admin/user/reset-password', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					_id: id,
					password: hashedPassword
				})
			});

			let result = await response.json();

			toastSettings.message = result.message;
			toastSettings.background = 'bg-green-500';
			toastStore.trigger(toastSettings);
			drawerStore.close();
		} catch (error) {
			toastSettings.message = error.message;
			toastSettings.background = 'bg-red-500';
			toastStore.trigger(toastSettings);
			console.error(error);
		}
	}}
>
	<h2 class="h4">Reset Password</h2>

	<label class="label mt-4">
		<span>Password</span>
		<input
			class="input"
			type="password"
			placeholder="must be between 8~16 characters long"
			name="password"
			bind:value={password}
			required
		/>
	</label>
	<label class="label mt-4">
		<span>Confirm Password</span>
		<input
			class="input"
			type="password"
			placeholder="confirm password"
			name="confirmPassword"
			bind:value={confirmPassword}
			required
		/>
	</label>

	<div class="flex gap-4 place-content-end w-full">
		<button type="submit" class="btn variant-filled-success mt-4">Update</button>
		<button type="button" class="btn variant-filled mt-4" on:click={() => drawerStore.close()}
			>Cancel</button
		>
	</div>
</form>
