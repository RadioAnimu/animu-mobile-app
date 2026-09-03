import { z } from "zod";

/**
 * PHP page endpoint — fields may be missing or malformed on the server.
 * Every field degrades to "" instead of failing the whole program fetch.
 */
export const ProgramDTOSchema = z.object({
  locutor: z.string().catch(""),
  programa: z.string().catch(""),
  pedidos_ao_vivo: z.string().catch(""),
  imagem: z.string().catch(""),
  infoPrograma: z.string().catch(""),
  temaPrograma: z.string().catch(""),
});

export type ProgramDTO = z.infer<typeof ProgramDTOSchema>;
