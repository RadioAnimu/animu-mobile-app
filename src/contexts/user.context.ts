export interface DiscordUser {
  avatar: string;
  avatar_url: string;
  id: string;
  mfa: boolean;
  username: string;
  nickname: string;
  avatar_decoration_data: any;
  PHPSESSID: string;
}

import { createContext } from "react";

export interface UserContextProps {
  user: DiscordUser | null;
  setUser: (user: DiscordUser | null) => void;
}

export const UserContext: React.Context<UserContextProps | null> =
  createContext<UserContextProps | null>(null);
