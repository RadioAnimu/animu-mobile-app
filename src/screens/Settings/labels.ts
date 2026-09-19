/** Labels carry a trailing colon for back-compat — row UI renders clean. */
export const cleanLabel = (label: string) => label.replace(/[:：]\s*$/, "");
