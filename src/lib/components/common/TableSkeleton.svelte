<script lang="ts">
	/** Number of placeholder rows to render. */
	export let rows = 5;
	/** Number of placeholder cells per row (match the real table's columns). */
	export let cols = 4;
</script>

{#each Array(rows) as _, i}
	<tr aria-hidden="true">
		{#each Array(cols) as _, j}
			<td>
				<div
					class="placeholder animate-pulse"
					style="animation-delay: {(i * cols + j) * 50}ms"
				></div>
			</td>
		{/each}
	</tr>
{/each}
