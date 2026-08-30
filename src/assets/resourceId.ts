export interface ResourceId {
  namespace: string;
  path: string;
}

export function parseResourceId(id: string, defaultPrefix = ''): ResourceId {
  const clean = id.startsWith('#') ? id.slice(1) : id;
  const colon = clean.indexOf(':');
  if (colon === -1) return { namespace: 'minecraft', path: defaultPrefix + clean };
  return { namespace: clean.slice(0, colon), path: defaultPrefix + clean.slice(colon + 1) };
}

export function blockStatePath(name: string): string {
  const { namespace, path } = parseResourceId(name);
  return `assets/${namespace}/blockstates/${path}.json`;
}

export function modelPath(ref: string): string {
  const { namespace, path } = parseResourceId(ref, '');
  return `assets/${namespace}/models/${path}.json`;
}

export function texturePath(ref: string): string {
  const { namespace, path } = parseResourceId(ref, '');
  return `assets/${namespace}/textures/${path}.png`;
}
