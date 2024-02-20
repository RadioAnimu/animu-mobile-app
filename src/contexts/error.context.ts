import { createContext } from "react";

export interface ErrorContextProps {
  errorMessage: string;
  setErrorMessage: (errorMessage: string) => void;
}

export const ErrorContext: React.Context<ErrorContextProps> =
  createContext<ErrorContextProps>({} as ErrorContextProps);
