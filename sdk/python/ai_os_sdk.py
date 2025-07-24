"""
AI-OS Python SDK
Version: 1.0.0
Description: AI-OSプラットフォームとの統合を簡単にするためのPython SDK
"""

import os
import json
import time
from typing import Dict, List, Optional, Any, Union
from dataclasses import dataclass
from datetime import datetime
import requests
from requests.adapters import HTTPAdapter
from requests.packages.urllib3.util.retry import Retry


class AIOSError(Exception):
    """AI-OS API エラー"""
    
    def __init__(self, message: str, status_code: int, response: Optional[Dict] = None):
        super().__init__(message)
        self.status_code = status_code
        self.response = response


@dataclass
class Employee:
    """従業員データクラス"""
    id: str
    employee_code: str
    name: str
    email: str
    department: str
    position: str
    hire_date: str
    account_status: str
    metadata: Optional[Dict] = None


@dataclass
class TimeRecord:
    """勤怠記録データクラス"""
    id: str
    employee_id: str
    type: str
    timestamp: str
    location: Optional[Dict[str, float]] = None
    device: Optional[str] = None


@dataclass
class Payslip:
    """給与明細データクラス"""
    id: str
    employee_id: str
    year_month: str
    base_salary: float
    overtime_pay: float
    allowances: float
    gross_pay: float
    social_insurance: float
    income_tax: float
    total_deductions: float
    net_pay: float


@dataclass
class LeaveBalance:
    """休暇残高データクラス"""
    employee_id: str
    paid_leave: Dict[str, Any]
    sick_leave: Dict[str, Any]


@dataclass
class Expense:
    """経費データクラス"""
    id: str
    employee_id: str
    amount: float
    category: str
    date: str
    description: str
    status: str
    receipt_id: Optional[str] = None
    project_code: Optional[str] = None
    ai_recommendation: Optional[str] = None


class AIOSClient:
    """AI-OS APIクライアント"""
    
    def __init__(
        self,
        api_key: Optional[str] = None,
        base_url: str = "https://api.ai-os.com",
        version: str = "v1",
        timeout: int = 30,
        max_retries: int = 3,
        retry_delay: int = 1
    ):
        self.api_key = api_key or os.getenv("AIOS_API_KEY")
        if not self.api_key:
            raise ValueError("APIキーが必要です。引数または環境変数AIOS_API_KEYで設定してください。")
        
        self.base_url = base_url
        self.version = version
        self.timeout = timeout
        self.max_retries = max_retries
        self.retry_delay = retry_delay
        
        # セッション設定
        self.session = requests.Session()
        retry_strategy = Retry(
            total=max_retries,
            backoff_factor=retry_delay,
            status_forcelist=[429, 500, 502, 503, 504]
        )
        adapter = HTTPAdapter(max_retries=retry_strategy)
        self.session.mount("http://", adapter)
        self.session.mount("https://", adapter)
        
        # デフォルトヘッダー
        self.session.headers.update({
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
            "X-SDK-Version": "1.0.0",
            "X-SDK-Language": "Python"
        })
        
        # APIエンドポイントの初期化
        self.employees = EmployeesAPI(self)
        self.time_records = TimeRecordsAPI(self)
        self.payroll = PayrollAPI(self)
        self.leaves = LeavesAPI(self)
        self.expenses = ExpensesAPI(self)
        self.reports = ReportsAPI(self)
    
    def _request(
        self,
        method: str,
        endpoint: str,
        data: Optional[Dict] = None,
        params: Optional[Dict] = None,
        files: Optional[Dict] = None
    ) -> Union[Dict, List]:
        """HTTPリクエストを実行"""
        url = f"{self.base_url}/api/{self.version}{endpoint}"
        
        kwargs = {
            "timeout": self.timeout,
            "params": params
        }
        
        if files:
            kwargs["files"] = files
            # multipart/form-dataの場合はContent-Typeを削除
            headers = self.session.headers.copy()
            headers.pop("Content-Type", None)
            kwargs["headers"] = headers
        
        if data and method in ["POST", "PUT", "PATCH"]:
            kwargs["json"] = data
        
        try:
            response = self.session.request(method, url, **kwargs)
            response.raise_for_status()
            
            if response.content:
                return response.json()
            return {}
            
        except requests.exceptions.HTTPError as e:
            error_data = {}
            try:
                error_data = response.json()
            except:
                pass
            
            raise AIOSError(
                error_data.get("message", str(e)),
                response.status_code,
                error_data
            )
        except requests.exceptions.RequestException as e:
            raise AIOSError(str(e), 0)


