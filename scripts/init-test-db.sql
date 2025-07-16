-- テストデータベース初期化スクリプト
-- Test Database Initialization Script

-- テストデータベースの作成
CREATE DATABASE IF NOT EXISTS attendance_test;

-- 基本的な設定
SET timezone = 'Asia/Tokyo';
SET datestyle = 'ISO, YMD';
SET default_text_search_config = 'pg_catalog.english';

-- テスト用サンプルデータ
INSERT INTO employees (id, name, email, department, position, hourly_rate, start_date, is_active) VALUES
('TEST_EMP_001', 'テスト従業員1', 'test1@example.com', 'テスト部門', 'テスター', 2500.00, '2024-01-01', true),
('TEST_EMP_002', 'テスト従業員2', 'test2@example.com', 'テスト部門', 'シニアテスター', 3000.00, '2024-01-01', true),
('TEST_EMP_003', 'テスト従業員3', 'test3@example.com', '開発部門', 'エンジニア', 3500.00, '2024-01-01', true)
ON CONFLICT (id) DO NOTHING;

-- テスト用勤怠データ
INSERT INTO time_records (id, employee_id, date, clock_in, clock_out, break_duration, record_type, created_at) VALUES
('TEST_TR_001', 'TEST_EMP_001', '2024-12-01', '2024-12-01 09:00:00', '2024-12-01 18:00:00', 60, 'manual', CURRENT_TIMESTAMP),
('TEST_TR_002', 'TEST_EMP_001', '2024-12-02', '2024-12-02 09:00:00', '2024-12-02 18:00:00', 60, 'manual', CURRENT_TIMESTAMP),
('TEST_TR_003', 'TEST_EMP_002', '2024-12-01', '2024-12-01 09:00:00', '2024-12-01 22:00:00', 60, 'manual', CURRENT_TIMESTAMP)
ON CONFLICT (id) DO NOTHING;

-- テスト用有給残高データ
INSERT INTO leave_balances (employee_id, leave_type, year, granted_days, used_days, remaining_days, created_at) VALUES
('TEST_EMP_001', 'annual', 2024, 20.0, 5.0, 15.0, CURRENT_TIMESTAMP),
('TEST_EMP_002', 'annual', 2024, 20.0, 3.0, 17.0, CURRENT_TIMESTAMP),
('TEST_EMP_003', 'annual', 2024, 20.0, 8.0, 12.0, CURRENT_TIMESTAMP)
ON CONFLICT (employee_id, leave_type, year) DO NOTHING;

-- インデックス作成確認
CREATE INDEX IF NOT EXISTS idx_employees_department ON employees(department);
CREATE INDEX IF NOT EXISTS idx_time_records_employee_date ON time_records(employee_id, date);
CREATE INDEX IF NOT EXISTS idx_leave_balances_employee_type ON leave_balances(employee_id, leave_type);

-- 統計情報更新
ANALYZE employees;
ANALYZE time_records;
ANALYZE leave_balances;