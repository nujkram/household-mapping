<script lang="ts">
	import { page } from '$app/stores';
	import { AppRailAnchor } from '@skeletonlabs/skeleton';
	import {
		Building,
		Home,
		Tag,
		PersonBadge,
		People,
		CashStack,
		Gear
	} from '$lib/components/icons/index';
	import { canEditHouseholds, canManageGrants, isAdmin } from '$lib/utils/roles';

	// Show each user only the pages their role can actually open.
	$: role = $page.data.user?.role;
</script>

<AppRailAnchor title="Home" href="/dashboard" selected={$page.url.pathname === '/dashboard'}>
	<svelte:fragment slot="lead">
		<div class="flex items-center justify-center">
			<Home />
		</div>
	</svelte:fragment>
	<span>Home</span>
</AppRailAnchor>
{#if isAdmin(role)}
	<AppRailAnchor
		title="Barangays"
		href="/dashboard/barangays"
		selected={$page.url.pathname === '/dashboard/barangays'}
	>
		<svelte:fragment slot="lead">
			<div class="flex items-center justify-center">
				<Building />
			</div>
		</svelte:fragment>
		<span>Barangays</span>
	</AppRailAnchor>
{/if}
<AppRailAnchor
	title="Households"
	href="/dashboard/households"
	selected={$page.url.pathname === '/dashboard/households'}
>
	<svelte:fragment slot="lead">
		<div class="flex items-center justify-center">
			<People />
		</div>
	</svelte:fragment>
	<span>Households</span>
</AppRailAnchor>
{#if canManageGrants(role)}
	<AppRailAnchor
		title="Grants"
		href="/dashboard/grants"
		selected={$page.url.pathname === '/dashboard/grants'}
	>
		<svelte:fragment slot="lead">
			<div class="flex items-center justify-center">
				<CashStack />
			</div>
		</svelte:fragment>
		<span>Grants</span>
	</AppRailAnchor>
{/if}
{#if canEditHouseholds(role)}
	<AppRailAnchor
		title="Map"
		href="/dashboard/map"
		selected={$page.url.pathname === '/dashboard/map'}
	>
		<svelte:fragment slot="lead">
			<div class="flex items-center justify-center">
				<Tag />
			</div>
		</svelte:fragment>
		<span>Map</span>
	</AppRailAnchor>
{/if}
{#if isAdmin(role)}
	<AppRailAnchor
		title="Upload"
		href="/dashboard/upload"
		selected={$page.url.pathname === '/dashboard/upload'}
	>
		<svelte:fragment slot="lead">
			<div class="flex items-center justify-center">
				<People />
			</div>
		</svelte:fragment>
		<span>Upload</span>
	</AppRailAnchor>
	<AppRailAnchor
		title="Users"
		href="/dashboard/users"
		selected={$page.url.pathname === '/dashboard/users'}
	>
		<svelte:fragment slot="lead">
			<div class="flex items-center justify-center">
				<PersonBadge />
			</div>
		</svelte:fragment>
		<span>Users</span>
	</AppRailAnchor>
	<AppRailAnchor
		title="Settings"
		href="/dashboard/settings"
		selected={$page.url.pathname === '/dashboard/settings'}
	>
		<svelte:fragment slot="lead">
			<div class="flex items-center justify-center">
				<Gear />
			</div>
		</svelte:fragment>
		<span>Settings</span>
	</AppRailAnchor>
{/if}
