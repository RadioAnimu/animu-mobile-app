import * as React from "react";

/** One mounted portal slot: the Portal host renders `component` under `name`. */
export interface PortalElement {
  name: string;
  component: React.ReactNode;
}

const PortalContext = React.createContext({
  addComponent: (element: PortalElement) => {},
  removeComponent: (name: string) => {},
});
export default PortalContext;
