import type { ToastSettings, ToastStore } from '@skeletonlabs/skeleton';

export const showToast = (toastStore: ToastStore, message: string, isSuccess = true) => {
	const settings: ToastSettings = {
		message,
		timeout: 5000,
		background: isSuccess ? 'bg-green-500' : 'bg-red-500'
	};
	toastStore.trigger(settings);
};

export const showActionConfirmationToast = (
	toastStore: ToastStore,
	message: string,
	actionLabel: string,
	actionCallback: () => void,
	timeout = 8000
) => {
	const settings: ToastSettings = {
		message,
		background: 'bg-yellow-600',
		action: {
			label: actionLabel,
			response: actionCallback
		},
		timeout
	};
	toastStore.trigger(settings);
};

export const createToastSettings = (message: string, isSuccess = true): ToastSettings => {
	return {
		message,
		timeout: 5000,
		background: isSuccess ? 'variant-filled-success' : 'variant-filled-error'
	};
};

export const createActionToastSettings = (
	message: string,
	actionLabel: string,
	actionCallback: () => void,
	timeout = 8000
): ToastSettings => {
	return {
		message,
		background: 'variant-filled-warning',
		action: {
			label: actionLabel,
			response: actionCallback
		},
		timeout
	};
};
