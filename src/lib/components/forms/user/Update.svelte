<script lang="ts">
	import { focusTrap, getToastStore } from '@skeletonlabs/skeleton';
	import type { ToastSettings } from '@skeletonlabs/skeleton';
	import { goto } from '$app/navigation';
	import { submitJson } from '$lib/utils/apiHelper';
	import { CLUSTER_OPTIONS } from '$lib/utils/clusters';

	export let drawerStore = () => {};
	export let moduleName: string;
	export let user: any;
	export let id: string;
	// Default so the bound <select> has a value even for legacy users.
	if (user && user.cluster == null) user.cluster = '';
	let isFocused: boolean = true;
	let isSubmitting = false;

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
		if (isSubmitting) return;
		isSubmitting = true;
		try {
			const result = await submitJson('/api/admin/user/update', {
				_id: user?._id,
				lastName: user?.lastName,
				firstName: user?.firstName,
				phone: user?.phone,
				role: user?.role,
				cluster: user?.cluster || ''
			});

			toastSettings.message = result.message;
			toastSettings.background = 'bg-green-500';
			toastStore.trigger(toastSettings);
			goto(`/dashboard/${moduleName}`);
		} catch (error) {
			toastSettings.message = error instanceof Error ? error.message : 'Failed to update user';
			toastSettings.background = 'bg-red-500';
			toastStore.trigger(toastSettings);
			console.error(error);
		} finally {
			isSubmitting = false;
		}
	}}
>
	<h2 class="h4">Update User {user.fullName}</h2>
	<label class="label mt-4">
		<span>Role</span>
		<select class="select" bind:value={user.role} required>
			<option value="ADMINISTRATOR">Administrator — full access</option>
			<option value="ENCODER">Encoder — tags & edits households</option>
			<option value="GRANT_OFFICER">Grant Officer — awards grants</option>
		</select>
	</label>
	{#if user.role === 'ENCODER'}
		<label class="label mt-4">
			<span>Assigned Cluster</span>
			<select class="select" bind:value={user.cluster}>
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
			bind:value={user.lastName}
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
			bind:value={user.firstName}
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
			bind:value={user.phone}
			required
		/>
	</label>

	<div class="flex gap-4 place-content-end w-full">
		<button type="submit" disabled={isSubmitting} class="btn variant-filled-success mt-4"
			>{isSubmitting ? 'Updating...' : 'Update'}</button
		>
		<button type="button" class="btn variant-filled mt-4" on:click={() => drawerStore.close()}
			>Cancel</button
		>
	</div>
</form>
