const listeners = new Set();

export function subscribeToPermissionChanges(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function publishPermissionChange(change) {
  for (const listener of listeners) listener(change);
}
