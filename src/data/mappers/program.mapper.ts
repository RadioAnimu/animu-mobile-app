import { Program } from "../../core/domain/program";
import { ProgramDTO } from "../http/dto/program.dto";
import { DICT } from "../../languages";

export class ProgramMapper {
  static fromDTO(dto: ProgramDTO): Program {
    const locutorValue = dto?.locutor?.toLowerCase().trim();
    const isLiveProgram =
      !!locutorValue &&
      locutorValue !== "haruka yuki" &&
      locutorValue !== "haru";
    const rawProgram = this.findRawProgram(dto.programa);

    const result = {
      name: dto.programa,
      dj: isLiveProgram ? dto.locutor : "Haruka Yuki",
      isLive: isLiveProgram,
      imageUrl: dto.imagem,
      info: dto.infoPrograma,
      theme: dto.temaPrograma,
      acceptingRequests: dto.pedidos_ao_vivo !== "no",
      raw: rawProgram,
    };

    return result;
  }

  private static findRawProgram(programName: string) {
    if (!programName) {
      console.log(
        "[ProgramMapper.findRawProgram] programName is falsy, returning undefined",
      );
      return undefined;
    }

    const programNameLower = programName.toLowerCase();

    const result = DICT["PT"].PROGRAMS.find(
      (program) => program.name.toLowerCase() === programNameLower,
    );

    return result;
  }
}
