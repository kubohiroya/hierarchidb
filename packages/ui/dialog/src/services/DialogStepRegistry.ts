/**
 * @file DialogStepRegistry.ts
 * @description ダイアログステップの登録と管理
 */

// Local type definitions until common-type exports are fixed
export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings?: string[];
}

export interface DialogStepDefinition {
  stepNumber: number;
  title: string;
  description?: string;
  component: React.ComponentType<any>;
  validation?: {
    validate: (data: any) => Promise<ValidationResult> | ValidationResult;
  };
  dependsOn?: number[];
  isOptional?: boolean;
}

// ============================================================================
// 型定義
// ============================================================================

/**
 * ステップ登録情報
 */
export interface StepRegistration {
  /** プラグイン名 */
  pluginName: string;
  /** ステップ定義 */
  definition: DialogStepDefinition;
  /** 登録日時 */
  registeredAt: number;
  /** 優先度 */
  priority?: number;
}

/**
 * ステップ依存関係
 */
export interface StepDependency {
  /** ステップ番号 */
  stepNumber: number;
  /** 依存先ステップ番号 */
  dependsOn: number[];
  /** 必須か */
  required: boolean;
}

/**
 * レジストリオプション
 */
export interface RegistryOptions {
  /** 重複登録を許可するか */
  allowDuplicates?: boolean;
  /** 自動ソートするか */
  autoSort?: boolean;
  /** 循環依存チェックをするか */
  checkCircularDependencies?: boolean;
}

// ============================================================================
// DialogStepRegistry クラス
// ============================================================================

/**
 * ダイアログステップレジストリ
 */
export class DialogStepRegistry {
  private static instance: DialogStepRegistry;
  private registrations: Map<string, StepRegistration[]> = new Map();
  private options: RegistryOptions;

  private constructor(options: RegistryOptions = {}) {
    this.options = {
      allowDuplicates: false,
      autoSort: true,
      checkCircularDependencies: true,
      ...options,
    };
  }

  /**
   * シングルトンインスタンス取得
   */
  public static getInstance(options?: RegistryOptions): DialogStepRegistry {
    if (!DialogStepRegistry.instance) {
      DialogStepRegistry.instance = new DialogStepRegistry(options);
    }
    return DialogStepRegistry.instance;
  }

  /**
   * ステップを登録
   */
  public registerStep(
    pluginName: string,
    definition: DialogStepDefinition,
    priority?: number
  ): void {
    const registration: StepRegistration = {
      pluginName,
      definition,
      registeredAt: Date.now(),
      priority,
    };

    if (!this.registrations.has(pluginName)) {
      this.registrations.set(pluginName, []);
    }

    const steps = this.registrations.get(pluginName)!;

    // 重複チェック
    if (!this.options.allowDuplicates) {
      const exists = steps.some((s) => s.definition.stepNumber === definition.stepNumber);
      if (exists) {
        throw new Error(
          `Step ${definition.stepNumber} is already registered for plugin ${pluginName}`
        );
      }
    }

    steps.push(registration);

    // 自動ソート
    if (this.options.autoSort) {
      steps.sort((a, b) => a.definition.stepNumber - b.definition.stepNumber);
    }

    // 循環依存チェック
    if (this.options.checkCircularDependencies && definition.dependsOn) {
      this.checkCircularDependencies(pluginName, definition.stepNumber);
    }
  }

  /**
   * 複数ステップを一括登録
   */
  public registerSteps(
    pluginName: string,
    definitions: DialogStepDefinition[],
    priority?: number
  ): void {
    definitions.forEach((def) => {
      this.registerStep(pluginName, def, priority);
    });
  }

  /**
   * ステップを取得
   */
  public getStep(pluginName: string, stepNumber: number): DialogStepDefinition | undefined {
    const steps = this.registrations.get(pluginName);
    if (!steps) return undefined;

    const registration = steps.find((s) => s.definition.stepNumber === stepNumber);
    return registration?.definition;
  }

  /**
   * プラグインの全ステップを取得
   */
  public getSteps(pluginName: string): DialogStepDefinition[] {
    const steps = this.registrations.get(pluginName);
    if (!steps) return [];

    return steps.map((s) => s.definition);
  }

  /**
   * プラグインをマージして統合ステップリストを取得
   */
  public getMergedSteps(basePlugin: string, ...extendedPlugins: string[]): DialogStepDefinition[] {
    const stepMap = new Map<number, DialogStepDefinition>();

    // 基底プラグインのステップ
    const baseSteps = this.getSteps(basePlugin);
    baseSteps.forEach((step) => {
      stepMap.set(step.stepNumber, step);
    });

    // 拡張プラグインのステップ（オーバーライド可能）
    for (const plugin of extendedPlugins) {
      const steps = this.getSteps(plugin);
      steps.forEach((step) => {
        stepMap.set(step.stepNumber, step);
      });
    }

    // マップから配列に変換してソート
    return Array.from(stepMap.values()).sort((a, b) => a.stepNumber - b.stepNumber);
  }

