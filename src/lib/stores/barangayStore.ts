import { writable } from 'svelte/store';
import type { Barangay } from '$lib/utils/types';

const createBarangayStore = () => {
	const { subscribe, set, update } = writable<Barangay[]>([]);

	return {
		subscribe,
		set,
		update,
		add: (barangay: Barangay) => update((barangays) => [...barangays, barangay]),
		edit: (updatedBarangay: Barangay) =>
			update((barangays) =>
				barangays.map((barangay) =>
					barangay._id === updatedBarangay._id ? updatedBarangay : barangay
				)
			),
		delete: (id: string) =>
			update((barangays) => barangays.filter((barangay) => barangay._id !== id)),
		refresh: async () => {
			try {
				const response = await fetch('/api/admin/barangay');
				const result = await response.json();
				set(result.response);
			} catch (error) {
				console.error('Error fetching barangays:', error);
			}
		}
	};
};

export const barangayStore = createBarangayStore();
