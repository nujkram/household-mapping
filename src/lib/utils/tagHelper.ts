export type HouseholdTag = 'APIN' | 'KONTRA' | 'UNTAGGED';

export const TAG_VALUES: HouseholdTag[] = ['APIN', 'KONTRA', 'UNTAGGED'];

type TagConfig = {
	label: HouseholdTag;
	color: string;
	swatchClass: string;
	/** Chart variant, validated for the dark card surface (#1f2937): lightness
	 * band + chroma + CVD separation + contrast. UNTAGGED is an intentional
	 * neutral — charts must pair it with direct labels/gaps, never color alone. */
	chartColor: string;
};

const TAG_CONFIG: Record<HouseholdTag, TagConfig> = {
	APIN: { label: 'APIN', color: '#4CAF50', swatchClass: 'bg-green-500', chartColor: '#43A047' },
	KONTRA: { label: 'KONTRA', color: '#F44336', swatchClass: 'bg-red-500', chartColor: '#F44336' },
	UNTAGGED: {
		label: 'UNTAGGED',
		color: '#9E9E9E',
		swatchClass: 'bg-gray-500',
		chartColor: '#9CA3AF'
	}
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
