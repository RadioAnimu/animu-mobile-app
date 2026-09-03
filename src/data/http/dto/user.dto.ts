import { z } from "zod";

export const UserDTOSchema = z.object({
  id: z.string(),
  username: z.string(),
  nickname: z.string(),
  avatar: z.string(),
  avatar_url: z.string(),
  PHPSESSID: z.string(),
  mfa: z.coerce.boolean(),
  avatar_decoration_data: z.unknown().optional(),
});

export type UserDTO = z.infer<typeof UserDTOSchema>;
