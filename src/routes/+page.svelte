<!-- YOU CAN DELETE EVERYTHING IN THIS PAGE -->

<script lang="ts">
	import { Drawer, getDrawerStore, getToastStore } from '@skeletonlabs/skeleton';
	import type { DrawerSettings, ToastSettings } from '@skeletonlabs/skeleton';
	import { goto } from '$app/navigation';
	import CryptoJS from 'crypto-js';

	export let data;
	const { user } = data;

	let username = '';
	let password = '';
	let loggingIn = false;
	let hasAccess = false;

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
		if (data.user.role === 'ADMINISTRATOR') goto('/dashboard');
		else if (data.user.role === 'JUDGE') goto(`/judge/${data.user._id}`);
		else goto('/');
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

			// The page will automatically refresh with the new session
			if (data.user.role === 'ADMINISTRATOR') {
				goto('/dashboard');
			}
		} catch (error) {
			toastSettings.message = error.message || 'Invalid username or password';
			toastSettings.background = 'bg-red-500';
			toastStore.trigger(toastSettings);
			loggingIn = false;
		}
	};

	// drawer settings
	const drawerLogin: DrawerSettings = {
		id: 'login',
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

	// toats settings
	const toastStore = getToastStore();
	const toastSettings: ToastSettings = {
		message: '',
		timeout: 5000
	};
</script>

<div class="container h-full mx-auto flex justify-center items-center">
	<div class="space-y-10 text-center flex flex-col items-center">
		<h2 class="h2">HOUSEHOLD MAPPING</h2>
		<!-- Animated Logo -->
		<figure>
			<section class="img-bg" />
			<img src="/logo.png" alt="logo" class="w-72" />
		</figure>
		<!-- / -->
		<div class="flex justify-center space-x-2">
			<button
				type="button"
				class="btn variant-filled"
				on:click={() => drawerStore.open(drawerLogin)}>Login</button
			>
		</div>
	</div>
</div>

<Drawer>
	<h1 class="h1 mx-6 pt-4">Login</h1>
	<form
		method="POST"
		autocomplete="off"
		class="p-6"
		on:submit={(e) => {
			e.preventDefault();
			if (!loggingIn) {
				loggingIn = true;
				handleLogin();
			}
		}}
	>
		<label class="label mt-4">
			<span>Username</span>
			<input
				class="input"
				type="text"
				placeholder="username"
				name="username"
				bind:value={username}
			/>
		</label>
		<label class="label mt-4">
			<span>Password</span>
			<input
				class="input"
				type="password"
				placeholder="password"
				name="password"
				bind:value={password}
			/>
		</label>

		<button type="submit" class="btn variant-filled mt-4">Login</button>
	</form>
</Drawer>

<style lang="postcss">
	figure {
		@apply flex relative flex-col;
	}
	figure svg,
	.img-bg {
		@apply w-64 h-64 md:w-80 md:h-80;
	}
	.img-bg {
		@apply absolute z-[-1] rounded-full blur-[50px] transition-all;
		animation:
			pulse 5s cubic-bezier(0, 0, 0, 0.5) infinite,
			glow 5s linear infinite;
	}
	@keyframes glow {
		0% {
			@apply bg-primary-400/50;
		}
		33% {
			@apply bg-secondary-400/50;
		}
		66% {
			@apply bg-tertiary-400/50;
		}
		100% {
			@apply bg-primary-400/50;
		}
	}
	@keyframes pulse {
		50% {
			transform: scale(1.5);
		}
	}
</style>
