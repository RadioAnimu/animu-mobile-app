import React, { useCallback, useMemo, useState, Fragment } from "react";
import PortalContext, {
  type PortalElement,
} from "@/contexts/Portal/PortalContext";

interface PortalProviderProps {
  children: React.ReactNode;
}
const PortalProvider: React.FC<PortalProviderProps> = ({ children }) => {
  const [components, setComponents] = useState<Record<string, React.ReactNode>>(
    {}
  );

  const addComponent = useCallback(({ name, component }: PortalElement) => {
    setComponents((prev) => ({ ...prev, [name]: component }));
  }, []);

  const removeComponent = useCallback((name: string) => {
    setComponents((prev) => {
      const newComponents = { ...prev };
      delete newComponents[name];
      return newComponents;
    });
  }, []);

  const value = useMemo(
    () => ({ addComponent, removeComponent }),
    [addComponent, removeComponent],
  );

  return (
    <PortalContext.Provider value={value}>
      {children}
      {/* Keyed by slot name: two portals (toast + alert) are always
          registered, so an unkeyed array would warn and key children by
          position instead of identity. */}
      {Object.entries(components).map(([name, node]) => (
        <Fragment key={name}>{node}</Fragment>
      ))}
    </PortalContext.Provider>
  );
};
export default PortalProvider;
