<script lang="ts">
	import { page } from '$app/stores';
	import { getToastStore } from '@skeletonlabs/skeleton';
	import type { ToastSettings } from '@skeletonlabs/skeleton';
	import CryptoJS from 'crypto-js';

	export let data;
	const { user } = data;

	let username: string = '';
	let password: string = '';
	let loggingIn = false;
	let hasAccess = false;

	// toats settings
	const toastStore = getToastStore();
	const toastSettings: ToastSettings = {
		message: '',
		timeout: 5000
	};

	$: {
		if (user) {
			hasAccess = true;
			redirect();
		} else {
			setTimeout(() => {
				hasAccess = false;
			}, 500);
		}
	}

	const redirect = () => {
		window.location.href = '/dashboard';
	};

	const handleLogin = async (): Promise<void> => {
		try {
			const securePassword: string = CryptoJS.SHA256(password).toString();
			const response = await fetch('/api/auth/login', {
				method: 'POST',
				headers: {
					'content-type': 'application/json'
				},
				body: JSON.stringify({ username, password: securePassword })
			});

			const data = await response.json();

			if (!response.ok) {
				throw new Error(data.message || 'Login failed');
			}

			toastSettings.message = `Welcome back ${data.user.firstName}!`;
			toastSettings.background = 'bg-green-500';
			toastStore.trigger(toastSettings);

			// Full page load (not client-side goto) so every load() re-runs against
			// the new session — otherwise the previous user's cached page data
			// (role, cluster-scoped tables) lingers until a manual refresh.
			window.location.href = '/dashboard';
		} catch (error) {
			toastSettings.message = error.message || 'Invalid username or password';
			toastSettings.background = 'bg-red-500';
			toastStore.trigger(toastSettings);
			loggingIn = false;
		}
	};
</script>

<div class="flex flex-col justify-center items-center">
	<div class="mt-12">
		<header class="text-center py-4">
			<div class="text-center mb-2 text-3xl font-bold">Welcome back!</div>
		</header>
		<div class="card p-6 space-y-6 shadow-xl text-left">
			<form
				class="space-y-4"
				method="POST"
				autocomplete="off"
				on:submit={(e) => {
					e.preventDefault();
					if (!loggingIn) {
						loggingIn = true;
						handleLogin();
					}
				}}
			>
				<label class="label">
					<span>Username</span>
					<input type="text" placeholder="username" bind:value={username} class="input" />
				</label>
				<label class="label">
					<span>Password</span>
					<input type="password" placeholder="password" bind:value={password} class="input" />
				</label>
				<button class="btn variant-filled-primary w-full">Login</button>
			</form>
		</div>
	</div>
</div>
