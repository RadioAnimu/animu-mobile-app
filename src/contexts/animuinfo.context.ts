import { createContext } from "react";
import { AnimuInfoProps } from "../api";

export interface AnimuInfoContextProps {
  animuInfo: AnimuInfoProps | null;
  setAnimuInfo: (animuInfo: AnimuInfoProps | null) => void;
}

export const AnimuInfoContext: React.Context<AnimuInfoContextProps | null> =
  createContext<AnimuInfoContextProps | null>(null);
