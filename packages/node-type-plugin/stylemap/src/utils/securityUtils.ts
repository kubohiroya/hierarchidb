/**
 * @file securityUtils.ts
 * @description セキュリティ関連のユーティリティ関数
 * 【機能概要】: URL検証、IP検証、コンテンツ検証のセキュリティ機能
 * 【改善内容】: SSRF攻撃防止、プライベートネットワークアクセス制限
 * 【設計方針】: ホワイトリスト方式による厳格なセキュリティ検証
 * 🟢 信頼性レベル: セキュリティベストプラクティスに基づく実装
 */

/**
 * 【機能概要】: ダウンロードURL の厳密なセキュリティ検証
 * 【改善内容】: SSRF攻撃とローカルファイルアクセスを防止する包括的な検証
 * 【設計方針】: ホワイトリスト方式によるセキュアな URL 検証
 * 【セキュリティ対策】: プライベートネットワーク、ローカルホスト、危険なプロトコルを排除
 * 🟢 信頼性レベル: セキュリティベストプラクティスに基づく確実な実装
 * @param url - 検証対象のURL文字列
 * @throws Error - URLが安全でない場合にセキュリティエラーをスロー
 */
export function validateDownloadUrl(url: string): void {
  // 【基本検証】: 空文字・null・undefinedの早期検出
  if (!url || typeof url !== 'string' || url.trim().length === 0) {
    throw new Error('URL is required and must be a non-empty string');
  }

  // 【長さ制限】: 異常に長いURLによるメモリ攻撃を防止
  if (url.length > 2048) {
    throw new Error('URL too long (maximum 2048 characters)');
  }

  let parsedUrl: URL;
  try {
    // 【URL解析】: 正規のURL形式かどうかを厳密に検証
    parsedUrl = new URL(url);
  } catch (error) {
    throw new Error('Invalid URL format');
  }

  // 【プロトコル制限】: HTTP/HTTPS以外のプロトコルを拒否
  const allowedProtocols = ['http:', 'https:'];
  if (!allowedProtocols.includes(parsedUrl.protocol)) {
    throw new Error(`Unsupported protocol: ${parsedUrl.protocol}. Only HTTP and HTTPS are allowed`);
  }

  // 【プライベートネットワーク検証】: 内部ネットワークへのアクセスを防止
  const hostname = parsedUrl.hostname.toLowerCase();
  
  // 【ローカルホスト検証】: localhost、127.0.0.1等のローカルアクセスを拒否
  const localHostnames = [
    'localhost',
    '127.0.0.1', 
    '::1',
    '0.0.0.0',
    'internal',
    'local'
  ];
  if (localHostnames.includes(hostname)) {
    throw new Error('Access to localhost/internal networks is not allowed');
  }

  // 【プライベートIP検証】: RFC1918プライベートIPアドレスを拒否
  if (isPrivateIP(hostname)) {
    throw new Error('Access to private IP addresses is not allowed');
  }

  // 【ポート制限】: 標準以外のポートへのアクセス制限
  const port = parsedUrl.port;
  if (port && port !== '80' && port !== '443') {
    const allowedPorts = ['8080', '8443', '3000']; // 開発用ポートを一部許可
    if (!allowedPorts.includes(port)) {
      throw new Error(`Port ${port} is not allowed`);
    }
  }

  // 【パス検証】: 危険なパスパターンを検出
  const pathname = parsedUrl.pathname;
  const dangerousPatterns = [
    '../',     // ディレクトリトラバーサル
    '..\\\\',   // Windowsパストラバーサル
    '//',      // ダブルスラッシュによる迂回
    'file:',   // ファイルプロトコル
    'data:',   // データURLスキーム
  ];
  
  for (const pattern of dangerousPatterns) {
    if (pathname.includes(pattern)) {
      throw new Error(`Dangerous path pattern detected: ${pattern}`);
    }
  }
}

/**
 * 【機能概要】: IPアドレスがプライベート範囲かどうかを判定
 * 【実装方針】: RFC1918に基づくプライベートIP範囲の厳密なチェック
 * 【セキュリティ対策】: 内部ネットワークへの不正アクセスを防止
 * 🟢 信頼性レベル: 標準的なネットワークセキュリティパターン
 * @param hostname - 検証対象のホスト名またはIPアドレス
 * @returns boolean - プライベートIPの場合true
 */
