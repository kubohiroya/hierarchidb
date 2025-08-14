# Toast通知システム使用例

## 基本的な実装完了

ToastProviderが`providers.tsx`に追加され、アプリケーション全体で利用可能になりました。

## エラーの解決

```
Error: useToast must be used within a ToastProvider
```

このエラーは、ToastProviderがアプリケーションのルートレベルで提供されていなかったため発生していました。
`providers.tsx`に以下を追加して解決：

```tsx
<ToastProvider 
  maxToasts={5}
  defaultConfig={{
    duration: 4000,
    position: {
      vertical: 'bottom',
      horizontal: 'left'
    }
  }}
>
  {/* アプリケーションコンテンツ */}
</ToastProvider>
```

## BaseMapDialogでの使用例

```tsx
// BaseMapDialog内で
const { showToast } = useToast();

// 成功時
showToast({
  message: 'BaseMapが正常に保存されました',
  severity: 'success',
  duration: 5000
});

// エラー時
showToast({
  message: 'エラーが発生しました',
  severity: 'error',
  duration: 8000
});
```

## LinkButtonとの統合

```tsx
<LinkButton
  onSave={async () => {
    await saveBaseMap();
  }}
  successToast={{
    message: 'BaseMapを保存しました',
    severity: 'success',
    action: {
      label: '表示',
      onClick: () => navigate('/maps')
    }
  }}
  errorToast={{
    message: 'BaseMapの保存に失敗しました',
    severity: 'error',
    duration: 8000
  }}
  onToast={(config) => showToast(config)}
>
  保存
</LinkButton>
```

## 非表示設定

```tsx
// 条件に応じてトーストを非表示
showToast({
  enabled: userPreferences.showNotifications, // false なら表示されない
  message: '通知メッセージ',
  severity: 'info'
});
```

## カスタムコンテンツ

```tsx
showToast({
  message: (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
      <MapIcon />
      <div>
        <Typography variant="subtitle2">BaseMap保存完了</Typography>
        <Typography variant="body2" color="text.secondary">
          {baseMapName}が正常に保存されました
        </Typography>
      </div>
    </Box>
  ),
  severity: 'success',
  duration: 6000
});
```