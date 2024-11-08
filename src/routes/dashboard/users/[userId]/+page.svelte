<script lang="ts">
	import { Avatar, Drawer, getDrawerStore } from '@skeletonlabs/skeleton';
	import type { DrawerSettings } from '@skeletonlabs/skeleton';
	import Update from '$lib/components/forms/user/Update.svelte';
	import ResetPassword from '$lib/components/forms/user/ResetPassword.svelte';
	export let data;

	let { userDetail } = data;

	// drawer settings
	const drawerUpdate: DrawerSettings = {
		id: 'updateUser',
		// Provide your property overrides:
		bgDrawer: 'bg-gradient-to-t from-slate-900 via-gray-950 to-zinc-950 text-white',
		bgBackdrop: 'bg-gradient-to-tr from-slate-900/50 via-gray-950/50 to-zinc-950/50',
		width: 'w-[280px] md:w-[480px]',
		padding: 'p-4',
		rounded: 'rounded-xl',
		position: 'right'
	};

	const drawerReset: DrawerSettings = {
		id: 'resetPassword',
		// Provide your property overrides:
		bgDrawer: 'bg-gradient-to-t from-slate-900 via-gray-950 to-zinc-950 text-white',
		bgBackdrop: 'bg-gradient-to-tr from-slate-900/50 via-gray-950/50 to-zinc-950/50',
		width: 'w-[280px] md:w-[480px]',
		padding: 'p-4',
		rounded: 'rounded-xl',
		position: 'right'
	};

	const drawerStore = getDrawerStore();
	drawerStore.close();

	// get full name initial from user.fullname
	let fullNameInitial = userDetail.fullName
		.split(' ')
		.map((name: string) => name[0])
		.join('');
</script>

<div class="card p-4">
	<header class="card-header flex justify-center">
		<Avatar initials={fullNameInitial} background="bg-primary-500" fontSize={250} width="w-28" />
	</header>
	<section class="p-4 flex flex-col items-center">
		<h1 class="h1 text-center md:text-left">{userDetail?.fullName || 'NA'}</h1>
		<h2 class="h2 italic">{userDetail?.role || 'NA'}</h2>
		<div class="flex flex-col md:flex-row w-full gap-4 justify-between mt-4">
			<div class="flex flex-col items-center">
				<h3 class="h3">Username</h3>
				<p class="p">{userDetail?.username || 'NA'}</p>
			</div>
			<div class="flex flex-col items-center">
				<h3 class="h3">Email</h3>
				<p class="p">{userDetail?.email || 'NA'}</p>
			</div>
			<div class="flex flex-col items-center">
				<h3 class="h3">Phone</h3>
				<p class="p">{userDetail?.phone || 'NA'}</p>
			</div>
		</div>
	</section>
	<footer class="card-footer flex justify-end border-t-2 p-4">
		<div class="btn-group variant-filled overflow-auto">
			<button type="button" on:click={() => drawerStore.open(drawerUpdate)}>Edit</button>
			<button type="button" on:click={() => drawerStore.open(drawerReset)}>Reset Password</button>
			<button type="button" on:click={() => window.history.back()}>Close</button>
		</div>
	</footer>
</div>

<Drawer>
	{#if $drawerStore.id === 'updateUser'}
		<Update id={userDetail?._id} moduleName={'users'} user={userDetail} {drawerStore} />
	{:else if $drawerStore.id === 'resetPassword'}
		<ResetPassword id={userDetail?._id} {drawerStore} />
	{/if}
</Drawer>
