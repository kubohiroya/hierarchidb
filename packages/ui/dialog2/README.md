# @hierarchidb/ui-dialog2

`@hierarchidb/ui-dialog2` はダイアログ周辺の再設計検証のためのプレイグラウンドです。第一段として、複数ステップの内容を切り替えて表示する `MultiSteps` コンポーネントを提供します。

## 提供コンポーネント

### `MultiSteps`
- `steps: MultiStepDefinition[]`
- `activeStepIndex: number`
- `renderHeader?: (info: MultiStepsHeaderRenderProps) => React.ReactNode`

Material UI の `Stepper` を既定で利用しつつ、`renderHeader` を差し替えることで自由にヘッダ UI を構築できます。各ステップは単一の `MultiStepDefinition` オブジェクトで記述し、アクティブなステップのみが DOM に展開されます。

```ts
interface MultiStepComponentProps {
  stepIndex: number;
  stepId?: string;
  label: string;
  isEnabled: boolean;
  isValidated: boolean;
}

interface MultiStepDefinition {
  id?: string;
  label: string;
  component: React.ComponentType<MultiStepComponentProps>;
  enabled?: boolean;
  validated?: boolean;
}

interface MultiStepsHeaderRenderProps {
  steps: readonly MultiStepDefinition[];
  activeStepIndex: number;
}
```

Storybook の `CustomHeader` ストーリーではピル状のヘッダ例を確認できます。

## 開発コマンド

- `pnpm -C packages/ui/dialog2 typecheck`
- `pnpm -C packages/ui/dialog2 build`
- `pnpm -C packages/ui/dialog2 test`

Storybook での動作確認はリポジトリルートから `pnpm storybook` を実行してください。
