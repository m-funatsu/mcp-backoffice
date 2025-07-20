# スキル管理システム v2.3.0 設計書

## 1. 概要
スキル管理システムは、従業員のスキル習得・評価・認定を体系的に管理し、組織のスキル可視化とリスキリング戦略を支援するシステムです。

## 2. 戦略的価値
- **スキルベース人材配置**: タレントマネジメントとの連携
- **リスキリング推進**: 将来必要スキルの予測と学習推奨
- **スキルオントロジー**: 業界標準スキル分類の採用
- **スキルマーケットプレイス**: 社内スキル流動化の促進

## 3. 主要機能

### 3.1 スキルオントロジー管理
- **階層的スキル分類**: カテゴリ→サブカテゴリ→具体的スキル
- **業界標準対応**: O*NET、LinkedInスキル、AWS認定等
- **スキル関連性マッピング**: 類似・前提・発展スキルの関係定義
- **トレンド分析**: 市場需要に基づくスキル価値評価

### 3.2 スキル評価・認定システム
- **多角的評価**: 自己申告・上司評価・同僚評価・客観テスト
- **習熟度レベル**: 5段階評価（基礎→熟練→エキスパート）
- **認定管理**: 資格・証明書・バッジの統合管理
- **継続評価**: 定期的な再評価とスキル劣化検知

### 3.3 学習推奨エンジン
- **個別最適化学習パス**: AI駆動の学習ルート推奨
- **スキルギャップ予測**: 将来必要スキルとの差分分析
- **学習リソース統合**: 内部・外部コンテンツの一元管理
- **ROI測定**: 学習投資対効果の定量化

### 3.4 スキルマーケットプレイス
- **スキル検索・マッチング**: プロジェクトとスキルのマッチング
- **内部コンサルティング**: スキル保有者の社内共有
- **メンタリングネットワーク**: スキル保有者と学習者の接続
- **スキル交換プログラム**: 相互学習の促進

## 4. データモデル

### 4.1 スキルオントロジー (skill_ontology)
```sql
CREATE TABLE skill_ontology (
  id VARCHAR(50) PRIMARY KEY,
  skill_name VARCHAR(200) NOT NULL,
  skill_code VARCHAR(50) UNIQUE, -- 国際標準コード対応
  category VARCHAR(100) NOT NULL,
  subcategory VARCHAR(100),
  level INTEGER NOT NULL CHECK (level BETWEEN 1 AND 5), -- 階層レベル
  
  -- 分類情報
  skill_type VARCHAR(50) NOT NULL CHECK (skill_type IN (
    'technical', 'soft', 'leadership', 'business', 'certification'
  )),
  complexity_level VARCHAR(20) CHECK (complexity_level IN (
    'beginner', 'intermediate', 'advanced', 'expert'
  )),
  
  -- 市場情報
  market_demand_score DECIMAL(3,2), -- 1-5
  growth_trend VARCHAR(20) CHECK (growth_trend IN (
    'declining', 'stable', 'growing', 'high_growth'
  )),
  average_learning_hours INTEGER,
  
  -- メタデータ
  description TEXT,
  prerequisites JSON, -- Array of prerequisite skill IDs
  related_skills JSON, -- Array of related skill IDs
  obsolescence_risk DECIMAL(3,2), -- 1-5
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  UNIQUE(skill_name, category)
);
```

### 4.2 従業員スキル評価 (employee_skill_assessments)
```sql
CREATE TABLE employee_skill_assessments (
  id VARCHAR(50) PRIMARY KEY,
  employee_id VARCHAR(50) NOT NULL REFERENCES employees(id),
  skill_id VARCHAR(50) NOT NULL REFERENCES skill_ontology(id),
  
  -- 評価情報
  proficiency_level INTEGER NOT NULL CHECK (proficiency_level BETWEEN 1 AND 5),
  confidence_score DECIMAL(3,2), -- 1-5 自信度
  assessment_method VARCHAR(50) NOT NULL CHECK (assessment_method IN (
    'self_assessment', 'manager_review', 'peer_review', 
    'objective_test', 'certification', 'project_demonstration'
  )),
  
  -- 評価詳細
  assessed_by VARCHAR(50),
  assessment_date DATE NOT NULL,
  evidence_type VARCHAR(50), -- 'certification', 'project', 'test_score'
  evidence_details JSON,
  verification_status VARCHAR(20) DEFAULT 'pending' CHECK (verification_status IN (
    'pending', 'verified', 'disputed', 'expired'
  )),
  
  -- 学習履歴
  learning_hours INTEGER DEFAULT 0,
  last_used_date DATE,
  skill_acquired_date DATE,
  next_review_date DATE,
  
  -- スコアリング
  weighted_score DECIMAL(4,2), -- 複数評価の加重平均
  reliability_score DECIMAL(3,2), -- 評価の信頼性
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  UNIQUE(employee_id, skill_id, assessment_date)
);
```

