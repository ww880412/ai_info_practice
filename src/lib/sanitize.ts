/**
 * 数据脱敏工具 - 移除敏感信息
 */

// URL 参数中的敏感字段
const SENSITIVE_PARAMS = [
  'api_key', 'apikey', 'key', 'token', 'access_token', 'auth_token',
  'password', 'pwd', 'secret', 'private_key', 'jwt', 'session_id',
  'sid', 'csrf_token', 'xcsrf', 'refresh_token', 'accessToken',
];

// 敏感模式
const SENSITIVE_PATTERNS: RegExp[] = [
  // API keys (sk- 开头的)
  /sk-[a-zA-Z0-9]{20,}/g,
  // Bearer tokens
  /bearer\s+[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+/gi,
  // Email addresses
  /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
  // Phone numbers (11位)
  /\b\d{11}\b/g,
  // AWS keys
  /(AKIA|ABIA|ACCA|ASIA)[A-Z0-9]{16}/g,
  // Generic API key patterns
  /api[_-]?key["']?\s*[:=]\s*["']?[a-zA-Z0-9_-]{10,}["']?/gi,
];

/**
 * 脱敏 URL 参数
 */
function sanitizeUrlParams(url: string): string {
  let result = url;

  SENSITIVE_PARAMS.forEach(param => {
    const regex = new RegExp(`([?&]${param}=)[^&]*`, 'gi');
    result = result.replace(regex, `$1***`);
  });

  return result;
}

/**
 * 通用字符串脱敏
 */
function sanitizeString(input: string): string {
  let result = input;

  // 应用所有敏感模式
  SENSITIVE_PATTERNS.forEach(pattern => {
    result = result.replace(pattern, '***');
  });

  return result;
}

/**
 * 递归脱敏对象中的字符串
 */
function sanitizeObject(obj: unknown): unknown {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (typeof obj === 'string') {
    return sanitizeString(obj);
  }

  if (typeof obj === 'number' || typeof obj === 'boolean') {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeObject(item));
  }

  if (typeof obj === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      // 检查是否为敏感字段名
      const lowerKey = key.toLowerCase();
      const isSensitiveKey = SENSITIVE_PARAMS.some(p => lowerKey.includes(p));

      if (isSensitiveKey && typeof value === 'string') {
        result[key] = '***';
      } else {
        result[key] = sanitizeObject(value);
      }
    }
    return result;
  }

  return obj;
}

/**
 * 主脱敏函数
 */
export function sanitizeForLogging(data: unknown): string {
  if (data === null || data === undefined) {
    return '';
  }

  // 如果是 URL，先脱敏参数
  if (typeof data === 'string' && (data.startsWith('http://') || data.startsWith('https://'))) {
    try {
      const url = new URL(data);
      const sanitizedPath = sanitizeUrlParams(url.pathname + url.search);
      return `${url.origin}${sanitizedPath}`;
    } catch {
      return sanitizeString(data);
    }
  }

  // 递归脱敏
  const sanitized = sanitizeObject(data);

  return typeof sanitized === 'string' ? sanitized : JSON.stringify(sanitized, null, 2);
}

/**
 * 创建输入摘要（用于日志展示）
 */
export function createInputSummary(input: unknown): string {
  if (!input) return '';

  const sanitized = sanitizeForLogging(input);

  // 限制长度
  if (sanitized.length > 500) {
    return sanitized.substring(0, 500) + '...';
  }

  return sanitized;
}
