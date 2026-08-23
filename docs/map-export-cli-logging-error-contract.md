# Map Export CLI Logging and Error Contract

## 目的

本書は、地図画像生成CLIのログ出力、JSON出力、exit code、typed error category/code の初期契約を定義する。人間向けログと機械処理向け結果を分離し、契約違反を warning に落として処理継続しない。

## 出力ストリーム

| Stream | 用途 | 制約 |
| --- | --- | --- |
| stdout | 成功時の機械可読結果。`--json` 指定時は単一 JSON object だけを出力する | progress log、browser console log、人間向け文言を混ぜない |
| stderr | 人間向けログ、progress、diagnostic、non-JSON error summary | `--json` 成功結果を出力しない |
| log file | `--log-file` 指定時の詳細ログ。stderrへ出す内容に加え、browser console/page errorの詳細を保存できる | stdout の JSON result と同一内容の二重SSOTにしない |

`--json` 指定時、stdout は成功時も失敗時も単一 JSON object とする。JSON以外の出力は stderr または log file へ送る。

## CLI options

| Option | 意味 |
| --- | --- |
| `--json` | stdout に single JSON result object を出す |
| `--log-level <level>` | `silent | error | warn | info | debug` のいずれか |
| `--log-file <path>` | 詳細ログの保存先 |

`--log-level` が不正な場合は `manifest` ではなく `cli` category の typed error として失敗する。`silent` でも stdout JSON result は抑制しない。

## 成功JSON

```typescript
type MapExportCliSuccessResult = {
  ok: true;
  version: 1;
  jobs: Array<{
    id: string;
    outputPath: string;
    width: number;
    height: number;
    elapsedMs: number;
  }>;
};
```

## 失敗JSON

```typescript
type MapExportCliErrorResult = {
  ok: false;
  version: 1;
  error: {
    category: MapExportCliErrorCategory;
    code: string;
    message: string;
    jobId?: string;
    path?: string;
    cause?: string;
  };
};
```

`message` は人間が読める短い説明とするが、制御分岐は `category` と `code` を使う。呼び出し側に message 文字列解析を要求しない。

## Error categories

| Category | 例 |
| --- | --- |
| `cli` | option不正、引数不足、log file path不正 |
| `manifest` | parse error、schema violation、unsupported nodeType、unsafe output path |
| `profile` | browser profile作成失敗、profile lock、cache policy violation |
| `browser` | browser起動失敗、page crash、page error、未許可console error |
| `runtime` | runtime-worker初期化失敗、worker command timeout、transport failure |
| `node` | CoreDB node作成/更新失敗、nodeId衝突、nodeType mismatch |
| `build` | canonical build failure、auth-required未解決、session contract violation |
| `render` | MapLibre ready timeout、tile/source未ready、WebGL context loss |
| `output` | screenshot保存失敗、path conflict、write permission error |

## Exit codes

| Exit code | 意味 |
| --- | --- |
| `0` | 全job成功 |
| `1` | CLI option / manifest validation / contract violation |
| `2` | browser startup / profile setup failure |
| `3` | runtime-worker / canonical build failure |
| `4` | render readiness / screenshot capture failure |
| `5` | output write failure |
| `70` | unexpected internal error |

複数job実行時に複数種類の失敗が発生し得る場合、初期版では最初に失敗したjobで実行を停止し、その失敗に対応する exit code を返す。失敗後に後続jobを継続する mode は本契約には含めない。

## Browser error handling

Export page/API は browser console error、page error、request failure、runtime error を収集する。

- 未許可の `console.error` は `browser` category の typed error へ昇格する。
- `console.warn` は既定では stderr/log file に記録するが、成功/失敗判定は後続の allowlist policy に従う。
- page error、unhandled rejection、WebGL context loss は成功扱いにしない。
- browser error を単なる debug log として残して screenshot を成功扱いにしてはならない。

## 契約違反の扱い

- manifest validation、canonical build input、ready signal、output write の契約違反は fail-fast する。
- 不正値を丸め、clamp、default補完、別経路fallbackで継続しない。
- `--json` 失敗時も stdout には structured error object を1つだけ出す。
- stderr/log file に詳細を出しても、stdout JSON の `category` / `code` / `jobId` / `path` が診断の入口として十分でなければならない。

## 後続実装境界

- #1530 の manifest parser error は `manifest` category へ対応付ける。
- #1531 の profile/cache policy error は `profile` category へ対応付ける。
- #1533 の export page/API、ready signal、capture error は `browser` / `runtime` / `build` / `render` / `output` category へ対応付ける。
