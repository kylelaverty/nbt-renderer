export interface FoundVersion {
  id: string;
  file: File;
}

export interface FoundJar {
  id: string;
  file: File;
}

export interface ScannedInstance {
  versions: FoundVersion[];
  mods: FoundJar[];
  resourcepacks: FoundJar[];
}

function relPath(file: File): string {
  return (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name;
}

/** Scans a FileList from an <input webkitdirectory> pointed at a .minecraft folder. */
export function scanInstanceFiles(files: FileList): ScannedInstance {
  const versions: FoundVersion[] = [];
  const mods: FoundJar[] = [];
  const resourcepacks: FoundJar[] = [];

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const path = relPath(file).replace(/\\/g, '/');
    const segments = path.split('/');

    const versionsIdx = segments.indexOf('versions');
    if (versionsIdx !== -1 && segments.length >= versionsIdx + 3 && file.name.endsWith('.jar')) {
      const versionId = segments[versionsIdx + 1];
      if (segments[versionsIdx + 2] === file.name) {
        versions.push({ id: versionId, file });
        continue;
      }
    }

    const modsIdx = segments.indexOf('mods');
    if (modsIdx !== -1 && file.name.endsWith('.jar')) {
      mods.push({ id: file.name.replace(/\.jar$/, ''), file });
      continue;
    }

    const rpIdx = segments.indexOf('resourcepacks');
    if (rpIdx !== -1 && file.name.endsWith('.zip')) {
      resourcepacks.push({ id: file.name.replace(/\.zip$/, ''), file });
      continue;
    }
  }

  versions.sort((a, b) => a.id.localeCompare(b.id));
  return { versions, mods, resourcepacks };
}
