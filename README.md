# MCP勤怠管理システム

Model Context Protocol (MCP) を使用した、日本の労働基準法に準拠した勤怠管理システムです。

## 概要

このシステムは、エージェント型エンタープライズの実現を目指し、以下の技術を統合しています：

- **MCP (Model Context Protocol)**: AIエージェントとシステムを接続する標準プロトコル
- **BPaC (Business Process as Code)**: 日本の労働基準法をコードとして実装
- **SQLite**: 軽量でポータブルなデータベース
- **TypeScript**: 型安全性とドキュメント化を両立

## 主要機能

### 📋 勤怠管理
- 出勤・退勤の打刻
- 勤怠記録の管理
- 休憩時間の管理
- 客観的な時刻記録対応

### 💰 給与計算
- 日本の労働基準法に準拠した給与計算
- 時間外労働の割増賃金計算（25%、50%）
- 深夜労働の割増賃金計算（25%）
- 休日労働の割増賃金計算（35%）
- 月間・年間の時間外労働上限チェック

### 📊 レポート機能
- 月間勤怠レポート
- 給与サマリー
- 労働基準法違反の検出

### 🤖 AIエージェント対応
- MCP プロトコルによるAIエージェントとの連携
- 自然言語による指示の処理
- 構造化されたツール呼び出し

## 技術仕様

### 日本労働基準法準拠

- **法定労働時間**: 1日8時間、週40時間
- **休憩時間**: 
  - 6時間超の労働: 45分以上
  - 8時間超の労働: 60分以上
- **時間外労働割増**: 
  - 通常: 25%以上
  - 月60時間超: 50%以上
- **深夜労働割増**: 22:00-05:00で25%以上
- **休日労働割増**: 35%以上
- **時間外労働上限**: 月45時間、年360時間

### アーキテクチャ

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   AI Agent      │    │   MCP Server    │    │   Database      │
│                 │◄──►│                 │◄──►│                 │
│ - Function Call │    │ - Tools         │    │ - SQLite        │
│ - Natural Lang  │    │ - Payroll Logic │    │ - Time Records  │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## インストール

### 前提条件

- Node.js 18以上
- npm または yarn

### セットアップ

```bash
# 依存関係のインストール
npm install

# TypeScriptビルド
npm run build

# データベース初期化
npm run init-db

# テストデータの作成（オプション）
npm run test-data
```

## 使用方法

### 1. CLIインターフェース

```bash
# CLIの起動
npm run cli

# 従業員の追加
add-employee "田中太郎" "開発部" "エンジニア" 3000 2024-01-15

# 出勤打刻
clock-in EMP_123

# 退勤打刻
clock-out EMP_123 60

# 給与計算
payroll EMP_123 2024-01

# 勤怠レポート
attendance-report EMP_123 2024-01
```

### 2. MCPサーバー

```bash
# MCPサーバーの起動
npm run start

# または開発モード
npm run dev
```

### 3. 利用可能なMCPツール

| ツール名 | 説明 | パラメータ |
|---------|------|----------|
| `clock_in` | 出勤打刻 | employeeId, clockInTime?, recordType? |
| `clock_out` | 退勤打刻 | employeeId, clockOutTime?, breakMinutes? |
| `get_time_records` | 勤怠記録取得 | employeeId, startDate, endDate |
| `calculate_payroll` | 給与計算 | employeeId, month |
| `get_payroll_summary` | 給与サマリー | month |
| `get_attendance_report` | 勤怠レポート | employeeId, month |
| `add_employee` | 従業員追加 | name, department, position, hourlyRate, joinDate |
| `get_employee` | 従業員情報取得 | employeeId |
| `get_all_employees` | 全従業員一覧 | なし |

## 設定

### 給与規則のカスタマイズ

`payroll_rules` テーブルを編集することで、給与計算規則をカスタマイズできます：

```sql
INSERT INTO payroll_rules (
    regular_hours_per_day,
    overtime_rate,
    late_night_rate,
    holiday_rate,
    effective_from
) VALUES (
    8.0,      -- 法定労働時間
    1.25,     -- 時間外割増率
    1.25,     -- 深夜割増率
    1.35,     -- 休日割増率
    '2024-01-01'
);
```

### 祝日の管理

`holidays` テーブルで祝日を管理できます：

```sql
INSERT INTO holidays (date, name, type) VALUES
('2024-01-01', '元日', 'national'),
('2024-01-08', '成人の日', 'national');
```

## 開発

### プロジェクト構造

```
src/
├── server.ts       # MCPサーバーメイン
├── database.ts     # データベース操作
├── payroll.ts      # 給与計算ロジック（BPaC）
├── types.ts        # 型定義
├── cli.ts          # CLIインターフェース
├── client.ts       # AIエージェントクライアント
└── test-data.ts    # テストデータ作成
```

### 開発スクリプト

```bash
# 開発モード（ホットリロード）
npm run dev

# ビルド
npm run build

# テスト
npm run test-data
```

## 法的コンプライアンス

このシステムは以下の日本の労働関連法規に準拠しています：

- 労働基準法
- 労働基準法施行規則
- 労働時間等の設定の改善に関する特別措置法

### 重要な注意事項

1. **客観的な時刻記録**: ICカードやPCログによる客観的な記録を推奨
2. **36協定**: 時間外労働には36協定の締結が必要
3. **安全配慮義務**: 過度な長時間労働の防止
4. **記録保存**: 勤怠記録は3年間の保存が法的に要求される

## ライセンス

MIT License

## 貢献

プルリクエストやイシューはGitHubで受け付けています。

## サポート

- GitHub Issues: バグ報告や機能要求
- ドキュメント: このREADMEファイル
- コード内コメント: 詳細な実装説明

---

**免責事項**: このシステムは労働基準法の一般的な規定に基づいて作成されていますが、具体的な労働条件については社会保険労務士等の専門家にご相談ください。