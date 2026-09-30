import * as React from "react";

/** One mounted portal slot: the Portal host renders `component` under `name`. */
export interface PortalElement {
  name: string;
  component: React.ReactNode;
}

interface PortalContextValue {
  addComponent: (element: PortalElement) => void;
  removeComponent: (name: string) => void;
}

const PortalContext = React.createContext<PortalContextValue>({
  addComponent: () => {},
  removeComponent: () => {},
});
export default PortalContext;