export function isPrivateIP(hostname: string): boolean {
  // 【IPv4検証】: プライベートIPアドレス範囲のチェック
  const ipv4Regex = /^(\\d{1,3})\\.(\\d{1,3})\\.(\\d{1,3})\\.(\\d{1,3})$/;
  const match = hostname.match(ipv4Regex);
  
  if (match) {
    const [, a, b, c, d] = match.map(Number);
    
    // 【有効性チェック】: 各オクテットが0-255の範囲内かチェック
    if (a > 255 || b > 255 || c > 255 || d > 255) {
      return false;
    }
    
    // 【プライベート範囲判定】: RFC1918プライベートアドレス範囲
    return (
      (a === 10) ||                           // 10.0.0.0/8
      (a === 172 && b >= 16 && b <= 31) ||   // 172.16.0.0/12
      (a === 192 && b === 168) ||            // 192.168.0.0/16
      (a === 169 && b === 254) ||            // 169.254.0.0/16 (リンクローカル)
      (a === 127)                            // 127.0.0.0/8 (ループバック)
    );
  }

  // 【IPv6プライベート検証】: 基本的なIPv6プライベート範囲
  if (hostname.includes(':')) {
    const ipv6PrivatePatterns = [
      /^fc00::/,  // Unique Local Address
      /^fd00::/,  // Unique Local Address  
      /^fe80::/,  // Link Local Address
      /^::1$/,    // Localhost
    ];
    
    return ipv6PrivatePatterns.some(pattern => pattern.test(hostname));
  }
  
  return false;
}

/**
 * 【機能概要】: CSVセル値の安全性検証（CSVインジェクション対策）
 * 【改善内容】: 数式インジェクション攻撃を防止する値の検証
 * 【セキュリティ対策】: Excel等での自動実行される危険な文字を検出
 * 🟢 信頼性レベル: CSVセキュリティのベストプラクティス
 * @param value - 検証対象のセル値
 * @returns boolean - 安全な値の場合true
 */
export function validateCsvCellValue(value: string): boolean {
  if (!value || typeof value !== 'string') {
    return true; // 空値は安全
  }

  // 【数式インジェクション防止】: 危険な開始文字を検出
  const dangerousPrefixes = ['=', '+', '-', '@', '\\t', '\\r'];
  const trimmedValue = value.trim();
  
  if (dangerousPrefixes.some(prefix => trimmedValue.startsWith(prefix))) {
    return false;
  }

  // 【コマンドインジェクション防止】: システムコマンドらしき文字列を検出
  const dangerousPatterns = [
    /cmd\\.exe/i,
    /powershell/i,
    /javascript:/i,
    /<script/i,
    /vbscript:/i,
  ];

  return !dangerousPatterns.some(pattern => pattern.test(value));
}

/**
 * 【機能概要】: CSVセル値の安全化処理
 * 【改善内容】: 危険なセル値を安全な形式に変換
 * 【実装方針】: プレフィックス除去によるサニタイズ処理
 * 🟡 信頼性レベル: 基本的なサニタイズ、完全なセキュリティは保証しない
 * @param value - サニタイズ対象のセル値
 * @returns string - 安全化されたセル値
 */
export function sanitizeCsvCellValue(value: string): string {
  if (!value || typeof value !== 'string') {
    return value;
  }

  let sanitized = value.trim();
  
  // 【数式インジェクション防止】: 危険な開始パターンをより精密に検出
  // 【改善内容】: 正当な負数を除外し、数式のみを対象とする
  if (sanitized.startsWith('=') || 
      sanitized.startsWith('+') || 
      sanitized.startsWith('@')) {
    sanitized = "'" + sanitized; // シングルクォートでエスケープ
  } else if (sanitized.startsWith('-')) {
    // 【負数判定】: 負数か数式かを区別
    // 負数: -123, -123.456, -1.23e-10 等
    // 数式: -SUM(A1:A10), -COMMAND() 等
    const isNegativeNumber = /^-(\d+\.?\d*([eE][+-]?\d+)?|\.\d+([eE][+-]?\d+)?)$/.test(sanitized);
    
    if (!isNegativeNumber) {
      // 負数ではない場合（数式の可能性）のみエスケープ
      sanitized = "'" + sanitized;
    }
  }

  return sanitized;
}