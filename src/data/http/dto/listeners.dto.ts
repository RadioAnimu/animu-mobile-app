import { z } from "zod";

/**
 * Listener count field name varies between endpoints/versions —
 * all known aliases are accepted and coerced (API has sent strings).
 */
export const ListenersDTOSchema = z.object({
  listeners: z.coerce.number().optional(),
  currentListeners: z.coerce.number().optional(),
  active_listeners: z.coerce.number().optional(),
  total: z.coerce.number().optional(),
});

export type ListenersDTO = z.infer<typeof ListenersDTOSchema>;
