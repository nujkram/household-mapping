<script lang="ts">
	import { page } from '$app/stores';
	import { AppRail } from '@skeletonlabs/skeleton';
	import AdminSidebarItem from './admin/SidebarItem.svelte';
</script>

<AppRail>
	{#if $page.data.user?.role === 'ADMINISTRATOR'}
		<AdminSidebarItem />
	{/if}
</AppRail>
