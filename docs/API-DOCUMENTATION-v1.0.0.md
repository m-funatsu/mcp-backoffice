# AI-Native Strategic HR Platform
## APIドキュメント v1.0.0

### 目次
1. [概要](#概要)
2. [認証](#認証)
3. [エラーハンドリング](#エラーハンドリング)
4. [レート制限](#レート制限)
5. [API エンドポイント](#api-エンドポイント)
   - [勤怠管理](#勤怠管理)
   - [給与計算](#給与計算)
   - [経費管理](#経費管理)
   - [人的資本](#人的資本)
   - [予測分析](#予測分析)
   - [ジェネレーティブUI](#ジェネレーティブui)
6. [WebSocket API](#websocket-api)
7. [Webhook](#webhook)
8. [SDKとコードサンプル](#sdkとコードサンプル)

---

## 概要

### ベースURL
```
Production: https://api.ai-hr-platform.jp/v1
Staging: https://staging-api.ai-hr-platform.jp/v1
```

### データフォーマット
- **リクエスト**: `application/json`
- **レスポンス**: `application/json`
- **文字エンコーディング**: UTF-8
- **日付フォーマット**: ISO 8601 (YYYY-MM-DDTHH:mm:ss.sssZ)

### HTTPメソッド
- `GET`: リソースの取得
- `POST`: リソースの作成
- `PUT`: リソースの完全更新
- `PATCH`: リソースの部分更新
- `DELETE`: リソースの削除

---

## 認証

### OAuth 2.0
```http
POST /auth/token
Content-Type: application/json

{
  "grant_type": "client_credentials",
  "client_id": "your_client_id",
  "client_secret": "your_client_secret",
  "scope": "read write"
}
```

**レスポンス**:
```json
{
  "access_token": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "Bearer",
  "expires_in": 3600,
  "refresh_token": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...",
  "scope": "read write"
}
```

### リクエストヘッダー
```http
Authorization: Bearer {access_token}
X-API-Version: 1.0.0
Accept-Language: ja
```

---

## エラーハンドリング

### エラーレスポンス形式
```json
{
  "error": {
    "code": "INVALID_REQUEST",
    "message": "リクエストが無効です",
    "details": {
      "field": "employee_id",
      "reason": "必須フィールドです"
    },
    "request_id": "req_abc123",
    "timestamp": "2025-08-01T10:30:00.000Z"
  }
}
```

### HTTPステータスコード
- `200 OK`: 成功
- `201 Created`: 作成成功
- `204 No Content`: 削除成功
- `400 Bad Request`: 不正なリクエスト
- `401 Unauthorized`: 認証エラー
- `403 Forbidden`: 権限エラー
- `404 Not Found`: リソース未発見
- `409 Conflict`: 競合エラー
- `429 Too Many Requests`: レート制限
- `500 Internal Server Error`: サーバーエラー

---

## レート制限

### 制限値
- **スタンダード**: 1,000リクエスト/時
- **プロフェッショナル**: 10,000リクエスト/時
- **エンタープライズ**: カスタム

### レスポンスヘッダー
```http
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 999
X-RateLimit-Reset: 1627849200
```

---

## API エンドポイント

### 勤怠管理

#### 打刻記録作成
```http
POST /time-records
Content-Type: application/json

{
  "employee_id": "emp001",
  "record_type": "clock_in",
  "timestamp": "2025-08-01T09:00:00.000Z",
  "location": {
    "latitude": 35.6762,
    "longitude": 139.6503
  },
  "device_type": "mobile"
}
```

**レスポンス**:
```json
{
  "id": "tr_123456",
  "employee_id": "emp001",
  "record_type": "clock_in",
  "timestamp": "2025-08-01T09:00:00.000Z",
  "status": "approved",
  "compliance_check": {
    "passed": true,
    "warnings": []
  }
}
```

#### 勤怠記録取得
```http
GET /time-records?employee_id=emp001&start_date=2025-08-01&end_date=2025-08-31
```

**レスポンス**:
```json
{
  "data": [
    {
      "id": "tr_123456",
      "date": "2025-08-01",
      "clock_in": "2025-08-01T09:00:00.000Z",
      "clock_out": "2025-08-01T18:30:00.000Z",
      "break_minutes": 60,
      "working_hours": 8.5,
      "overtime_hours": 0.5,
      "record_type": "ic_card"
    }
  ],
  "meta": {
    "total": 20,
    "page": 1,
    "per_page": 50
  }
}
```

#### コンプライアンスチェック
```http
POST /compliance/check
Content-Type: application/json

{
  "employee_id": "emp001",
  "period": {
    "start": "2025-08-01",
    "end": "2025-08-31"
  },
  "check_types": ["overtime_36", "break_time", "holiday_work"]
}
```

---

### 給与計算

#### 給与計算実行
```http
POST /payroll/calculate
Content-Type: application/json

{
  "employee_id": "emp001",
  "period": "2025-08",
  "include_bonuses": true,
  "adjustments": [
    {
      "type": "allowance",
      "amount": 50000,
      "description": "特別手当"
    }
  ]
}
```

**レスポンス**:
```json
{
  "calculation_id": "calc_789012",
  "employee_id": "emp001",
  "period": "2025-08",
  "summary": {
    "base_salary": 300000,
    "overtime_pay": 45678,
    "allowances": 80000,
    "gross_pay": 425678,
    "deductions": {
      "income_tax": 15234,
      "resident_tax": 12000,
      "social_insurance": 61824,
      "employment_insurance": 1280
    },
    "net_pay": 335340
  },
  "details": {
    "working_days": 20,
    "total_hours": 168.5,
    "overtime_hours": 15.5,
    "late_night_hours": 5.0,
    "holiday_hours": 8.0
  }
}
```

#### 給与明細取得
```http
GET /payroll/statements/{calculation_id}
Accept: application/pdf
```

---

### 経費管理

#### 経費申請作成
```http
POST /expenses
Content-Type: multipart/form-data

{
  "employee_id": "emp001",
  "amount": 5000,
  "category": "transportation",
  "expense_date": "2025-08-01",
  "description": "客先訪問交通費",
  "receipt_image": <binary_data>
}
```

**レスポンス**:
```json
{
  "expense_id": "exp_345678",
  "status": "pending",
  "ocr_result": {
    "extracted_amount": 5000,
    "confidence": 0.98,
    "vendor": "JR東日本"
  },
  "approval_risk": {
    "score": 0.15,
    "level": "low",
    "auto_approval_eligible": true
  }
}
```

#### 承認ワークフロー
```http
PUT /expenses/{expense_id}/approve
Content-Type: application/json

{
  "action": "approve",
  "approver_id": "mgr001",
  "comments": "承認します"
}
```

---

### 人的資本

#### 人的資本レポート生成
```http
POST /human-capital/reports
Content-Type: application/json

{
  "company_name": "株式会社Example",
  "period": {
    "start": "2025-01-01",
    "end": "2025-12-31"
  },
  "categories": [
    "diversity",
    "leadership",
    "skills",
    "engagement",
    "training"
  ],
  "format": "json"
}
```

**レスポンス**:
```json
{
  "report_id": "hcr_567890",
  "metrics": {
    "diversity": {
      "gender_ratio": {
        "male": 0.60,
        "female": 0.40
      },
      "female_manager_ratio": 0.25,
      "diversity_index": 0.72
    },
    "engagement": {
      "satisfaction_score": 4.2,
      "enps": 45,
      "turnover_rate": 0.08
    },
    "training": {
      "hours_per_employee": 48.5,
      "completion_rate": 0.85,
      "roi": 2.3
    }
  },
  "recommendations": [
    {
      "category": "diversity",
      "priority": "high",
      "action": "女性管理職育成プログラムの強化"
    }
  ]
}
```

#### タレントプロファイル更新
```http
PATCH /talent/profiles/{employee_id}
Content-Type: application/json

{
  "performance_rating": 4.5,
  "potential_rating": 4.0,
  "assessment_date": "2025-08-01",
  "assessed_by": "mgr001"
}
```

---

### 予測分析

#### 残業予測
```http
GET /analytics/overtime/predict?employee_id=emp001&months=3
```

**レスポンス**:
```json
{
  "predictions": [
    {
      "month": "2025-09",
      "predicted_hours": 25.5,
      "confidence": 0.85,
      "risk_level": "medium",
      "factors": [
        {
          "name": "seasonal_trend",
          "impact": 0.35
        },
        {
          "name": "project_deadline",
          "impact": 0.28
        }
      ]
    }
  ],
  "recommendations": [
    "リソース配分の見直し",
    "タスク優先順位の再評価"
  ]
}
```

#### 離職リスク評価
```http
POST /analytics/turnover/assess
Content-Type: application/json

{
  "employee_ids": ["emp001", "emp002", "emp003"],
  "include_factors": true
}
```

---

### ジェネレーティブUI

#### 自然言語クエリ
```http
POST /ui/generate
Content-Type: application/json

{
  "query": "開発チームの今月の残業状況を見せて",
  "context": {
    "user_id": "usr001",
    "role": "manager",
    "department": "development"
  },
  "device": {
    "type": "desktop",
    "screen_width": 1920
  }
}
```

**レスポンス**:
```json
{
  "ui_id": "ui_901234",
  "intent": {
    "primary": "data_visualization",
    "secondary": "overtime_analysis",
    "confidence": 0.92
  },
  "components": [
    {
      "type": "chart",
      "id": "chart_001",
      "config": {
        "chart_type": "bar",
        "title": "開発チーム残業時間推移",
        "data_source": "/api/v1/analytics/overtime/team/development"
      }
    },
    {
      "type": "table",
      "id": "table_001",
      "config": {
        "columns": ["氏名", "今月残業", "先月比", "36協定状況"],
        "sortable": true,
        "filterable": true
      }
    }
  ],
  "layout": {
    "type": "grid",
    "columns": 2,
    "responsive": true
  }
}
```

---

## WebSocket API

### 接続
```javascript
const ws = new WebSocket('wss://ws.ai-hr-platform.jp/v1/stream');

ws.on('open', () => {
  ws.send(JSON.stringify({
    type: 'auth',
    token: 'your_access_token'
  }));
});
```

### リアルタイム通知
```javascript
// サブスクライブ
ws.send(JSON.stringify({
  type: 'subscribe',
  channels: ['compliance_alerts', 'approval_requests']
}));

// メッセージ受信
ws.on('message', (data) => {
  const message = JSON.parse(data);
  console.log('Received:', message);
});
```

---

## Webhook

### Webhook設定
```http
POST /webhooks
Content-Type: application/json

{
  "url": "https://your-domain.com/webhook",
  "events": [
    "time_record.created",
    "expense.approved",
    "compliance.violation"
  ],
  "secret": "your_webhook_secret"
}
```

### Webhookペイロード例
```json
{
  "event": "compliance.violation",
  "timestamp": "2025-08-01T15:30:00.000Z",
  "data": {
    "employee_id": "emp001",
    "violation_type": "overtime_excess",
    "details": {
      "current_hours": 46,
      "limit": 45,
      "period": "2025-08"
    }
  },
  "signature": "sha256=abcdef..."
}
```

---

## SDKとコードサンプル

### Node.js SDK
```bash
npm install @ai-hr-platform/sdk
```

```javascript
const { HRPlatformClient } = require('@ai-hr-platform/sdk');

const client = new HRPlatformClient({
  apiKey: 'your_api_key',
  apiSecret: 'your_api_secret'
});

// 勤怠記録取得
const timeRecords = await client.timeRecords.list({
  employeeId: 'emp001',
  startDate: '2025-08-01',
  endDate: '2025-08-31'
});

// 給与計算実行
const payroll = await client.payroll.calculate({
  employeeId: 'emp001',
  period: '2025-08'
});
```

### Python SDK
```bash
pip install ai-hr-platform
```

```python
from ai_hr_platform import HRPlatformClient

client = HRPlatformClient(
    api_key="your_api_key",
    api_secret="your_api_secret"
)

# 人的資本レポート生成
report = client.human_capital.generate_report(
    company_name="株式会社Example",
    period={
        "start": "2025-01-01",
        "end": "2025-12-31"
    }
)

# 予測分析
predictions = client.analytics.predict_overtime(
    employee_id="emp001",
    months=3
)
```

### cURL サンプル
```bash
# 認証トークン取得
curl -X POST https://api.ai-hr-platform.jp/v1/auth/token \
  -H "Content-Type: application/json" \
  -d '{
    "grant_type": "client_credentials",
    "client_id": "your_client_id",
    "client_secret": "your_client_secret"
  }'

# 勤怠記録作成
curl -X POST https://api.ai-hr-platform.jp/v1/time-records \
  -H "Authorization: Bearer your_access_token" \
  -H "Content-Type: application/json" \
  -d '{
    "employee_id": "emp001",
    "record_type": "clock_in",
    "timestamp": "2025-08-01T09:00:00.000Z"
  }'
```

---

## 付録

### ページネーション
```http
GET /employees?page=2&per_page=50&sort=name&order=asc
```

### フィルタリング
```http
GET /time-records?employee_id=emp001&date_gte=2025-08-01&date_lte=2025-08-31
```

### 部分レスポンス
```http
GET /employees/emp001?fields=id,name,department,position
```

### バッチリクエスト
```http
POST /batch
Content-Type: application/json

{
  "requests": [
    {
      "method": "GET",
      "url": "/employees/emp001"
    },
    {
      "method": "GET",
      "url": "/time-records?employee_id=emp001"
    }
  ]
}
```

---

## サポート

### 開発者ポータル
https://developers.ai-hr-platform.jp

### APIステータス
https://status.ai-hr-platform.jp

### 問い合わせ
- メール: api-support@ai-hr-platform.jp
- Slack: #api-support

---

*最終更新: 2025年8月1日*  
*APIバージョン: 1.0.0*