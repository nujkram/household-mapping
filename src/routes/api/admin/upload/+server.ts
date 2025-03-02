import { json } from '@sveltejs/kit';
import type { RequestEvent } from '@sveltejs/kit';
import csv from 'csv-parser';
import { Readable } from 'stream';
import { id } from '$lib/common/utils';
import clientPromise from '$lib/server/mongo';
import { checkKey } from '$lib/utils/keyHelper';

interface Household {
	_id: string;
	barangayId: string;
	precinct: string;
	lastName: string;
	firstName: string;
	middleName: string;
	fullName: string;
	address: string;
	disability: string;
	dateOfBirth: Date | null;
	vin: string;
	isVoter: boolean;
	createdAt: Date;
	updatedAt: Date;
	createdBy: string;
	updatedBy: string;
	isActive: boolean;
}

export async function POST({ request, locals }: RequestEvent) {
	try {
		const formData = await request.formData();
		const file = formData.get('file') as File;
		const barangayId = formData.get('barangayId') as string;
		const barangayName = formData.get('barangayName') as string;
		if (!file || !barangayId) {
			return json({ error: 'Missing required fields' }, { status: 400 });
		}

		const fileBuffer = await file.arrayBuffer();
		const fileStream = Readable.from(Buffer.from(fileBuffer));

		const db = await clientPromise();
		const Household = db.collection('households');

		const results: Household[] = [];

		await new Promise((resolve, reject) => {
			fileStream
				.pipe(
					csv({
						headers: false,
						skipLines: 0
					})
				)
				.on('data', (data) => {
					try {
						// Get the full name from the third column (index 2)
						const fullNameRaw = data[2] || '';
						const fullName = fullNameRaw.replace(/"/g, '').trim();

						// Parse the name which is in format: "LASTNAME, FIRSTNAME MIDDLENAME"
						let [lastNamePart = '', firstMiddlePart = ''] = fullName
							.split(',')
							.map((part) => part.trim());

						// Split the first and middle name part into words
						let nameParts = firstMiddlePart.split(' ').filter(Boolean);

						// Handle compound last names (e.g., DELA CRUZ, DE LA CRUZ)
						const compoundLastNames = ['DELA', 'DE LA', 'DEL', 'DE LOS', 'DE LAS', 'DE'];
						let lastName = lastNamePart;
						let firstName = '';
						let middleName = '';

						// Check if any parts of the first/middle section belong to a compound last name
						if (nameParts.length >= 2) {
							// Look for compound last names in the first/middle section
							for (const compound of compoundLastNames) {
								const compoundIndex = nameParts.findIndex((part) =>
									nameParts.slice(part).join(' ').startsWith(compound)
								);
								if (compoundIndex !== -1) {
									// Move the compound part and what follows to the lastName
									const lastNameSuffix = nameParts.splice(compoundIndex).join(' ');
									lastName = `${lastName} ${lastNameSuffix}`.trim();
									break;
								}
							}

							// After removing any compound last name parts:
							// If we have 2 or more parts left, take all but the last as firstName
							if (nameParts.length >= 2) {
								firstName = nameParts.slice(0, -1).join(' ');
								middleName = nameParts[nameParts.length - 1];
							} else {
								// If only 1 part left, it's the firstName
								firstName = nameParts[0];
							}
						} else if (nameParts.length === 1) {
							firstName = nameParts[0];
						}

						let household: any = {
							_id: id(),
							barangayId,
							precinct: data[0] || '', // Column 1: precinct
							lastName: lastName.toUpperCase(),
							firstName: firstName.toUpperCase(),
							middleName: middleName.toUpperCase(),
							fullName: `${firstName} ${middleName} ${lastName}`.toUpperCase().trim(),
							address: data[3] || '', // Column 4: address
							disability: data[4] || '', // Column 5: disability
							dateOfBirth: null, // Column 6: dateOfBirth
							vin: data[6] || '', // Column 7: vin
							isVoter: true,
							createdAt: new Date(),
							updatedAt: new Date(),
							createdBy: locals.user._id,
							updatedBy: locals.user._id,
							isActive: true
						};

						// Apply the checkKey function to standardize the data
						household = checkKey(household);

						// Only push if we have at least a last name or first name
						if (household.lastName || household.firstName) {
							results.push(household);
						}
					} catch (error) {
						console.error('Error processing row:', error, data);
					}
				})
				.on('end', resolve)
				.on('error', reject);
		});

		if (results.length > 0) {
			const response = await Household.insertMany(results);

			if (response) {
				return json({
					status: 'Success',
					message: `Successfully uploaded ${results.length} households in ${barangayName}`,
					response
				});
			}
		}

		return json({ error: 'No records to insert' }, { status: 400 });
	} catch (error) {
		console.error('Upload error:', error);
		return json(
			{
				status: 'Error',
				message: 'Failed to process upload',
				error: error.message
			},
			{ status: 500 }
		);
	}
}
