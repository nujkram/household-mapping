<script lang="ts">
	import { page } from '$app/stores';
	import { LightSwitch, popup } from '@skeletonlabs/skeleton';
	import type { PopupSettings } from '@skeletonlabs/skeleton';
	import { goto } from '$app/navigation';

	const popupClick: PopupSettings = {
		event: 'click',
		target: 'popupClick',
		placement: 'bottom'
	};

	const handleLogout = () => {
		goto('/auth/logout/');
	};
</script>

<LightSwitch />

{#key $page.data.user}
	{#if $page.data.user}
		<button class="btn variant-filled w-auto" use:popup={popupClick}
			>Hi, {$page.data.user.firstName || 'User'}</button
		>
		<div class="card p-4 bg-gray-900" data-popup="popupClick">
			{#if $page?.data?.user?.role === 'USER'}
				<a
					class="btn variant-outline-surface variant-filled-surface my-2"
					href="/user/profile/{$page?.data?.user?.empId}">Profile</a
				>
			{/if}
			<button
				type="button"
				class="btn variant-outline-surface variant-filled-surface"
				on:click={handleLogout}>Logout</button
			>
			<div class="arrow bg-surface-100-800-token variant-outline-surface" />
		</div>
	{/if}
{/key}
