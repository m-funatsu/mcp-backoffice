import { check, sleep } from 'k6';
import http from 'k6/http';
import { Rate, Trend } from 'k6/metrics';
import { randomItem } from 'https://jslib.k6.io/k6-utils/1.2.0/index.js';

/**
 * k6負荷テストシナリオ
 * 実際の使用パターンをシミュレート
 */

// カスタムメトリクス
const loginErrorRate = new Rate('login_errors');
const apiErrorRate = new Rate('api_errors');
const payrollDuration = new Trend('payroll_calculation_duration');
const complianceDuration = new Trend('compliance_check_duration');
const uiGenerationDuration = new Trend('ui_generation_duration');

// テスト設定
export const options = {
  scenarios: {
    // 通常時負荷（平日朝の打刻ラッシュ）
    morning_rush: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '2m', target: 100 }, // 2分で100ユーザーまで増加
        { duration: '5m', target: 500 }, // 5分で500ユーザーまで増加
        { duration: '10m', target: 500 }, // 10分間500ユーザーを維持
        { duration: '3m', target: 0 }, // 3分で0まで減少
      ],
      gracefulRampDown: '30s',
      startTime: '0s',
    },
    
    // 月末給与計算負荷
    payroll_processing: {
      executor: 'per-vu-iterations',
      vus: 50,
      iterations: 10,
      maxDuration: '30m',
      startTime: '20m',
    },
    
    // 継続的な通常アクセス
    steady_load: {
      executor: 'constant-vus',
      vus: 100,
      duration: '60m',
      startTime: '0s',
    },
    
    // スパイクテスト
    spike_test: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '10s', target: 1000 }, // 急激に1000ユーザーまで増加
        { duration: '1m', target: 1000 }, // 1分間維持
        { duration: '10s', target: 0 }, // 急激に減少
      ],
      startTime: '50m',
    },
  },
  
  thresholds: {
    http_req_duration: ['p(95)<500'], // 95%のリクエストが500ms以内
    http_req_failed: ['rate<0.05'], // エラー率5%未満
    login_errors: ['rate<0.01'], // ログインエラー率1%未満
    api_errors: ['rate<0.02'], // APIエラー率2%未満
    payroll_calculation_duration: ['p(95)<10000'], // 給与計算95%が10秒以内
    compliance_check_duration: ['p(95)<5000'], // コンプライアンスチェック95%が5秒以内
    ui_generation_duration: ['p(95)<1000'], // UI生成95%が1秒以内
  },
};

// 環境設定
const BASE_URL = __ENV.BASE_URL || 'https://api.ai-hr-platform.jp';
const API_VERSION = '/v1';

// テストデータ
const departments = ['営業部', '開発部', '人事部', '経理部', '製造部'];
const testUsers = generateTestUsers(1000);

export function setup() {
  // グローバル設定やテストデータの準備
  console.log('負荷テスト開始: ' + new Date().toISOString());
  return { startTime: Date.now() };
}

export default function (data) {
  const user = randomItem(testUsers);
  const scenario = __ENV.scenario;
  
  switch (scenario) {
    case 'morning_rush':
      morningRushScenario(user);
      break;
    case 'payroll_processing':
      payrollProcessingScenario(user);
      break;
    case 'steady_load':
      steadyLoadScenario(user);
      break;
    case 'spike_test':
      spikeTestScenario(user);
      break;
    default:
      steadyLoadScenario(user);
  }
}

// シナリオ1: 朝の打刻ラッシュ
function morningRushScenario(user) {
  // ログイン
  const loginRes = http.post(`${BASE_URL}${API_VERSION}/auth/login`, JSON.stringify({
    email: user.email,
    password: user.password
  }), {
    headers: { 'Content-Type': 'application/json' },
  });
  
  loginErrorRate.add(loginRes.status !== 200);
  check(loginRes, {
    'ログイン成功': (r) => r.status === 200,
    'トークン取得': (r) => r.json('access_token') !== undefined,
  });
  
  if (loginRes.status !== 200) return;
  
  const token = loginRes.json('access_token');
  const headers = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
  
  // 出勤打刻
  const clockInRes = http.post(`${BASE_URL}${API_VERSION}/time-records`, JSON.stringify({
    employee_id: user.id,
    record_type: 'clock_in',
    timestamp: new Date().toISOString(),
    location: {
      latitude: 35.6762 + (Math.random() - 0.5) * 0.1,
      longitude: 139.6503 + (Math.random() - 0.5) * 0.1,
    },
    device_type: 'mobile'
  }), { headers });
  
  apiErrorRate.add(clockInRes.status !== 201);
  check(clockInRes, {
    '打刻成功': (r) => r.status === 201,
    'コンプライアンスチェック通過': (r) => r.json('compliance_check.passed') === true,
  });
  
  sleep(1);
  
  // ダッシュボード取得
  const dashboardRes = http.get(`${BASE_URL}${API_VERSION}/dashboard/employee/${user.id}`, { headers });
  check(dashboardRes, {
    'ダッシュボード取得成功': (r) => r.status === 200,
  });
}

