export interface StepLocalizationInput {
  id: string;
  defaultTitle: string;
  titles?: Partial<Record<string, string>>;
  translationKey?: string;
}

interface StepLocalizationEntry extends StepLocalizationInput {}

const FALLBACK_LOCALE = 'en';

const normalizeLocale = (locale?: string | null): string => {
  if (!locale) return FALLBACK_LOCALE;
  const lower = locale.toLowerCase();
  if (lower.startsWith('ja')) return 'ja';
  if (lower.startsWith('en')) return 'en';
  return FALLBACK_LOCALE;
};

class DialogStepLocalizationRegistry {
  private entries = new Map<string, Map<string, StepLocalizationEntry>>();

  register(nodeType: string, input: StepLocalizationInput): void {
    if (!nodeType || !input.id) return;
    const bucket = this.ensureBucket(nodeType);
    bucket.set(input.id, {
      ...bucket.get(input.id),
      ...input,
    });
  }

  registerMany(nodeType: string, steps: StepLocalizationInput[]): void {
    for (const step of steps) {
      this.register(nodeType, step);
    }
  }

  resolveTitle(nodeType: string, stepId: string, locale?: string): string {
    const bucket = this.entries.get(nodeType);
    if (!bucket) return stepId;
    const entry = bucket.get(stepId);
    if (!entry) return stepId;
    const normalized = normalizeLocale(locale ?? this.detectLocale());
    return entry.titles?.[normalized] ?? entry.defaultTitle ?? stepId;
  }

  listTitles(nodeType: string, locale?: string): string[] {
    const bucket = this.entries.get(nodeType);
    if (!bucket) return [];
    const normalized = normalizeLocale(locale ?? this.detectLocale());
    return Array.from(bucket.values()).map(
      (entry) => entry.titles?.[normalized] ?? entry.defaultTitle ?? entry.id
    );
  }

  detectLocale(): string {
    if (typeof navigator !== 'undefined' && navigator.language) {
      return normalizeLocale(navigator.language);
    }
    return FALLBACK_LOCALE;
  }

  private ensureBucket(nodeType: string): Map<string, StepLocalizationEntry> {
    const existing = this.entries.get(nodeType);
    if (existing) return existing;
    const bucket = new Map<string, StepLocalizationEntry>();
    this.entries.set(nodeType, bucket);
    return bucket;
  }
}

export const dialogStepLocalizationRegistry = new DialogStepLocalizationRegistry();
