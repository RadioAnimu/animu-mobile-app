/**
 * Drawer re-tap signal.
 *
 * React Navigation has no built-in "the user tapped the item of the screen
 * already on top" event for drawers, so the drawer content emits one here and
 * screens subscribe to scroll themselves to the top (the familiar
 * tap-the-active-tab-again gesture). Kept dependency-free so both the drawer
 * and any screen can import it without cycles.
 */

type ReselectListener = () => void;

const listeners = new Map<string, Set<ReselectListener>>();

/** Notifies every listener registered for `routeName`. */
export const emitReselect = (routeName: string): void => {
  const registered = listeners.get(routeName);
  if (!registered) return;
  for (const listener of registered) listener();
};

/** Subscribes to re-taps of `routeName`'s drawer item; returns the unsubscribe. */
export const onReselect = (
  routeName: string,
  listener: ReselectListener,
): (() => void) => {
  const registered = listeners.get(routeName) ?? new Set<ReselectListener>();
  registered.add(listener);
  listeners.set(routeName, registered);

  return () => {
    registered.delete(listener);
    if (registered.size === 0) listeners.delete(routeName);
  };
};
