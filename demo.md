# 勤怠管理システム使用方法デモ

## 基本的な使い方

### 1. CLIインターフェース
```bash
npm run cli
```

### 使用可能なコマンド一覧：

#### 👥 従業員管理
```bash
# 新しい従業員を追加
add-employee "田中太郎" "開発部" "エンジニア" 3000 2024-01-15

# 全従業員の一覧表示
list-employees

# 特定の従業員情報を表示
employee EMP_123
```

#### ⏰ 打刻機能
```bash
# 出勤打刻
clock-in EMP_123

# 退勤打刻（休憩時間60分）
clock-out EMP_123 60
```

#### 📋 勤怠記録
```bash
# 期間を指定して勤怠記録を取得
time-records EMP_123 2024-01-01 2024-01-31
```

#### 💰 給与計算
```bash
# 特定従業員の月次給与計算
payroll EMP_123 2024-01

# 全従業員の給与サマリー
payroll-summary 2024-01
```

#### 📊 レポート
```bash
# 勤怠レポート生成
attendance-report EMP_123 2024-01
```

## 2. MCPサーバーとしての使用

### サーバー起動
```bash
npm run start
```

### Claude等のAIエージェントから利用
MCPサーバーを起動後、以下のようなツールが利用可能：

- `clock_in` - 出勤打刻
- `clock_out` - 退勤打刻  
- `get_time_records` - 勤怠記録取得
- `calculate_payroll` - 給与計算
- `get_payroll_summary` - 給与サマリー
- `get_attendance_report` - 勤怠レポート
- `add_employee` - 従業員追加
- `get_employee` - 従業員情報取得
- `get_all_employees` - 全従業員一覧

## 実用例

### 典型的な一日の流れ
```bash
# 1. 朝の出勤打刻
clock-in EMP_123

# 2. 夕方の退勤打刻（1時間休憩）
clock-out EMP_123 60

# 3. 勤務時間の確認
time-records EMP_123 2024-01-15 2024-01-15
```

### 月末の給与処理
```bash
# 1. 全従業員の給与サマリー確認
payroll-summary 2024-01

# 2. 個別の詳細レポート確認
attendance-report EMP_123 2024-01

# 3. 労働基準法違反がないかチェック
# → レポートに自動的に表示されます
```

## 特徴

✅ **日本労働基準法完全準拠**
- 時間外労働25%割増（月60時間超は50%）
- 深夜労働25%割増（22:00-05:00）
- 休日労働35%割増
- 法定休憩時間の自動チェック

✅ **AI連携対応**
- Model Context Protocol (MCP) 対応
- 自然言語での指示が可能
- 自動化されたワークフロー実行

✅ **包括的な管理機能**
- リアルタイム勤怠管理
- 自動給与計算
- 法令違反の検出
- 詳細レポート生成