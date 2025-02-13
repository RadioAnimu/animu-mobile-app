import React, { useCallback, useEffect, useState } from "react";
import PortalContext from "./PortalContext";
interface PortalProviderProps {
  children: React.ReactNode;
}
interface Element {
  name: string;
  component: React.ReactNode;
}
const PortalProvider: React.FC<PortalProviderProps> = ({ children }) => {
  const [components, setComponents] = useState<Record<string, React.ReactNode>>(
    {}
  );

  const addComponent = useCallback(({ name, component }: Element) => {
    setComponents((prev) => ({ ...prev, [name]: component }));
  }, []);

  const removeComponent = useCallback((name: string) => {
    setComponents((prev) => {
      const newComponents = { ...prev };
      delete newComponents[name];
      return newComponents;
    });
  }, []);

  return (
    <PortalContext.Provider value={{ addComponent, removeComponent }}>
      {children}
      {Object.values(components)}
    </PortalContext.Provider>
  );
};
export default PortalProvider;
