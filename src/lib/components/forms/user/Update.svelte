<script lang="ts">
	import { focusTrap, getToastStore } from '@skeletonlabs/skeleton';
	import type { ToastSettings } from '@skeletonlabs/skeleton';
	import { goto } from '$app/navigation';

	export let drawerStore = () => {};
	export let moduleName: string;
	export let user: any;
	export let id: string;
	let isFocused: boolean = true;

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
			let response = await fetch('/api/admin/user/update', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					_id: user?._id,
					lastName: user?.lastName,
					firstName: user?.firstName,
					phone: user?.phone,
					role: user?.role
				})
			});

			let result = await response.json();

			toastSettings.message = result.message;
			toastSettings.background = 'bg-green-500';
			toastStore.trigger(toastSettings);
			goto(`/dashboard/${moduleName}`);
		} catch (error) {
			toastSettings.message = error.message;
			toastSettings.background = 'bg-red-500';
			toastStore.trigger(toastSettings);
			console.error(error);
		}
	}}
>
	<h2 class="h4">Update User {user.fullName}</h2>
	<label class="label mt-4">
		<span>Role</span>
		<select class="select" bind:value={user.role} required>
			<option value="ADMINISTRATOR">Admin</option>
		</select>
	</label>
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
		<button type="submit" class="btn variant-filled-success mt-4">Update</button>
		<button type="button" class="btn variant-filled mt-4" on:click={() => drawerStore.close()}
			>Cancel</button
		>
	</div>
</form>
