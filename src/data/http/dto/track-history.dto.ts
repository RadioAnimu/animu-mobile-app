import { z } from "zod";

/**
 * PHP endpoints return positional arrays:
 *   [title, time|cover, requestId?, coverUrl?]
 * Row shape varies by endpoint, so trailing elements are a loose union.
 * Rows that aren't arrays of at least two strings are dropped at parse.
 */
export const TrackHistoryItemSchema = z
  .tuple([z.string(), z.string()], z.union([z.string(), z.number()]));

export const TrackHistorySchema = z.array(TrackHistoryItemSchema);

export type TrackHistoryItemDTO = z.infer<typeof TrackHistoryItemSchema>;
export type TrackHistoryDTO = z.infer<typeof TrackHistorySchema>;
