export type HouseholdTag = 'APIN' | 'KONTRA' | 'UNTAGGED';

export const TAG_VALUES: HouseholdTag[] = ['APIN', 'KONTRA', 'UNTAGGED'];

type TagConfig = {
	label: HouseholdTag;
	color: string;
	swatchClass: string;
};

const TAG_CONFIG: Record<HouseholdTag, TagConfig> = {
	APIN: { label: 'APIN', color: '#4CAF50', swatchClass: 'bg-green-500' },
	KONTRA: { label: 'KONTRA', color: '#F44336', swatchClass: 'bg-red-500' },
	UNTAGGED: { label: 'UNTAGGED', color: '#9E9E9E', swatchClass: 'bg-gray-500' }
};

/** Normalize any tag-ish value to a known tag, defaulting to UNTAGGED. */
export const normalizeTag = (tag: string | null | undefined): HouseholdTag => {
	const upper = tag?.toUpperCase();
	if (upper === 'APIN' || upper === 'KONTRA') return upper;
	return 'UNTAGGED';
};

export const getTagColor = (tag: string | null | undefined): string =>
	TAG_CONFIG[normalizeTag(tag)].color;

export const getTagConfig = (tag: string | null | undefined): TagConfig =>
	TAG_CONFIG[normalizeTag(tag)];

export const TAG_LEGEND: TagConfig[] = TAG_VALUES.map((t) => TAG_CONFIG[t]);
