/**
 * Return a debounced version of `fn` that only fires after `delay` ms of
 * silence. Used to keep search inputs from re-filtering large tables (or
 * rebuilding map markers) on every keystroke.
 */
export const debounce = <Args extends unknown[]>(
	fn: (...args: Args) => void,
	delay = 250
): ((...args: Args) => void) => {
	let timer: ReturnType<typeof setTimeout>;
	return (...args: Args) => {
		clearTimeout(timer);
		timer = setTimeout(() => fn(...args), delay);
	};
};
