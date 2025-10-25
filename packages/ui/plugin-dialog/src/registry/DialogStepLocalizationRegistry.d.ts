export interface StepLocalizationInput {
    id: string;
    defaultTitle: string;
    titles?: Partial<Record<string, string>>;
    translationKey?: string;
}
declare class DialogStepLocalizationRegistry {
    private entries;
    register(nodeType: string, input: StepLocalizationInput): void;
    registerMany(nodeType: string, steps: StepLocalizationInput[]): void;
    resolveTitle(nodeType: string, stepId: string, locale?: string): string;
    listTitles(nodeType: string, locale?: string): string[];
    detectLocale(): string;
    private ensureBucket;
}
export declare const dialogStepLocalizationRegistry: DialogStepLocalizationRegistry;
export {};
//# sourceMappingURL=DialogStepLocalizationRegistry.d.ts.map