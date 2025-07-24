#!/usr/bin/env python3
"""
AI-OS Python SDK 基本的な使用例
このファイルはAI-OS Python SDKの基本的な使い方を示します
"""

import os
import sys
from datetime import datetime, timedelta

# SDKのパスを追加
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from ai_os_sdk import AIOSClient, AIOSError


def basic_examples():
    """基本的な使用例"""
    print("=== AI-OS SDK 基本使用例 ===\n")
    
    # クライアントの初期化
    client = AIOSClient(
        api_key="your-api-key-here",  # 実際のAPIキーに置き換えてください
        base_url="https://api.ai-os.com"
    )
    
    try:
        # 1. 従業員一覧の取得
        print("1. 従業員一覧を取得中...")
        employees = client.employees.list(limit=10, department="engineering")
        print(f"従業員数: {employees['total']}")
        if employees['data']:
            print(f"最初の従業員: {employees['data'][0]['name']}")
        
        # 2. 特定の従業員情報取得
        print("\n2. 特定の従業員情報を取得中...")
        employee = client.employees.get("emp123")
        print(f"従業員名: {employee.name}")
        print(f"部署: {employee.department}")
        print(f"役職: {employee.position}")
        
        # 3. 出勤打刻
        print("\n3. 出勤打刻を実行中...")
        clock_in = client.time_records.clock_in("emp123")
        print(f"打刻時刻: {clock_in.timestamp}")
        print(f"打刻タイプ: {clock_in.type}")
        
        # 4. 月次勤怠サマリー取得
        print("\n4. 月次勤怠サマリーを取得中...")
        summary = client.time_records.get_monthly_summary("emp123", "2025-07")
        print(f"総労働時間: {summary['totalHours']}時間")
        print(f"残業時間: {summary['overtimeHours']}時間")
        print(f"深夜労働: {summary['nightWork']}時間")
        
        # 5. 休暇残高確認
        print("\n5. 休暇残高を確認中...")
        balance = client.leaves.get_balance("emp123")
        print(f"有給休暇残日数: {balance.paid_leave['remaining']}日")
        print(f"次回付与日: {balance.paid_leave['nextGrantDate']}")
        
    except AIOSError as e:
        print(f"APIエラー: {e} (ステータスコード: {e.status_code})")
    except Exception as e:
        print(f"予期しないエラー: {e}")


def error_handling_example():
    """エラーハンドリングの例"""
    print("\n=== エラーハンドリングの例 ===\n")
    
    client = AIOSClient(api_key="your-api-key-here")
    
    try:
        # 存在しない従業員を取得しようとする
        client.employees.get("non-existent-id")
    except AIOSError as e:
        if e.status_code == 404:
            print("従業員が見つかりません")
        elif e.status_code == 401:
            print("認証エラー: APIキーを確認してください")
        else:
            print(f"APIエラー: {e}")


def pagination_example():
    """ページング処理の例"""
    print("\n=== ページング処理の例 ===\n")
    
    client = AIOSClient(api_key="your-api-key-here")
    
    try:
        page_size = 20
        offset = 0
        all_employees = []
        
        while True:
            response = client.employees.list(limit=page_size, offset=offset)
            all_employees.extend(response['data'])
            
            print(f"{len(response['data'])}件の従業員を取得（合計: {len(all_employees)}件）")
            
            if not response.get('hasMore', False):
                break
            
            offset += page_size
        
        print(f"全従業員数: {len(all_employees)}")
        
    except AIOSError as e:
        print(f"エラー: {e}")


def batch_processing_example():
    """バッチ処理の例"""
    print("\n=== バッチ処理の例 ===\n")
    
    client = AIOSClient(api_key="your-api-key-here")
    employee_ids = ["emp001", "emp002", "emp003", "emp004", "emp005"]
    
    print("全従業員の休暇残高を取得中...")
    
    for emp_id in employee_ids:
        try:
            balance = client.leaves.get_balance(emp_id)
            print(f"{emp_id}: 有給残 {balance.paid_leave['remaining']}日")
        except AIOSError as e:
            print(f"{emp_id}: エラー - {e}")


def time_tracking_workflow():
    """勤怠管理ワークフローの例"""
    print("\n=== 勤怠管理ワークフローの例 ===\n")
    
    client = AIOSClient(api_key="your-api-key-here")
    employee_id = "emp123"
    
    try:
        # 今月の勤怠記録を取得
        today = datetime.now()
        start_of_month = today.replace(day=1).strftime("%Y-%m-%d")
        end_of_month = today.strftime("%Y-%m-%d")
        
        records = client.time_records.list(
            employee_id=employee_id,
            start_date=start_of_month,
            end_date=end_of_month
        )
        
        print(f"{today.strftime('%Y年%m月')}の勤怠記録:")
        for record in records['data'][:5]:  # 最新5件を表示
            print(f"- {record['timestamp']}: {record['type']}")
        
        # 月次サマリー確認
        summary = client.time_records.get_monthly_summary(
            employee_id,
            today.strftime("%Y-%m")
        )
        
        print(f"\n月次サマリー:")
        print(f"- 総労働時間: {summary['totalHours']}時間")
        print(f"- 残業時間: {summary['overtimeHours']}時間")
        
        # 残業アラート
        if summary['overtimeHours'] > 45:
            print("⚠️  警告: 月間残業時間が45時間を超えています！")
        
    except AIOSError as e:
        print(f"エラー: {e}")


