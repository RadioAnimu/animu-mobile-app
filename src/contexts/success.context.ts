import { createContext } from "react";

export interface SuccessContextProps {
  successMessage: string;
  setSuccessMessage: (errorMessage: string) => void;
}

export const SuccessContext: React.Context<SuccessContextProps> =
  createContext<SuccessContextProps>({} as SuccessContextProps);
