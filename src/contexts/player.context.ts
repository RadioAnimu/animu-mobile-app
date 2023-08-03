import { createContext } from "react";
import { MyPlayerProps, myPlayer } from "../utils";

export type PlayerProviderType = {
  player: MyPlayerProps;
  setPlayer: React.Dispatch<React.SetStateAction<MyPlayerProps>>;
};

export const PlayerContext = createContext<PlayerProviderType | undefined>(
  undefined
);