  /**
   * ステップを削除
   */
  public unregisterStep(pluginName: string, stepNumber: number): boolean {
    const steps = this.registrations.get(pluginName);
    if (!steps) return false;

    const index = steps.findIndex((s) => s.definition.stepNumber === stepNumber);
    if (index === -1) return false;

    steps.splice(index, 1);

    if (steps.length === 0) {
      this.registrations.delete(pluginName);
    }

    return true;
  }

  /**
   * プラグインの全ステップを削除
   */
  public unregisterPlugin(pluginName: string): boolean {
    return this.registrations.delete(pluginName);
  }

  /**
   * 依存関係を検証
   */
  public validateDependencies(pluginName: string): ValidationResult {
    const steps = this.getSteps(pluginName);
    const stepNumbers = new Set(steps.map((s) => s.stepNumber));
    const errors: string[] = [];

    for (const step of steps) {
      if (step.dependsOn) {
        for (const dep of step.dependsOn) {
          if (!stepNumbers.has(dep)) {
            errors.push(`Step ${step.stepNumber} depends on non-existent step ${dep}`);
          }
          if (dep >= step.stepNumber) {
            errors.push(`Step ${step.stepNumber} cannot depend on later step ${dep}`);
          }
        }
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * 循環依存をチェック
   */
  private checkCircularDependencies(pluginName: string, stepNumber: number): void {
    const visited = new Set<number>();
    const recursionStack = new Set<number>();

    const hasCycle = (currentStep: number): boolean => {
      visited.add(currentStep);
      recursionStack.add(currentStep);

      const step = this.getStep(pluginName, currentStep);
      if (step?.dependsOn) {
        for (const dep of step.dependsOn) {
          if (!visited.has(dep)) {
            if (hasCycle(dep)) return true;
          } else if (recursionStack.has(dep)) {
            return true;
          }
        }
      }

      recursionStack.delete(currentStep);
      return false;
    };

    if (hasCycle(stepNumber)) {
      throw new Error(`Circular dependency detected for step ${stepNumber}`);
    }
  }

  /**
   * ステップの実行順序を取得（依存関係を考慮）
   */
  public getExecutionOrder(pluginName: string): number[] {
    const steps = this.getSteps(pluginName);
    const visited = new Set<number>();
    const order: number[] = [];

    const visit = (stepNumber: number) => {
      if (visited.has(stepNumber)) return;

      const step = steps.find((s) => s.stepNumber === stepNumber);
      if (step?.dependsOn) {
        step.dependsOn.forEach((dep: number) => visit(dep));
      }

      visited.add(stepNumber);
      order.push(stepNumber);
    };

    steps.forEach((step) => visit(step.stepNumber));

    return order;
  }

  /**
   * ステップ結果を集約
   */
  public async aggregateResults(
    pluginName: string,
    stepData: Map<number, Record<string, unknown>>
  ): Promise<Record<string, unknown>> {
    let aggregated: Record<string, unknown> = {};

    // 実行順序に従って集約
    const order = this.getExecutionOrder(pluginName);
    for (const stepNumber of order) {
      const data = stepData.get(stepNumber);
      if (data) {
        aggregated = { ...aggregated, ...data };
      }
    }

    return aggregated;
  }

  /**
   * バリデーションチェーンを実行
   */
  public async runValidationChain(
    pluginName: string,
    stepData: Map<number, Record<string, unknown>>
  ): Promise<Map<number, ValidationResult>> {
    const steps = this.getSteps(pluginName);
    const results = new Map<number, ValidationResult>();

    for (const step of steps) {
      if (step.validation) {
        const data = stepData.get(step.stepNumber) || {};
        const result = await step.validation.validate(data);
        results.set(step.stepNumber, result);

        // エラーがあれば後続のステップはスキップ（オプション）
        if (!result.isValid && step.dependsOn) {
          // 依存するステップもスキップ
          const dependentSteps = steps.filter((s) => s.dependsOn?.includes(step.stepNumber));
          dependentSteps.forEach((s) => {
            results.set(s.stepNumber, {
              isValid: false,
              errors: [`Skipped due to error in step ${step.stepNumber}`],
            });
          });
        }
      }
    }

    return results;
  }

  /**
   * レジストリをクリア
   */
  public clear(): void {
    this.registrations.clear();
  }

  /**
   * 登録情報を取得
   */
  public getRegistrationInfo(): Map<string, StepRegistration[]> {
    return new Map(this.registrations);
  }

  /**
   * 統計情報を取得
   */
  public getStatistics(): {
    totalPlugins: number;
    totalSteps: number;
    pluginStats: Map<string, number>;
  } {
    const pluginStats = new Map<string, number>();
    let totalSteps = 0;

    this.registrations.forEach((steps, plugin) => {
      pluginStats.set(plugin, steps.length);
      totalSteps += steps.length;
    });

    return {
      totalPlugins: this.registrations.size,
      totalSteps,
      pluginStats,
    };
  }
}

// デフォルトインスタンスをエクスポート
export const stepRegistry = DialogStepRegistry.getInstance();
