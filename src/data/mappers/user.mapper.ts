import { User } from "../../core/domain/user";
import { UserDTO } from "../http/dto/user.dto";

export class UserMapper {
  static fromDTO(dto: UserDTO): User {
    return {
      id: dto.id,
      username: dto.username,
      nickname: dto.nickname,
      avatar: dto.avatar,
      avatarUrl: dto.avatar_url,
      sessionId: dto.PHPSESSID,
      mfa: dto.mfa,
    };
  }
}
