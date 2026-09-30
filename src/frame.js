// The frame. 16:9 at 1920x1080 by default. `?portrait` renders 9:16 at 1080x1920 for phones: made for the creator's X clip (9/28),
// so only the drop and the AltMan are laid out for it (a wider view, the buildings' answer in four rows above and below
// him, the HUD); every other shot was designed for 16:9 and is not.
export const PORTRAIT = new URLSearchParams(location.search).has("portrait");
export const W = PORTRAIT ? 1080 : 1920, H = PORTRAIT ? 1920 : 1080;
