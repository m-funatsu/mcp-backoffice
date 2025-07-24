# AI-OS API レート制限ガイド
## 使用量管理とベストプラクティス

**バージョン**: 1.0.0  
**最終更新日**: 2025年7月21日

---

## 📊 概要

AI-OS APIは、システムの安定性とフェアな利用を確保するため、レート制限を実装しています。本ガイドでは、レート制限の仕組み、プラン別の制限、使用量の管理方法について説明します。

### レート制限の目的
- **システム保護**: 過度な負荷からシステムを保護
- **フェアユース**: すべてのユーザーに公平なリソース配分
- **品質保証**: 一貫したパフォーマンスの維持
- **悪用防止**: API の不正使用やDDoS攻撃の防止

---

## 🎯 プラン別制限

### 制限一覧

| プラン | 時間あたり | 日次上限 | 月次上限 | 同時接続数 | ブロック時間 |
|--------|------------|----------|----------|------------|--------------|
| **Free** | 100 | 2,400 | 72,000 | 5 | 1時間 |
| **Starter** | 1,000 | 24,000 | 720,000 | 20 | 5分 |
| **Professional** | 5,000 | 120,000 | 3,600,000 | 100 | 1分 |
| **Enterprise** | 50,000 | 1,200,000 | 36,000,000 | 無制限 | なし（ソフトリミット） |

### エンドポイント別の重み

異なるエンドポイントは、リソース消費量に応じて異なる重みを持ちます：

| エンドポイント | メソッド | 重み | 説明 |
|---------------|----------|------|------|
| `/employees` | GET | 1 | 従業員一覧取得 |
| `/employees` | POST | 2 | 従業員作成 |
| `/time-records` | GET | 1 | 勤怠記録取得 |
| `/payroll/calculate` | POST | 10 | 給与計算実行 |
| `/reports/generate` | POST | 5 | レポート生成 |
| `/ai/analyze` | POST | 20 | AI分析実行 |

---

## 🔧 レート制限の仕組み

### HTTPヘッダー

すべてのAPIレスポンスには、以下のレート制限情報が含まれます：

```http
X-RateLimit-Limit: 1000        # 時間あたりの制限
X-RateLimit-Remaining: 950     # 残りリクエスト数
X-RateLimit-Reset: 2025-07-21T15:00:00Z  # リセット時刻
X-RateLimit-Policy: starter     # 適用されているプラン
```

### レート制限超過時のレスポンス

```http
HTTP/1.1 429 Too Many Requests
Content-Type: application/json
Retry-After: 300

{
  "error": "Rate limit exceeded",
  "code": "RATE_LIMIT_EXCEEDED",
  "retryAfter": 300,
  "limit": 1000,
  "remaining": 0,
  "reset": "2025-07-21T15:00:00Z"
}
```

---

## 💻 実装例

### JavaScript/TypeScript

```typescript
import axios from 'axios';

class APIClient {
  private baseURL = 'https://api.ai-os.com';
  private apiKey: string;
  private rateLimitInfo = {
    limit: 0,
    remaining: 0,
    reset: new Date()
  };

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async request(endpoint: string, options: any = {}) {
    try {
      const response = await axios({
        ...options,
        url: `${this.baseURL}${endpoint}`,
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          ...options.headers
        }
      });

      // レート制限情報を更新
      this.updateRateLimitInfo(response.headers);

      return response.data;
    } catch (error) {
      if (error.response?.status === 429) {
        return this.handleRateLimit(error.response);
      }
      throw error;
    }
  }

  private updateRateLimitInfo(headers: any) {
    this.rateLimitInfo = {
      limit: parseInt(headers['x-ratelimit-limit'] || '0'),
      remaining: parseInt(headers['x-ratelimit-remaining'] || '0'),
      reset: new Date(headers['x-ratelimit-reset'])
    };
  }

  private async handleRateLimit(response: any) {
    const retryAfter = parseInt(response.headers['retry-after'] || '60');
    console.log(`Rate limit exceeded. Retrying after ${retryAfter} seconds...`);
    
    // 指数バックオフで再試行
    await this.sleep(retryAfter * 1000);
    
    // 元のリクエストを再実行
    return this.request(response.config.url.replace(this.baseURL, ''), {
      method: response.config.method,
      data: response.config.data
    });
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // 使用量を確認
  getRateLimitInfo() {
    return this.rateLimitInfo;
  }

  // リクエスト前に制限をチェック
  canMakeRequest(): boolean {
    return this.rateLimitInfo.remaining > 0 || 
           new Date() > this.rateLimitInfo.reset;
  }
}

// 使用例
const client = new APIClient('your-api-key');

// リクエスト前にチェック
if (client.canMakeRequest()) {
  const employees = await client.request('/api/v1/employees');
  console.log('Remaining requests:', client.getRateLimitInfo().remaining);
}
```

