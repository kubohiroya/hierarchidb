export function normalizeName(name: string): string {
  return name.normalize('NFC').trim();
}

export function generateUniqueName(baseName: string, existingNames: Set<string>): string {
  const normalizedBase = normalizeName(baseName);

  if (!existingNames.has(normalizedBase)) {
    return normalizedBase;
  }

  let counter = 1;
  let uniqueName: string;

  do {
    uniqueName = `${normalizedBase} (${counter})`;
    counter++;
  } while (existingNames.has(uniqueName));

  return uniqueName;
}
