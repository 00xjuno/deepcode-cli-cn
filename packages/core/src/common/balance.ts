// DeepSeek 余额查询工具
// API 文档: https://api-docs.deepseek.com/api/get-user-balance
// GET https://api.deepseek.com/user/balance

export type BalanceInfo = {
  currency: string;
  total_balance: string;
  granted_balance: string;
  topped_up_balance: string;
};

export type BalanceResult = {
  is_available: boolean;
  balance_infos?: BalanceInfo[];
};

let cachedBalance: BalanceResult | null = null;
let cachedBalanceFetchedAt = 0;
// 缓存有效期 5 分钟
const BALANCE_CACHE_TTL_MS = 5 * 60 * 1000;

/**
 * 查询 DeepSeek 账户余额。
 * 结果缓存 5 分钟，避免频繁请求。
 */
export async function fetchBalance(apiKey: string, baseURL?: string): Promise<BalanceResult | null> {
  const now = Date.now();
  if (cachedBalance && now - cachedBalanceFetchedAt < BALANCE_CACHE_TTL_MS) {
    return cachedBalance;
  }

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);

    const url = `${baseURL || "https://api.deepseek.com"}/user/balance`;
    const response = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (!response.ok) {
      return null;
    }

    const data = (await response.json()) as BalanceResult;
    if (!data || typeof data.is_available !== "boolean") {
      return null;
    }

    cachedBalance = data;
    cachedBalanceFetchedAt = now;
    return data;
  } catch {
    return null;
  }
}

/**
 * 格式化余额为可读字符串。
 * 优先返回 CNY 余额，其次 USD。
 */
export function formatBalance(balance: BalanceResult | null): string | null {
  if (!balance?.is_available || !balance.balance_infos?.length) {
    return null;
  }

  const cny = balance.balance_infos.find((b) => b.currency === "CNY");
  const usd = balance.balance_infos.find((b) => b.currency === "USD");
  const info = cny || usd;
  if (!info || !info.total_balance) return null;

  const symbol = info.currency === "CNY" ? "¥" : "$";
  const amount = Number.parseFloat(info.total_balance);
  if (!Number.isFinite(amount)) return null;

  return `${symbol}${amount.toFixed(2)}`;
}

/**
 * 清除缓存（用于 API Key 变更后强制刷新）。
 */
export function clearBalanceCache(): void {
  cachedBalance = null;
  cachedBalanceFetchedAt = 0;
}
