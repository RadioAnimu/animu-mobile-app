import { Program } from "../../core/domain/program";
import { ProgramDTO } from "../http/dto/program.dto";
import { DICT } from "../../languages";

export class ProgramMapper {
  static fromDTO(dto: ProgramDTO, isReprises: boolean): Program {
    const isLiveProgram =
      !isReprises && dto.locutor.toLowerCase().trim() !== "haruka yuki";

    return {
      name: dto.programa,
      dj: isLiveProgram ? dto.locutor : "Haruka Yuki",
      isLive: isLiveProgram,
      isSaijikkou: isReprises,
      imageUrl: dto.imagem,
      info: dto.infoPrograma,
      theme: dto.temaPrograma,
      acceptingRequests: dto.pedidos_ao_vivo !== "no",
      raw: this.findRawProgram(dto.programa),
    };
  }

  private static findRawProgram(programName: string) {
    return DICT["PT"].PROGRAMS.find(
      (program) => program.name.toLowerCase() === programName.toLowerCase()
    );
  }
}
