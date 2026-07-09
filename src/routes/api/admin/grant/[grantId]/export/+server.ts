import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import ExcelJS from 'exceljs';
import clientPromise from '$lib/server/mongo';
import { fetchGrantRecipients } from '$lib/server/grantReport';

const COLUMNS = ['#', 'Full Name', 'Barangay', 'Cluster', 'Date Received', 'Recorded By'];
const WIDTHS = [6, 36, 20, 12, 16, 26];

export const GET: RequestHandler = async ({ params, url }) => {
	const db = await clientPromise();

	const grant = await db.collection('grants').findOne({ _id: params.grantId });
	if (!grant) {
		throw error(404, 'Grant not found');
	}

	// Same filters as the report page, so the file matches the screen.
	const recipients = await fetchGrantRecipients(db, params.grantId, {
		q: url.searchParams.get('q') ?? '',
		barangay: url.searchParams.get('barangay') ?? '',
		cluster: url.searchParams.get('cluster') ?? ''
	});

	const wb = new ExcelJS.Workbook();
	const ws = wb.addWorksheet('Recipients');

	// Title + meta
	ws.addRow([`${grant.name} (${grant.year}) — Grant Recipients`]);
	ws.mergeCells(1, 1, 1, COLUMNS.length);
	ws.getRow(1).font = { bold: true, size: 14 };

	const released = grant.releasedDate ? new Date(grant.releasedDate).toLocaleDateString() : '—';
	ws.addRow([
		`Released: ${released}   Generated: ${new Date().toLocaleDateString()}   Recipients: ${recipients.length}`
	]);
	ws.mergeCells(2, 1, 2, COLUMNS.length);
	ws.getRow(2).font = { size: 10, color: { argb: 'FF666666' } };

	ws.addRow([]);

	// Header + data
	const headerRow = ws.addRow(COLUMNS);
	headerRow.font = { bold: true };
	headerRow.border = { bottom: { style: 'thin' } };

	recipients.forEach((r, i) => {
		ws.addRow([
			i + 1,
			r.fullName,
			r.barangayName,
			r.cluster,
			r.receivedAt ? new Date(r.receivedAt).toLocaleDateString() : '',
			r.grantedByName
		]);
	});

	WIDTHS.forEach((w, i) => {
		ws.getColumn(i + 1).width = w;
	});

	const safeName = `${grant.name}-${grant.year}`
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '');

	const buffer = await wb.xlsx.writeBuffer();

	return new Response(new Uint8Array(buffer as ArrayBuffer), {
		headers: {
			'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
			'Content-Disposition': `attachment; filename="${safeName}-recipients.xlsx"`
		}
	});
};
