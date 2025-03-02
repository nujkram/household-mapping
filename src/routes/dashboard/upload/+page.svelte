<script lang="ts">
	export let data: any;
	const { barangays, user } = data;

	let selectedFile: FileList | null = null;
	let selectedBarangay: string = '';
	let uploading = false;
	let error = '';
	let success = '';
	let previewData: any[] = [];

	// Define our headers as a constant at the top level
	const TABLE_HEADERS = [
		'No.',
		'Precinct',
		'Last Name',
		'First Name',
		'Middle Name',
		'Extension',
		'Address',
		'Disability',
		'VIN'
	];

	// Define name extensions
	const NAME_EXTENSIONS = ['SR', 'JR'];

	// Function to clean name strings
	function cleanName(name: string): string {
		return name
			.replace(/["']/g, '') // Remove quotes
			.replace(/[._]/g, ' ') // Replace periods and underscores with spaces
			.replace(/\s+/g, ' ') // Replace multiple spaces with single space
			.trim(); // Remove leading/trailing spaces
	}

	// Function to clean ID/code values
	function cleanId(value: string): string {
		return value
			.replace(/["']/g, '') // Remove quotes only
			.replace(/\s+/g, '') // Remove all spaces
			.trim();
	}

	async function handleFileSelect(event: Event) {
		const input = event.target as HTMLInputElement;
		if (input.files && input.files[0]) {
			selectedFile = input.files;
			const file = input.files[0];
			const text = await file.text();
			const rows = text.split('\n');

			previewData = rows
				.filter((row) => row.trim())
				.map((row, index) => {
					// Split on commas but preserve commas within quotes
					const values = row.match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g) || [];
					console.log(values);

					// Determine VIN and disability position based on values length
					const vin =
						values.length === 7
							? values[5]?.replace(/"/g, '').trim() || '' // VIN at index 5 for 6 columns
							: values[6]?.replace(/"/g, '').trim() || ''; // VIN at index 6 for 7 columns

					// Adjust disability index based on values length
					const disability =
						values.length === 7
							? values[4]?.replace(/"/g, '').trim() || '' // Disability at index 4 for 6 columns
							: ''; // Disability at index 5 for 7 columns

					const rowData: any = {
						'No.': (index + 1).toString(),
						Precinct: cleanName(values[0] || ''),
						'Last Name': '',
						'First Name': '',
						'Middle Name': '',
						Extension: '',
						Address: cleanName(values[3] || ''),
						Disability: disability, // Direct assignment without cleaning
						VIN: vin // Use the VIN from column 7
					};

					// Parse the name which is in format: "LASTNAME, FIRSTNAME MIDDLENAME SR FRANCISCO"
					const fullNamePart = values[2] || '';
					if (fullNamePart) {
						const cleanedName = fullNamePart.replace(/"/g, '').trim();
						const [lastName = '', firstMiddlePart = ''] = cleanedName
							.split(',', 2)
							.map((part) => part.trim());

						// Split the first/middle part into words
						const nameParts = firstMiddlePart.split(' ').filter((part) => part.length > 0);

						rowData['Last Name'] = cleanName(lastName);

						if (nameParts.length > 0) {
							rowData['First Name'] = cleanName(nameParts[0]);

							// Check for name extensions in the remaining parts
							let middleNameParts = nameParts.slice(1);
							for (let i = 0; i < middleNameParts.length; i++) {
								const part = middleNameParts[i].toUpperCase();
								if (NAME_EXTENSIONS.includes(part)) {
									rowData['Extension'] = part;
									// Remove the extension from middle name parts
									middleNameParts.splice(i, 1);
									break;
								}
							}

							// Join remaining parts as middle name
							if (middleNameParts.length > 0) {
								rowData['Middle Name'] = cleanName(middleNameParts.join(' '));
							}
						}
					}

					return rowData;
				});
		}
	}

	async function handleSubmit(event: Event) {
		if (!selectedBarangay) {
			error = 'Please select a barangay';
			return;
		}

		uploading = true;
		error = '';
		success = '';

		try {
			const formData = new FormData();
			if (selectedFile) {
				// Find the selected barangay object to get its name
				const selectedBarangayObj = barangays.find((b) => b._id === selectedBarangay);
				const barangayName = selectedBarangayObj?.name || '';

				formData.append('file', selectedFile[0]);
				formData.append('barangayId', selectedBarangay);
				formData.append('data', JSON.stringify(previewData));
				formData.append('barangayName', barangayName);

				const response = await fetch('/api/admin/upload', {
					method: 'POST',
					body: formData
				});

				const result = await response.json();
				if (response.ok) {
					success = result.message;
					selectedFile = null;
					previewData = [];
					selectedBarangay = '';
				} else {
					error = result.error || 'Upload failed';
				}
			}
		} catch (e) {
			error = 'Upload failed';
			console.error(e);
		} finally {
			uploading = false;
		}
	}
</script>

<div class="card mb-4">
	<header class="card-header">
		<h1 class="h3">Upload Households Data</h1>
	</header>
	<section class="p-4 w-full">
		<form on:submit|preventDefault={handleSubmit}>
			<div class="grid gap-4 mb-4">
				<label class="label">
					<span>Select Barangay</span>
					<select class="select" bind:value={selectedBarangay} required>
						<option value="">Select a barangay</option>
						{#each barangays as barangay}
							<option value={barangay._id}>{barangay.name}</option>
						{/each}
					</select>
				</label>

				<label class="label">
					<span>CSV File</span>
					<input
						type="file"
						class="form-control"
						accept=".csv"
						on:change={handleFileSelect}
						required
					/>
				</label>
			</div>

			{#if error}
				<div class="alert variant-filled-error mb-4">{error}</div>
			{/if}

			{#if success}
				<div class="alert variant-filled-success mb-4">{success}</div>
			{/if}

			<button
				type="submit"
				class="btn variant-filled-primary"
				disabled={uploading || !selectedFile || !selectedBarangay}
			>
				{uploading ? 'Uploading...' : 'Upload'}
			</button>
		</form>
	</section>
</div>

{#if previewData.length > 0}
	<div class="card">
		<header class="card-header">
			<h2 class="h4">Preview Data</h2>
			<p class="text-sm opacity-75">Showing {previewData.length} records</p>
		</header>
		<section class="p-4">
			<div class="table-container">
				<table class="table table-hover">
					<thead>
						<tr>
							{#each TABLE_HEADERS as header}
								<th>{header}</th>
							{/each}
						</tr>
					</thead>
					<tbody>
						{#each previewData as row}
							<tr>
								{#each TABLE_HEADERS as header}
									<td>{row[header]}</td>
								{/each}
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		</section>
	</div>
{/if}
