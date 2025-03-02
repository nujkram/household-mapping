<script lang="ts">
	import { page } from '$app/stores';
	import { AppRailAnchor } from '@skeletonlabs/skeleton';
	import { Building, Fire, Home, PersonBadge, People } from '$lib/components/icons/index';
</script>

<AppRailAnchor title="Home" href="/dashboard" selected={$page.url.pathname === '/dashboard'}>
	<svelte:fragment slot="lead">
		<div class="flex items-center justify-center">
			<Home />
		</div>
	</svelte:fragment>
	<span>Home</span>
</AppRailAnchor>
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
