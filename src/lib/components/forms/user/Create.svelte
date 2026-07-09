<script lang="ts">
	import { onMount } from 'svelte';
	import { SHA256 } from 'crypto-js';
	import { focusTrap, getToastStore } from '@skeletonlabs/skeleton';
	import type { ToastSettings } from '@skeletonlabs/skeleton';
	import { submitJson } from '$lib/utils/apiHelper';
	import { CLUSTER_OPTIONS } from '$lib/utils/clusters';

	export const drawerStore = () => {};

	const isFocused = true;
	let isSubmitting = false;
	let lastName: string;
	let firstName: string;
	let username: string;
	let password: string;
	let confirmPassword: string;
	let role: string;
	let email: string;
	let phone: string;
	let cluster = '';

	let stations: { id: string; name: string }[] = [];

	// toast settings
	const toastStore = getToastStore();
	const toastSettings: ToastSettings = {
		message: '',
		timeout: 5000
	};

	onMount(async (): Promise<void> => {
		try {
			const response: Response = await fetch('/api/admin/barangay');
			const result: { data: { id: string; name: string }[] } = await response.json();

			stations = result.response;
		} catch (error) {
			console.error('Error fetching stations:', error);
			stations = []; // Ensure stations is an empty array if fetch fails
		}
	});
</script>

<form
	method="POST"
	autocomplete="off"
	class="p-6"
	use:focusTrap={isFocused}
	on:submit|preventDefault={async () => {
		if (isSubmitting) return;
		if (password != confirmPassword) {
			toastSettings.message = 'Password and Confirm Password does not match';
			toastSettings.background = 'bg-red-500';
			toastStore.trigger(toastSettings);
			return;
		}
		isSubmitting = true;
		try {
			const hashedPassword = SHA256(password).toString();
			const result = await submitJson('/api/admin/user/insert', {
				username,
				lastName,
				firstName,
				password: hashedPassword,
				email,
				phone,
				role,
				cluster
			});

			toastSettings.message = result.message;
			toastSettings.background = 'bg-green-500';
			toastStore.trigger(toastSettings);
			window.location.reload();
		} catch (error) {
			toastSettings.message = error instanceof Error ? error.message : 'Failed to create user';
			toastSettings.background = 'bg-red-500';
			toastStore.trigger(toastSettings);
			console.error(error);
		} finally {
			isSubmitting = false;
		}
	}}
>
	<h2 class="h4">Create User</h2>
	<label class="label mt-4">
		<span>Email</span>
		<input
			class="input"
			type="email"
			placeholder="juandelacruz@sample.com"
			name="email"
			bind:value={email}
			required
		/>
	</label>
	<label class="label mt-4">
		<span>Username</span>
		<input
			class="input"
			type="text"
			placeholder="juan.delacruz"
			name="username"
			bind:value={username}
			required
		/>
	</label>
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
	<label class="label mt-4">
		<span>Role</span>
		<select class="select" bind:value={role} required>
			<option value="ADMINISTRATOR">Administrator — full access</option>
			<option value="ENCODER">Encoder — tags & edits households</option>
			<option value="GRANT_OFFICER">Grant Officer — awards grants</option>
		</select>
	</label>
	{#if role === 'ENCODER'}
		<label class="label mt-4">
			<span>Assigned Cluster</span>
			<select class="select" bind:value={cluster}>
				<option value="">All clusters (no restriction)</option>
				{#each CLUSTER_OPTIONS as c}
					<option value={c.value}>{c.label}</option>
				{/each}
			</select>
			<span class="text-xs opacity-60">Encoder will only see households in this cluster.</span>
		</label>
	{/if}
	<hr class="mt-4" />
	<label class="label mt-4">
		<span>Last Name</span>
		<input
			class="input"
			type="text"
			placeholder="Dela Cruz"
			name="lastName"
			bind:value={lastName}
			required
		/>
	</label>
	<label class="label mt-4">
		<span>First Name</span>
		<input
			class="input"
			type="text"
			placeholder="Juan"
			name="firstName"
			bind:value={firstName}
			required
		/>
	</label>
	<label class="label mt-4">
		<span>Phone</span>
		<input
			class="input"
			type="text"
			placeholder="+639171234567"
			name="phone"
			bind:value={phone}
			required
		/>
	</label>

	<div class="flex gap-4 place-content-end w-full">
		<button type="submit" disabled={isSubmitting} class="btn variant-filled-success mt-4"
			>{isSubmitting ? 'Saving...' : 'Submit'}</button
		>
		<button type="button" class="btn variant-filled mt-4" on:click={() => drawerStore.close()}
			>Cancel</button
		>
	</div>
</form>
