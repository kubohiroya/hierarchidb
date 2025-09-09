import { PluginDependencyResolver } from './plugin-dependency-resolver.js';
import type { PluginDefinition, NodeType } from '@hierarchidb/common-type';

console.log('=== 循環依存の動作テスト ===\n');

const circularDefinitions = new Map<NodeType, PluginDefinition>([
  ['a' as NodeType, {
    nodeType: 'a' as NodeType,
    pluginLabel: 'Plugin A',
    dependencies: ['b']
  }],
  ['b' as NodeType, {
    nodeType: 'b' as NodeType,
    pluginLabel: 'Plugin B',
    dependencies: ['c']
  }],
  ['c' as NodeType, {
    nodeType: 'c' as NodeType,
    pluginLabel: 'Plugin C',
    dependencies: ['a']    }]
]);

const resolver = new PluginDependencyResolver();

//  1: checkCircularDependencies()
console.log('パターン1: checkCircularDependencies()メソッドの場合');
console.log('----------------------------------------');
const errors = resolver.checkCircularDependencies(circularDefinitions);
if (errors.length > 0) {
  console.log('✓ 循環依存を検出しました（エラー配列を返す）:');
  errors.forEach(error => console.log(`  - ${error}`));
  console.log('→ プログラムは継続実行可能\n');
} else {
  console.log('✗ 循環依存が検出されませんでした\n');
}

//  2: resolveLoadOrder()
console.log('パターン2: resolveLoadOrder()メソッドの場合');
console.log('----------------------------------------');
try {
  const loadOrder = resolver.resolveLoadOrder(circularDefinitions);
  console.log('✗ エラーがスローされませんでした。読み込み順序:', loadOrder);
} catch (error) {
  console.log('✓ Errorがスローされました:');
  console.log(`  エラーメッセージ: "${error.message}"`);
  console.log('→ プログラムが停止（catch句でキャッチしない限り）\n');
}

console.log('推奨される使用方法:');
console.log('----------------------------------------');
console.log('1. まずcheckCircularDependencies()で事前チェック');
console.log('2. エラーがない場合のみresolveLoadOrder()を実行');
console.log('\n実装例:');
console.log(`
const errors = resolver.checkCircularDependencies(definitions);
if (errors.length > 0) {
  // エラーログを出力して処理を中断
  console.error('依存関係エラー:', errors);
  throw new Error(\`循環依存が検出されました: \${errors.join(', ')}\`);
}

// 循環依存がない場合のみ実行
const loadOrder = resolver.resolveLoadOrder(definitions);
`);