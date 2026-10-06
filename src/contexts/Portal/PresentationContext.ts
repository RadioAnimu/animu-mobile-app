import { createContext } from "react";

/** Native modal inputs may focus only after the window's onShow event. */
export const PresentationReadyContext = createContext(true);