def leave_request_workflow():
    """休暇申請ワークフローの例"""
    print("\n=== 休暇申請ワークフローの例 ===\n")
    
    client = AIOSClient(api_key="your-api-key-here")
    
    try:
        # 休暇残高確認
        balance = client.leaves.get_balance("emp123")
        print(f"現在の有給休暇残高: {balance.paid_leave['remaining']}日")
        
        if balance.paid_leave['remaining'] >= 1:
            # 休暇申請
            next_monday = datetime.now()
            while next_monday.weekday() != 0:  # 月曜日まで進める
                next_monday += timedelta(days=1)
            
            leave_request = client.leaves.request(
                employee_id="emp123",
                leave_type="paid",
                start_date=next_monday.strftime("%Y-%m-%d"),
                end_date=next_monday.strftime("%Y-%m-%d"),
                reason="私用のため"
            )
            
            print(f"\n休暇申請を作成しました:")
            print(f"- 申請ID: {leave_request['id']}")
            print(f"- 期間: {leave_request['startDate']} 〜 {leave_request['endDate']}")
            print(f"- ステータス: {leave_request['status']}")
        else:
            print("有給休暇が不足しています")
        
    except AIOSError as e:
        print(f"エラー: {e}")


def expense_submission_workflow():
    """経費申請ワークフローの例"""
    print("\n=== 経費申請ワークフローの例 ===\n")
    
    client = AIOSClient(api_key="your-api-key-here")
    
    try:
        # レシートアップロード（実際にはファイルパスを指定）
        # receipt_result = client.expenses.upload_receipt(
        #     file_path="/path/to/receipt.jpg",
        #     employee_id="emp123",
        #     category="transportation"
        # )
        
        # 経費申請作成
        expense = client.expenses.submit(
            employee_id="emp123",
            amount=3500,
            category="transportation",
            date=datetime.now().strftime("%Y-%m-%d"),
            description="客先訪問 - タクシー代",
            project_code="PROJ001"
        )
        
        print(f"経費申請を作成しました:")
        print(f"- 申請ID: {expense.id}")
        print(f"- 金額: {expense.amount:,}円")
        print(f"- カテゴリ: {expense.category}")
        print(f"- ステータス: {expense.status}")
        
        if expense.ai_recommendation:
            print(f"- AI推奨: {expense.ai_recommendation}")
        
    except AIOSError as e:
        print(f"エラー: {e}")


def human_capital_analytics():
    """人的資本分析の例"""
    print("\n=== 人的資本分析の例 ===\n")
    
    client = AIOSClient(api_key="your-api-key-here")
    
    try:
        # 四半期の人的資本指標を取得
        metrics = client.reports.get_human_capital_metrics(
            start_date="2025-04-01",
            end_date="2025-06-30",
            group_by="department"
        )
        
        print("2025年第2四半期 人的資本指標:")
        print(f"- 従業員数: {metrics['employeeCount']}名")
        print(f"- 平均勤続年数: {metrics['averageTenure']:.1f}年")
        print(f"- 離職率: {metrics['turnoverRate']:.1f}%")
        print(f"- エンゲージメントスコア: {metrics['engagementScore']:.1f}/5.0")
        
        # 部門別分析
        print("\n部門別離職リスク:")
        for dept in metrics['departments']:
            risk_level = "高" if dept['turnoverRisk'] > 0.7 else "中" if dept['turnoverRisk'] > 0.4 else "低"
            print(f"- {dept['name']}: {risk_level} ({dept['turnoverRisk']:.1%})")
        
        # ダッシュボードデータ取得
        dashboard = client.reports.get_dashboard("main-dashboard")
        print(f"\n現在の状況:")
        print(f"- 出勤中: {dashboard['currentlyWorking']}名")
        print(f"- 本日の残業予測: {dashboard['overtimePrediction']}時間")
        
    except AIOSError as e:
        print(f"エラー: {e}")


def main():
    """メイン実行関数"""
    # 基本的な使用例
    basic_examples()
    
    # エラーハンドリング
    error_handling_example()
    
    # 実践的なワークフロー例
    # time_tracking_workflow()
    # leave_request_workflow()
    # expense_submission_workflow()
    # human_capital_analytics()
    
    # ページング処理（大量データ取得時）
    # pagination_example()
    
    # バッチ処理
    # batch_processing_example()


if __name__ == "__main__":
    main()