// シナリオ2: 月末給与計算
function payrollProcessingScenario(user) {
  if (user.role !== 'hr_admin' && user.role !== 'manager') return;
  
  // 管理者ログイン
  const loginRes = http.post(`${BASE_URL}${API_VERSION}/auth/login`, JSON.stringify({
    email: user.email,
    password: user.password
  }), {
    headers: { 'Content-Type': 'application/json' },
  });
  
  if (loginRes.status !== 200) return;
  
  const token = loginRes.json('access_token');
  const headers = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
  
  // 部門の従業員リスト取得
  const employeesRes = http.get(`${BASE_URL}${API_VERSION}/employees?department=${user.department}&limit=50`, { headers });
  
  if (employeesRes.status !== 200) return;
  
  const employees = employeesRes.json('data');
  
  // バッチ給与計算
  const startTime = Date.now();
  const payrollRes = http.post(`${BASE_URL}${API_VERSION}/payroll/calculate/batch`, JSON.stringify({
    employee_ids: employees.map(e => e.id),
    period: '2025-07',
    include_bonuses: false
  }), { headers });
  
  const duration = Date.now() - startTime;
  payrollDuration.add(duration);
  
  check(payrollRes, {
    '給与計算バッチ成功': (r) => r.status === 200,
    '処理時間10秒以内': (r) => duration < 10000,
  });
  
  sleep(2);
}

// シナリオ3: 通常の業務アクセス
function steadyLoadScenario(user) {
  // ログイン（セッションがない場合）
  const token = authenticateUser(user);
  if (!token) return;
  
  const headers = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
  
  // ランダムなアクションを実行
  const action = Math.random();
  
  if (action < 0.3) {
    // 勤怠記録確認
    const timeRecordsRes = http.get(
      `${BASE_URL}${API_VERSION}/time-records?employee_id=${user.id}&start_date=2025-07-01&end_date=2025-07-31`,
      { headers }
    );
    check(timeRecordsRes, {
      '勤怠記録取得成功': (r) => r.status === 200,
    });
    
  } else if (action < 0.5) {
    // 経費申請
    const expenseRes = http.post(`${BASE_URL}${API_VERSION}/expenses`, JSON.stringify({
      employee_id: user.id,
      amount: Math.floor(Math.random() * 10000) + 1000,
      category: 'transportation',
      expense_date: new Date().toISOString().split('T')[0],
      description: '客先訪問交通費',
    }), { headers });
    
    check(expenseRes, {
      '経費申請成功': (r) => r.status === 201,
    });
    
  } else if (action < 0.7) {
    // 人的資本ダッシュボード
    const hcRes = http.get(`${BASE_URL}${API_VERSION}/human-capital/dashboard`, { headers });
    check(hcRes, {
      '人的資本ダッシュボード取得成功': (r) => r.status === 200,
    });
    
  } else if (action < 0.9) {
    // コンプライアンスチェック
    const startTime = Date.now();
    const complianceRes = http.post(`${BASE_URL}${API_VERSION}/compliance/check`, JSON.stringify({
      employee_id: user.id,
      period: {
        start: '2025-07-01',
        end: '2025-07-31'
      },
      check_types: ['overtime_36', 'break_time']
    }), { headers });
    
    const duration = Date.now() - startTime;
    complianceDuration.add(duration);
    
    check(complianceRes, {
      'コンプライアンスチェック成功': (r) => r.status === 200,
    });
    
  } else {
    // ジェネレーティブUI
    const startTime = Date.now();
    const uiRes = http.post(`${BASE_URL}${API_VERSION}/ui/generate`, JSON.stringify({
      query: getRandomQuery(),
      context: {
        user_id: user.id,
        role: user.role,
        department: user.department
      }
    }), { headers });
    
    const duration = Date.now() - startTime;
    uiGenerationDuration.add(duration);
    
    check(uiRes, {
      'UI生成成功': (r) => r.status === 200,
      'UI生成1秒以内': (r) => duration < 1000,
    });
  }
  
  sleep(randomBetween(1, 5));
}

// シナリオ4: スパイクテスト
function spikeTestScenario(user) {
  // 最小限の処理でサーバーに負荷をかける
  const token = authenticateUser(user);
  if (!token) return;
  
  const headers = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
  
  // 軽量なAPIを連続して呼び出す
  for (let i = 0; i < 5; i++) {
    http.get(`${BASE_URL}${API_VERSION}/health`, { headers });
  }
}

// ヘルパー関数
function authenticateUser(user) {
  const loginRes = http.post(`${BASE_URL}${API_VERSION}/auth/login`, JSON.stringify({
    email: user.email,
    password: user.password
  }), {
    headers: { 'Content-Type': 'application/json' },
  });
  
  if (loginRes.status !== 200) {
    loginErrorRate.add(1);
    return null;
  }
  
  loginErrorRate.add(0);
  return loginRes.json('access_token');
}

function generateTestUsers(count) {
  const roles = ['employee', 'manager', 'hr_admin'];
  const users = [];
  
  for (let i = 0; i < count; i++) {
    users.push({
      id: `emp${String(i + 1).padStart(5, '0')}`,
      email: `test${i + 1}@example.com`,
      password: 'Test123!',
      role: roles[i % 10 === 0 ? 2 : i % 5 === 0 ? 1 : 0],
      department: departments[i % departments.length]
    });
  }
  
  return users;
}

function getRandomQuery() {
  const queries = [
    '今月の残業時間を教えて',
    '有給残日数を確認したい',
    '部門別の人員構成を見せて',
    '今年度の研修実施状況',
    'チームの生産性指標'
  ];
  return randomItem(queries);
}

function randomBetween(min, max) {
  return Math.random() * (max - min) + min;
}

export function teardown(data) {
  const duration = (Date.now() - data.startTime) / 1000;
  console.log(`負荷テスト完了: ${duration}秒`);
}