### Python

```python
import requests
import time
from datetime import datetime
from typing import Optional, Dict, Any

class AIOSAPIClient:
    def __init__(self, api_key: str):
        self.api_key = api_key
        self.base_url = "https://api.ai-os.com"
        self.session = requests.Session()
        self.session.headers.update({
            "Authorization": f"Bearer {api_key}"
        })
        self.rate_limit_info = {
            "limit": 0,
            "remaining": 0,
            "reset": datetime.now()
        }
    
    def request(self, method: str, endpoint: str, **kwargs) -> Dict[str, Any]:
        """APIリクエストを実行（自動リトライ付き）"""
        url = f"{self.base_url}{endpoint}"
        
        try:
            response = self.session.request(method, url, **kwargs)
            
            # レート制限情報を更新
            self._update_rate_limit_info(response.headers)
            
            response.raise_for_status()
            return response.json()
            
        except requests.exceptions.HTTPError as e:
            if e.response.status_code == 429:
                return self._handle_rate_limit(e.response, method, endpoint, **kwargs)
            raise
    
    def _update_rate_limit_info(self, headers: Dict[str, str]):
        """レート制限情報を更新"""
        self.rate_limit_info = {
            "limit": int(headers.get("X-RateLimit-Limit", 0)),
            "remaining": int(headers.get("X-RateLimit-Remaining", 0)),
            "reset": datetime.fromisoformat(
                headers.get("X-RateLimit-Reset", datetime.now().isoformat())
            )
        }
    
    def _handle_rate_limit(self, response, method: str, endpoint: str, **kwargs):
        """レート制限エラーを処理"""
        retry_after = int(response.headers.get("Retry-After", 60))
        print(f"Rate limit exceeded. Waiting {retry_after} seconds...")
        
        time.sleep(retry_after)
        
        # リトライ
        return self.request(method, endpoint, **kwargs)
    
    def get_usage_stats(self) -> Dict[str, Any]:
        """現在の使用量統計を取得"""
        return self.request("GET", "/api/v1/usage/current")
    
    def should_throttle(self, threshold: float = 0.8) -> bool:
        """リクエストを抑制すべきか判断"""
        if self.rate_limit_info["limit"] == 0:
            return False
        
        usage_ratio = 1 - (self.rate_limit_info["remaining"] / 
                          self.rate_limit_info["limit"])
        return usage_ratio > threshold

# 使用例
client = AIOSAPIClient("your-api-key")

# スロットリング付きリクエスト
if not client.should_throttle(0.8):  # 80%使用したら抑制
    employees = client.request("GET", "/api/v1/employees")
else:
    print("Approaching rate limit, throttling requests...")
    time.sleep(1)  # 意図的に遅延

# 使用量統計を確認
usage = client.get_usage_stats()
print(f"Daily usage: {usage['current']['daily']['requests']}/{usage['current']['daily']['limit']}")
```

---

## 📈 使用量管理

### 使用量の確認

#### 現在の使用量
```bash
GET /api/v1/usage/current
Authorization: Bearer YOUR_API_KEY

# レスポンス
{
  "current": {
    "daily": {
      "requests": 1234,
      "points": 1500,
      "limit": 24000,
      "remaining": 22500,
      "resetAt": "2025-07-22T00:00:00Z"
    },
    "monthly": {
      "requests": 45678,
      "points": 52000,
      "limit": 720000,
      "remaining": 668000,
      "resetAt": "2025-08-01T00:00:00Z"
    }
  },
  "plan": "starter"
}
```