class EmployeesAPI:
    """従業員管理API"""
    
    def __init__(self, client: AIOSClient):
        self.client = client
    
    def list(
        self,
        limit: int = 20,
        offset: int = 0,
        department: Optional[str] = None,
        status: Optional[str] = None
    ) -> Dict[str, Any]:
        """従業員一覧を取得"""
        params = {
            "limit": limit,
            "offset": offset
        }
        if department:
            params["department"] = department
        if status:
            params["status"] = status
        
        return self.client._request("GET", "/employees", params=params)
    
    def get(self, employee_id: str) -> Employee:
        """従業員詳細を取得"""
        data = self.client._request("GET", f"/employees/{employee_id}")
        return Employee(**data)
    
    def create(self, employee_data: Dict[str, Any]) -> Employee:
        """従業員を作成"""
        data = self.client._request("POST", "/employees", data=employee_data)
        return Employee(**data)
    
    def update(self, employee_id: str, employee_data: Dict[str, Any]) -> Employee:
        """従業員情報を更新"""
        data = self.client._request("PUT", f"/employees/{employee_id}", data=employee_data)
        return Employee(**data)
    
    def delete(self, employee_id: str) -> None:
        """従業員を削除"""
        self.client._request("DELETE", f"/employees/{employee_id}")


class TimeRecordsAPI:
    """勤怠管理API"""
    
    def __init__(self, client: AIOSClient):
        self.client = client
    
    def clock_in(self, employee_id: str) -> TimeRecord:
        """出勤打刻"""
        data = self.client._request(
            "POST",
            "/time-records/clock-in",
            data={"employee_id": employee_id}
        )
        return TimeRecord(**data)
    
    def clock_out(self, employee_id: str) -> TimeRecord:
        """退勤打刻"""
        data = self.client._request(
            "POST",
            "/time-records/clock-out",
            data={"employee_id": employee_id}
        )
        return TimeRecord(**data)
    
    def list(
        self,
        employee_id: Optional[str] = None,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
        limit: int = 20,
        offset: int = 0
    ) -> Dict[str, Any]:
        """勤怠記録一覧を取得"""
        params = {
            "limit": limit,
            "offset": offset
        }
        if employee_id:
            params["employee_id"] = employee_id
        if start_date:
            params["start_date"] = start_date
        if end_date:
            params["end_date"] = end_date
        
        return self.client._request("GET", "/time-records", params=params)
    
    def get_monthly_summary(self, employee_id: str, year_month: str) -> Dict[str, Any]:
        """月次勤怠サマリーを取得"""
        return self.client._request(
            "GET",
            f"/time-records/summary/{employee_id}/{year_month}"
        )


class PayrollAPI:
    """給与管理API"""
    
    def __init__(self, client: AIOSClient):
        self.client = client
    
    def calculate(
        self,
        year_month: str,
        department_ids: Optional[List[str]] = None,
        employee_ids: Optional[List[str]] = None,
        include_bonus: bool = False,
        calculate_tax: bool = True,
        calculate_insurance: bool = True
    ) -> Dict[str, Any]:
        """給与計算を実行"""
        data = {
            "year_month": year_month,
            "include_bonus": include_bonus,
            "calculate_tax": calculate_tax,
            "calculate_insurance": calculate_insurance
        }
        if department_ids:
            data["department_ids"] = department_ids
        if employee_ids:
            data["employee_ids"] = employee_ids
        
        return self.client._request("POST", "/payroll/calculate", data=data)
    
    def get_payslip(self, employee_id: str, year_month: str) -> Payslip:
        """給与明細を取得"""
        data = self.client._request(
            "GET",
            f"/payroll/payslips/{employee_id}/{year_month}"
        )
        return Payslip(**data)
    
    def list_payslips(
        self,
        year_month: Optional[str] = None,
        department_id: Optional[str] = None,
        limit: int = 20,
        offset: int = 0
    ) -> Dict[str, Any]:
        """給与明細一覧を取得"""
        params = {
            "limit": limit,
            "offset": offset
        }
        if year_month:
            params["year_month"] = year_month
        if department_id:
            params["department_id"] = department_id
        
        return self.client._request("GET", "/payroll/payslips", params=params)
    
    def approve(self, batch_id: str) -> Dict[str, Any]:
        """給与計算結果を承認"""
        return self.client._request("POST", f"/payroll/batches/{batch_id}/approve")


