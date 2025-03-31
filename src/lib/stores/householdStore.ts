import type { Household } from '$lib/utils/types';
import { writable } from 'svelte/store';

const createHouseholdStore = () => {
	const { subscribe, set, update } = writable<Household[]>([]);

	return {
		subscribe,
		set,
		update,
		add: (household: Household) => update((households) => [...households, household]),
		edit: (updatedHousehold: Household) =>
			update((households) =>
				households.map((household) =>
					household._id === updatedHousehold._id ? updatedHousehold : household
				)
			),
		delete: (id: string) =>
			update((households) => households.filter((household) => household._id !== id)),
		refresh: async () => {
			try {
				// First get households - using the correct endpoint
				const householdResponse = await fetch('/api/admin/household', {
					method: 'GET',
					headers: { 'Content-Type': 'application/json' }
				});
				const householdResult = await householdResponse.json();

				// Get barangays for mapping
				const barangayResponse = await fetch('/api/admin/barangay', {
					method: 'GET',
					headers: { 'Content-Type': 'application/json' }
				});
				const barangayResult = await barangayResponse.json();

				// Create barangay name map
				const barangayMap = new Map(barangayResult.response.map((b: any) => [b._id, b.name]));

				// Enhance households with barangay names
				const enhancedHouseholds = householdResult.response.map((household: Household) => ({
					...household,
					barangayName: barangayMap.get(household.barangayId) || 'Unknown Barangay'
				}));

				set(enhancedHouseholds);
			} catch (error) {
				console.error('Error refreshing household store:', error);
			}
		}
	};
};

export const householdStore = createHouseholdStore();