#### 使用履歴
```bash
GET /api/v1/usage/history?days=30
Authorization: Bearer YOUR_API_KEY
```

#### エンドポイント別統計
```bash
GET /api/v1/usage/endpoints
Authorization: Bearer YOUR_API_KEY
```

### アラート設定

使用量が一定の閾値を超えた場合に通知を受け取ることができます：

```bash
POST /api/v1/usage/alerts
Authorization: Bearer YOUR_API_KEY
Content-Type: application/json

{
  "threshold": 80,        # 80%で通知
  "type": "percentage",   # percentage または absolute
  "enabled": true
}
```

---

## 🚀 ベストプラクティス

### 1. バッチ処理の活用

複数の操作をまとめて実行することで、API呼び出し回数を削減：

```javascript
// ❌ 非効率な例
for (const id of employeeIds) {
  await api.get(`/employees/${id}`);
}

// ✅ 効率的な例
const employees = await api.post('/employees/batch', {
  ids: employeeIds
});
```

### 2. キャッシング

頻繁にアクセスするデータはローカルにキャッシュ：

```javascript
class CachedAPIClient extends APIClient {
  private cache = new Map();
  private cacheTTL = 5 * 60 * 1000; // 5分

  async getCached(key: string, fetcher: () => Promise<any>) {
    const cached = this.cache.get(key);
    
    if (cached && cached.expires > Date.now()) {
      return cached.data;
    }
    
    const data = await fetcher();
    this.cache.set(key, {
      data,
      expires: Date.now() + this.cacheTTL
    });
    
    return data;
  }
}
```

### 3. レート制限の予測的管理

```javascript
class SmartRateLimiter {
  private requestTimes: number[] = [];
  
  async throttleRequest(fn: () => Promise<any>) {
    const now = Date.now();
    
    // 過去1時間のリクエストを保持
    this.requestTimes = this.requestTimes.filter(
      time => now - time < 3600000
    );
    
    // 現在のレートを計算
    const currentRate = this.requestTimes.length;
    const maxRate = 1000; // 時間あたりの制限
    
    // レートの80%に達したら遅延を追加
    if (currentRate > maxRate * 0.8) {
      const delay = Math.min(
        (currentRate / maxRate) * 1000,
        5000
      );
      await new Promise(resolve => setTimeout(resolve, delay));
    }
    
    this.requestTimes.push(now);
    return fn();
  }
}
```

### 4. エラーハンドリング

```javascript
async function robustAPICall(fn: () => Promise<any>, maxRetries = 3) {
  let lastError;
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      
      if (error.response?.status === 429) {
        // レート制限: 指定された時間待機
        const retryAfter = error.response.headers['retry-after'] || 60;
        await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
      } else if (error.response?.status >= 500) {
        // サーバーエラー: 指数バックオフ
        const delay = Math.pow(2, i) * 1000;
        await new Promise(resolve => setTimeout(resolve, delay));
      } else {
        // その他のエラー: 即座に失敗
        throw error;
      }
    }
  }
  
  throw lastError;
}
```

---

## 🔍 トラブルシューティング

### よくある問題

#### 1. 頻繁なレート制限エラー
**原因**: 
- 非効率なAPI使用
- 適切でないプラン

**解決策**:
- バッチAPIの使用
- キャッシング実装
- プランのアップグレード

#### 2. 予期しない使用量
**原因**:
- 無限ループ
- エラーリトライの暴走

**解決策**:
- 異常検知APIの活用
- リトライ制限の実装

#### 3. 不均等な使用パターン
**原因**:
- バースト的なトラフィック
- 定期ジョブの集中

**解決策**:
- リクエストの平準化
- ジョブのスケジュール分散

---

## 📞 サポート

レート制限に関するご質問や、カスタム制限のご要望については、以下までお問い合わせください：

- **技術サポート**: api-support@ai-os.com
- **営業（プランアップグレード）**: sales@ai-os.com
- **ドキュメント**: https://docs.ai-os.com/api/rate-limits

---

**注意**: レート制限は予告なく変更される場合があります。最新情報は公式ドキュメントをご確認ください。