### 4.3 学習リソース (learning_resources)
```sql
CREATE TABLE learning_resources (
  id VARCHAR(50) PRIMARY KEY,
  title VARCHAR(300) NOT NULL,
  provider VARCHAR(200) NOT NULL,
  resource_type VARCHAR(50) NOT NULL CHECK (resource_type IN (
    'course', 'certification', 'book', 'video', 'workshop', 
    'mentoring', 'project', 'conference'
  )),
  
  -- リソース詳細
  duration_hours INTEGER,
  difficulty_level VARCHAR(20) CHECK (difficulty_level IN (
    'beginner', 'intermediate', 'advanced'
  )),
  cost DECIMAL(10,2),
  language VARCHAR(10) DEFAULT 'ja',
  format VARCHAR(50), -- 'online', 'classroom', 'hybrid', 'self_paced'
  
  -- 品質指標
  rating DECIMAL(3,2), -- 1-5
  completion_rate DECIMAL(5,2), -- percentage
  effectiveness_score DECIMAL(3,2), -- 1-5
  
  -- 対象スキル
  target_skills JSON, -- Array of skill IDs
  prerequisites JSON, -- Array of prerequisite skill IDs
  learning_outcomes JSON, -- Array of expected outcomes
  
  -- アクセス情報
  url TEXT,
  access_requirements TEXT,
  availability_status VARCHAR(20) DEFAULT 'available',
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### 4.4 学習計画・進捗 (learning_plans)
```sql
CREATE TABLE learning_plans (
  id VARCHAR(50) PRIMARY KEY,
  employee_id VARCHAR(50) NOT NULL REFERENCES employees(id),
  plan_name VARCHAR(200) NOT NULL,
  plan_type VARCHAR(50) NOT NULL CHECK (plan_type IN (
    'career_development', 'skill_gap_closure', 'certification_prep',
    'role_transition', 'performance_improvement'
  )),
  
  -- 計画詳細
  target_skills JSON, -- Array of {skill_id, target_level}
  estimated_duration_months INTEGER,
  budget_allocated DECIMAL(10,2),
  priority_level VARCHAR(20) CHECK (priority_level IN (
    'low', 'medium', 'high', 'critical'
  )),
  
  -- ステータス
  status VARCHAR(20) DEFAULT 'draft' CHECK (status IN (
    'draft', 'approved', 'in_progress', 'completed', 'cancelled'
  )),
  progress_percentage DECIMAL(5,2) DEFAULT 0,
  
  -- 日程
  start_date DATE,
  target_completion_date DATE,
  actual_completion_date DATE,
  
  -- 承認情報
  approved_by VARCHAR(50),
  approved_date DATE,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE learning_plan_resources (
  id VARCHAR(50) PRIMARY KEY,
  learning_plan_id VARCHAR(50) NOT NULL REFERENCES learning_plans(id),
  resource_id VARCHAR(50) NOT NULL REFERENCES learning_resources(id),
  sequence_order INTEGER,
  completion_status VARCHAR(20) DEFAULT 'not_started' CHECK (completion_status IN (
    'not_started', 'in_progress', 'completed', 'skipped'
  )),
  completion_date DATE,
  rating DECIMAL(3,2), -- 1-5
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  UNIQUE(learning_plan_id, resource_id)
);
```

### 4.5 スキルマーケットプレイス (skill_marketplace)
```sql
CREATE TABLE skill_requests (
  id VARCHAR(50) PRIMARY KEY,
  requester_id VARCHAR(50) NOT NULL REFERENCES employees(id),
  project_id VARCHAR(50),
  
  -- 要求詳細
  required_skills JSON, -- Array of {skill_id, min_level, importance}
  request_title VARCHAR(200) NOT NULL,
  description TEXT,
  duration_estimate VARCHAR(100),
  time_commitment VARCHAR(100), -- '10h/week', 'full-time', etc.
  
  -- 条件
  urgency VARCHAR(20) CHECK (urgency IN ('low', 'medium', 'high', 'urgent')),
  location_requirements VARCHAR(100),
  remote_work_allowed BOOLEAN DEFAULT TRUE,
  
  -- ステータス
  status VARCHAR(20) DEFAULT 'open' CHECK (status IN (
    'open', 'matched', 'in_progress', 'completed', 'cancelled'
  )),
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE skill_offers (
  id VARCHAR(50) PRIMARY KEY,
  skill_request_id VARCHAR(50) NOT NULL REFERENCES skill_requests(id),
  provider_id VARCHAR(50) NOT NULL REFERENCES employees(id),
  
  -- オファー詳細
  offered_skills JSON, -- Array of {skill_id, level, confidence}
  availability VARCHAR(100),
  rate_type VARCHAR(20) CHECK (rate_type IN ('hourly', 'daily', 'project', 'free')),
  proposed_rate DECIMAL(10,2),
  
  -- ステータス
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN (
    'pending', 'accepted', 'rejected', 'withdrawn'
  )),
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

## 5. API設計

### 5.1 スキル管理API
- `GET /api/skills/ontology` - スキルオントロジー取得
- `POST /api/skills/assessment` - スキル評価登録
- `GET /api/skills/employee/:id` - 従業員スキルプロファイル取得
- `POST /api/skills/gap-analysis` - スキルギャップ分析実行

### 5.2 学習管理API
- `POST /api/learning/plan` - 学習計画作成
- `GET /api/learning/recommendations/:employeeId` - 学習推奨取得
- `POST /api/learning/progress` - 学習進捗更新
- `GET /api/learning/resources/search` - 学習リソース検索

### 5.3 スキルマーケットプレイスAPI
- `POST /api/marketplace/request` - スキル要求投稿
- `GET /api/marketplace/offers` - スキルオファー検索
- `POST /api/marketplace/match` - マッチング実行
- `GET /api/marketplace/dashboard` - マーケットプレイスダッシュボード

## 6. AI・ML機能

### 6.1 スキル推奨アルゴリズム
- **協調フィルタリング**: 類似従業員の学習パターン分析
- **コンテンツベースフィルタリング**: スキル関連性に基づく推奨
- **強化学習**: 学習成果に基づく推奨アルゴリズム最適化

### 6.2 スキルトレンド予測
- **市場データ分析**: 求人情報・給与データからのトレンド予測
- **組織内需要予測**: プロジェクト計画・事業戦略からの需要予測
- **スキル obsolescence予測**: 技術進歩に基づく陳腐化リスク評価

### 6.3 学習効果測定
- **ROI算出**: 学習投資対効果の定量化
- **パフォーマンス相関**: スキル習得と業績向上の相関分析
- **最適学習パス**: 個人特性に基づく効率的学習順序提案

## 7. 実装優先順位

### Phase 1: 基盤構築（1-2ヶ月）
1. スキルオントロジーデータベース構築
2. 基本的なスキル評価機能
3. 従業員スキルプロファイル表示

### Phase 2: 学習管理（2-3ヶ月）
1. 学習リソース管理
2. 学習計画作成・進捗管理
3. スキルギャップ分析

### Phase 3: AI機能（3-4ヶ月）
1. 学習推奨エンジン
2. スキルトレンド分析
3. 学習効果測定

### Phase 4: マーケットプレイス（4-5ヶ月）
1. スキル要求・オファー機能
2. マッチングアルゴリズム
3. レーティング・フィードバック

## 8. 統合ポイント

### 8.1 タレントマネジメント連携
- 9ボックスグリッド評価でのスキル要素反映
- 後継者計画でのスキル要件マッチング
- キャリアパス推奨でのスキル成長軸考慮

### 8.2 エージェント連携
- スキル評価の自動実行
- 学習推奨の自動配信
- マーケットプレイスマッチングの自動化

### 8.3 外部システム連携
- LinkedIn Learning統合
- Coursera for Business連携
- 社内LMS統合
- 人事評価システム連携

## 9. 成功指標

### 9.1 定量指標
- スキル評価カバレッジ: 95%以上
- 学習計画実行率: 80%以上
- スキルマッチング精度: 85%以上
- 学習ROI: 150%以上

### 9.2 定性指標
- 従業員スキル可視性向上
- 学習モチベーション向上
- 社内スキル流動性促進
- リスキリング文化醸成