class LeavesAPI:
    """休暇管理API"""
    
    def __init__(self, client: AIOSClient):
        self.client = client
    
    def request(
        self,
        employee_id: str,
        leave_type: str,
        start_date: str,
        end_date: str,
        reason: str
    ) -> Dict[str, Any]:
        """休暇申請"""
        data = {
            "employee_id": employee_id,
            "type": leave_type,
            "start_date": start_date,
            "end_date": end_date,
            "reason": reason
        }
        return self.client._request("POST", "/leaves/requests", data=data)
    
    def list_requests(
        self,
        employee_id: Optional[str] = None,
        status: Optional[str] = None,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
        limit: int = 20,
        offset: int = 0
    ) -> Dict[str, Any]:
        """休暇申請一覧を取得"""
        params = {
            "limit": limit,
            "offset": offset
        }
        if employee_id:
            params["employee_id"] = employee_id
        if status:
            params["status"] = status
        if start_date:
            params["start_date"] = start_date
        if end_date:
            params["end_date"] = end_date
        
        return self.client._request("GET", "/leaves/requests", params=params)
    
    def get_balance(self, employee_id: str) -> LeaveBalance:
        """休暇残高を取得"""
        data = self.client._request("GET", f"/leaves/balance/{employee_id}")
        return LeaveBalance(**data)
    
    def approve(self, request_id: str) -> Dict[str, Any]:
        """休暇申請を承認"""
        return self.client._request("POST", f"/leaves/requests/{request_id}/approve")
    
    def reject(self, request_id: str, reason: str) -> Dict[str, Any]:
        """休暇申請を却下"""
        return self.client._request(
            "POST",
            f"/leaves/requests/{request_id}/reject",
            data={"reason": reason}
        )


class ExpensesAPI:
    """経費管理API"""
    
    def __init__(self, client: AIOSClient):
        self.client = client
    
    def submit(
        self,
        employee_id: str,
        amount: float,
        category: str,
        date: str,
        description: str,
        receipt_id: Optional[str] = None,
        project_code: Optional[str] = None
    ) -> Expense:
        """経費申請"""
        data = {
            "employee_id": employee_id,
            "amount": amount,
            "category": category,
            "date": date,
            "description": description
        }
        if receipt_id:
            data["receipt_id"] = receipt_id
        if project_code:
            data["project_code"] = project_code
        
        result = self.client._request("POST", "/expenses", data=data)
        return Expense(**result)
    
    def upload_receipt(
        self,
        file_path: str,
        employee_id: str,
        category: Optional[str] = None
    ) -> Dict[str, Any]:
        """レシートをアップロード"""
        with open(file_path, "rb") as f:
            files = {"receipt": f}
            data = {"employee_id": employee_id}
            if category:
                data["category"] = category
            
            return self.client._request(
                "POST",
                "/expenses/receipts",
                data=data,
                files=files
            )
    
    def list(
        self,
        employee_id: Optional[str] = None,
        status: Optional[str] = None,
        category: Optional[str] = None,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
        limit: int = 20,
        offset: int = 0
    ) -> Dict[str, Any]:
        """経費申請一覧を取得"""
        params = {
            "limit": limit,
            "offset": offset
        }
        if employee_id:
            params["employee_id"] = employee_id
        if status:
            params["status"] = status
        if category:
            params["category"] = category
        if start_date:
            params["start_date"] = start_date
        if end_date:
            params["end_date"] = end_date
        
        return self.client._request("GET", "/expenses", params=params)
    
    def approve(self, expense_id: str) -> Expense:
        """経費申請を承認"""
        data = self.client._request("POST", f"/expenses/{expense_id}/approve")
        return Expense(**data)


class ReportsAPI:
    """レポート・分析API"""
    
    def __init__(self, client: AIOSClient):
        self.client = client
    
    def generate(self, report_type: str, params: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """レポートを生成"""
        return self.client._request(
            "POST",
            f"/reports/{report_type}",
            data=params or {}
        )
    
    def get_dashboard(self, dashboard_id: str) -> Dict[str, Any]:
        """ダッシュボードデータを取得"""
        return self.client._request("GET", f"/reports/dashboards/{dashboard_id}")
    
    def get_human_capital_metrics(
        self,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
        group_by: Optional[str] = None
    ) -> Dict[str, Any]:
        """人的資本指標を取得"""
        params = {}
        if start_date:
            params["start_date"] = start_date
        if end_date:
            params["end_date"] = end_date
        if group_by:
            params["group_by"] = group_by
        
        return self.client._request("GET", "/reports/human-capital", params=params)