-- スキル管理システム v2.3.0 データベーススキーマ
-- AI駆動スキル最適化・学習推奨エンジン対応

-- 1. スキルオントロジー（マスターデータ）
CREATE TABLE skill_ontology (
  id VARCHAR(50) PRIMARY KEY,
  skill_name VARCHAR(100) NOT NULL UNIQUE,
  skill_code VARCHAR(50) UNIQUE,
  category VARCHAR(50) NOT NULL,
  subcategory VARCHAR(50),
  skill_type VARCHAR(20) NOT NULL CHECK (skill_type IN ('technical', 'soft', 'leadership', 'business', 'certification')),
  
  -- スキル詳細
  description TEXT,
  industry_standard BOOLEAN DEFAULT FALSE,
  difficulty_level INTEGER CHECK (difficulty_level BETWEEN 1 AND 5),
  
  -- 市場データ
  market_demand_score DECIMAL(3,2),
  average_salary_impact DECIMAL(5,2),
  future_relevance_score DECIMAL(3,2),
  
  -- 関連性
  parent_skill_id VARCHAR(50) REFERENCES skill_ontology(id),
  prerequisites JSON, -- Array of skill_ids
  related_skills JSON, -- Array of skill_ids with relevance scores
  
  -- メタデータ
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. 詳細なスキル評価
CREATE TABLE skill_assessments (
  id VARCHAR(50) PRIMARY KEY,
  employee_id VARCHAR(50) NOT NULL REFERENCES employees(id),
  skill_id VARCHAR(50) NOT NULL REFERENCES skill_ontology(id),
  
  -- 多面的評価
  self_assessment_level INTEGER CHECK (self_assessment_level BETWEEN 1 AND 5),
  manager_assessment_level INTEGER CHECK (manager_assessment_level BETWEEN 1 AND 5),
  peer_assessment_level INTEGER CHECK (peer_assessment_level BETWEEN 1 AND 5),
  test_score_level INTEGER CHECK (test_score_level BETWEEN 1 AND 5),
  
  -- 統合評価
  overall_proficiency_level DECIMAL(3,2) NOT NULL CHECK (overall_proficiency_level BETWEEN 1 AND 5),
  confidence_score DECIMAL(3,2), -- 評価の信頼度
  
  -- 経験・実績
  years_of_experience DECIMAL(3,1),
  last_used_date DATE,
  usage_frequency VARCHAR(20) CHECK (usage_frequency IN ('daily', 'weekly', 'monthly', 'rarely')),
  project_count INTEGER DEFAULT 0,
  
  -- 検証
  verification_method VARCHAR(50),
  verification_date DATE,
  verified_by VARCHAR(50),
  certification_id VARCHAR(50),
  certification_expiry_date DATE,
  
  -- 成長追跡
  previous_level DECIMAL(3,2),
  improvement_rate DECIMAL(5,2),
  
  assessment_date DATE NOT NULL,
  next_assessment_date DATE,
  notes TEXT,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  UNIQUE(employee_id, skill_id, assessment_date)
);

-- 3. スキルギャップ分析
CREATE TABLE skill_gap_analysis (
  id VARCHAR(50) PRIMARY KEY,
  employee_id VARCHAR(50) NOT NULL REFERENCES employees(id),
  analysis_date DATE NOT NULL,
  analysis_type VARCHAR(50) NOT NULL, -- 'role_based', 'career_path', 'market_trend', 'team_optimization'
  
  -- ターゲット
  target_role VARCHAR(200),
  target_level VARCHAR(50),
  comparison_group VARCHAR(100),
  
  -- ギャップ詳細
  identified_gaps JSON, -- Array of {skill_id, current_level, required_level, gap_size, priority}
  strength_areas JSON, -- Array of {skill_id, level, percentile}
  
  -- 推奨事項
  development_priorities JSON, -- Ordered array of skill_ids
  estimated_time_to_close_gaps INTEGER, -- in months
  recommended_learning_path JSON,
  
  -- AI分析
  ai_insights TEXT,
  market_alignment_score DECIMAL(3,2),
  competitive_advantage_score DECIMAL(3,2),
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 4. 学習リソース
CREATE TABLE learning_resources (
  id VARCHAR(50) PRIMARY KEY,
  resource_name VARCHAR(200) NOT NULL,
  resource_type VARCHAR(50) NOT NULL CHECK (resource_type IN ('course', 'book', 'video', 'workshop', 'mentoring', 'project', 'certification')),
  provider VARCHAR(100),
  
  -- リソース詳細
  description TEXT,
  url VARCHAR(500),
  duration_hours DECIMAL(5,1),
  difficulty_level INTEGER CHECK (difficulty_level BETWEEN 1 AND 5),
  language VARCHAR(10) DEFAULT 'ja',
  
  -- コスト
  cost DECIMAL(10,2),
  currency VARCHAR(3) DEFAULT 'JPY',
  
  -- 効果測定
  average_rating DECIMAL(3,2),
  completion_rate DECIMAL(5,2),
  skill_improvement_rate DECIMAL(5,2),
  
  -- スキルマッピング
  target_skills JSON, -- Array of {skill_id, relevance_score}
  prerequisites JSON, -- Array of skill_ids
  
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 5. 学習推奨・進捗
CREATE TABLE learning_recommendations (
  id VARCHAR(50) PRIMARY KEY,
  employee_id VARCHAR(50) NOT NULL REFERENCES employees(id),
  skill_id VARCHAR(50) NOT NULL REFERENCES skill_ontology(id),
  resource_id VARCHAR(50) NOT NULL REFERENCES learning_resources(id),
  
  -- 推奨理由
  recommendation_reason VARCHAR(200),
  relevance_score DECIMAL(3,2),
  priority VARCHAR(20) CHECK (priority IN ('critical', 'high', 'medium', 'low')),
  
  -- 個人化
  personalization_factors JSON, -- learning_style, time_availability, budget, etc.
  estimated_completion_date DATE,
  
  -- ステータス
  status VARCHAR(50) DEFAULT 'recommended' CHECK (status IN ('recommended', 'enrolled', 'in_progress', 'completed', 'abandoned')),
  enrollment_date DATE,
  completion_date DATE,
  
  -- 効果測定
  pre_assessment_level DECIMAL(3,2),
  post_assessment_level DECIMAL(3,2),
  skill_improvement DECIMAL(5,2),
  
  feedback_rating INTEGER CHECK (feedback_rating BETWEEN 1 AND 5),
  feedback_comments TEXT,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 6. スキルマーケットプレイス
CREATE TABLE skill_marketplace (
  id VARCHAR(50) PRIMARY KEY,
  
  -- 供給側（スキル保有者）
  provider_id VARCHAR(50) NOT NULL REFERENCES employees(id),
  skill_id VARCHAR(50) NOT NULL REFERENCES skill_ontology(id),
  proficiency_level DECIMAL(3,2) NOT NULL,
  
  -- 提供内容
  offering_type VARCHAR(50) CHECK (offering_type IN ('mentoring', 'training', 'project_support', 'consultation')),
  availability_hours_per_week DECIMAL(3,1),
  preferred_schedule JSON,
  
  -- 需要側の要件
  min_engagement_hours DECIMAL(5,1),
  max_learners INTEGER,
  
  -- 実績
  sessions_completed INTEGER DEFAULT 0,
  total_hours_provided DECIMAL(7,1) DEFAULT 0,
  average_rating DECIMAL(3,2),
  
  -- ステータス
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'paused', 'fully_booked', 'inactive')),
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  UNIQUE(provider_id, skill_id)
);

CREATE TABLE skill_marketplace_transactions (
  id VARCHAR(50) PRIMARY KEY,
  marketplace_id VARCHAR(50) NOT NULL REFERENCES skill_marketplace(id),
  learner_id VARCHAR(50) NOT NULL REFERENCES employees(id),
  
  -- トランザクション詳細
  transaction_type VARCHAR(50),
  scheduled_date DATE,
  duration_hours DECIMAL(3,1),
  
  -- ステータス
  status VARCHAR(50) CHECK (status IN ('scheduled', 'completed', 'cancelled', 'no_show')),
  
  -- フィードバック
  learner_rating INTEGER CHECK (learner_rating BETWEEN 1 AND 5),
  provider_rating INTEGER CHECK (provider_rating BETWEEN 1 AND 5),
  learner_feedback TEXT,
  provider_feedback TEXT,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 7. ROI測定
CREATE TABLE skill_roi_metrics (
  id VARCHAR(50) PRIMARY KEY,
  employee_id VARCHAR(50) NOT NULL REFERENCES employees(id),
  measurement_period_start DATE NOT NULL,
  measurement_period_end DATE NOT NULL,
  
  -- 投資
  total_learning_hours DECIMAL(7,1),
  total_learning_cost DECIMAL(10,2),
  opportunity_cost DECIMAL(10,2), -- 学習に費やした時間の機会費用
  
  -- リターン
  performance_improvement DECIMAL(5,2),
  productivity_gain DECIMAL(5,2),
  project_success_rate_change DECIMAL(5,2),
  
  -- 定量的効果
  revenue_impact DECIMAL(12,2),
  cost_savings DECIMAL(12,2),
  efficiency_gain_hours DECIMAL(7,1),
  
  -- 定性的効果
  innovation_score_change DECIMAL(5,2),
  collaboration_score_change DECIMAL(5,2),
  
  -- ROI計算
  roi_percentage DECIMAL(7,2),
  payback_period_months INTEGER,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- インデックス
CREATE INDEX idx_skill_ontology_category ON skill_ontology(category);
CREATE INDEX idx_skill_ontology_type ON skill_ontology(skill_type);
CREATE INDEX idx_skill_ontology_demand ON skill_ontology(market_demand_score);

CREATE INDEX idx_skill_assessments_employee ON skill_assessments(employee_id);
CREATE INDEX idx_skill_assessments_skill ON skill_assessments(skill_id);
CREATE INDEX idx_skill_assessments_date ON skill_assessments(assessment_date);
CREATE INDEX idx_skill_assessments_proficiency ON skill_assessments(overall_proficiency_level);

CREATE INDEX idx_skill_gap_employee ON skill_gap_analysis(employee_id);
CREATE INDEX idx_skill_gap_date ON skill_gap_analysis(analysis_date);

CREATE INDEX idx_learning_resources_type ON learning_resources(resource_type);
CREATE INDEX idx_learning_resources_skills ON learning_resources(target_skills);

CREATE INDEX idx_learning_recommendations_employee ON learning_recommendations(employee_id);
CREATE INDEX idx_learning_recommendations_status ON learning_recommendations(status);
CREATE INDEX idx_learning_recommendations_priority ON learning_recommendations(priority);

CREATE INDEX idx_skill_marketplace_provider ON skill_marketplace(provider_id);
CREATE INDEX idx_skill_marketplace_skill ON skill_marketplace(skill_id);
CREATE INDEX idx_skill_marketplace_status ON skill_marketplace(status);

CREATE INDEX idx_skill_roi_employee ON skill_roi_metrics(employee_id);
CREATE INDEX idx_skill_roi_period ON skill_roi_metrics(measurement_period_start, measurement_period_end);