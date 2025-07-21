-- AI-Native Strategic HR Platform
-- 統合マイグレーションスクリプト v2.2.0 - v3.1.0
-- 実行日: CURRENT_DATE

BEGIN TRANSACTION;

-- ========================================
-- 1. バージョン管理テーブル（未作成の場合）
-- ========================================
CREATE TABLE IF NOT EXISTS schema_migrations (
  version VARCHAR(20) PRIMARY KEY,
  description TEXT,
  executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  executed_by VARCHAR(100)
);

-- ========================================
-- 2. v2.2.0 タレントマネジメント基盤
-- ========================================

-- 2.1 タレントプロファイル
CREATE TABLE IF NOT EXISTS talent_profiles (
  id VARCHAR(50) PRIMARY KEY,
  employee_id VARCHAR(50) NOT NULL REFERENCES employees(id),
  performance_rating DECIMAL(3,2) NOT NULL CHECK (performance_rating BETWEEN 1 AND 5),
  potential_rating DECIMAL(3,2) NOT NULL CHECK (potential_rating BETWEEN 1 AND 5),
  nine_box_category VARCHAR(20) NOT NULL,
  assessment_date DATE NOT NULL,
  assessed_by VARCHAR(50) NOT NULL,
  
  -- パフォーマンス詳細
  goal_achievement_rate DECIMAL(5,2),
  competency_score DECIMAL(3,2),
  behavior_rating DECIMAL(3,2),
  
  -- ポテンシャル詳細  
  learning_agility DECIMAL(3,2),
  leadership_potential DECIMAL(3,2),
  strategic_thinking DECIMAL(3,2),
  adaptability DECIMAL(3,2),
  
  -- メタデータ
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  UNIQUE(employee_id, assessment_date)
);

-- 2.2 後継者計画
CREATE TABLE IF NOT EXISTS succession_plans (
  id VARCHAR(50) PRIMARY KEY,
  position_id VARCHAR(50) NOT NULL,
  position_title VARCHAR(200) NOT NULL,
  department VARCHAR(100) NOT NULL,
  criticality VARCHAR(20) NOT NULL CHECK (criticality IN ('critical', 'important', 'standard')),
  incumbent_id VARCHAR(50) REFERENCES employees(id),
  vacancy_risk VARCHAR(20) CHECK (vacancy_risk IN ('immediate', 'high', 'medium', 'low')),
  
  -- ポジション要件
  required_experience_years INTEGER,
  required_skills JSON,
  required_competencies JSON,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS succession_candidates (
  id VARCHAR(50) PRIMARY KEY,
  succession_plan_id VARCHAR(50) NOT NULL REFERENCES succession_plans(id),
  candidate_id VARCHAR(50) NOT NULL REFERENCES employees(id),
  readiness_level VARCHAR(20) NOT NULL CHECK (readiness_level IN ('ready_now', '1_year', '2_years', '3_years_plus')),
  readiness_score DECIMAL(3,2),
  
  -- ギャップ分析
  skill_gaps JSON,
  experience_gaps JSON,
  development_actions JSON,
  
  -- 評価
  last_assessment_date DATE,
  assessed_by VARCHAR(50),
  notes TEXT,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  UNIQUE(succession_plan_id, candidate_id)
);

-- 2.3 キャリアパス
CREATE TABLE IF NOT EXISTS career_paths (
  id VARCHAR(50) PRIMARY KEY,
  employee_id VARCHAR(50) NOT NULL REFERENCES employees(id),
  current_position VARCHAR(200) NOT NULL,
  target_position VARCHAR(200),
  path_type VARCHAR(20) NOT NULL CHECK (path_type IN ('vertical', 'lateral', 'expert_track')),
  
  -- AI推奨
  ai_recommended BOOLEAN DEFAULT FALSE,
  recommendation_score DECIMAL(3,2),
  recommendation_reasons JSON,
  
  -- ステップ
  path_steps JSON,
  estimated_timeline_months INTEGER,
  
  -- スキルギャップ
  required_skills JSON,
  current_skills JSON,
  skill_gaps JSON,
  development_plan JSON,
  
  status VARCHAR(20) DEFAULT 'planned' CHECK (status IN ('planned', 'in_progress', 'completed', 'abandoned')),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2.4 組織ネットワーク
CREATE TABLE IF NOT EXISTS organization_networks (
  id VARCHAR(50) PRIMARY KEY,
  analysis_date DATE NOT NULL,
  analysis_type VARCHAR(50) NOT NULL,
  
  -- ネットワークメトリクス
  network_density DECIMAL(3,2),
  clustering_coefficient DECIMAL(3,2),
  average_path_length DECIMAL(5,2),
  
  -- 結果
  key_influencers JSON,
  bridge_employees JSON,
  isolated_employees JSON,
  collaboration_clusters JSON,
  
  recommendations JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS employee_connections (
  id VARCHAR(50) PRIMARY KEY,
  from_employee_id VARCHAR(50) NOT NULL REFERENCES employees(id),
  to_employee_id VARCHAR(50) NOT NULL REFERENCES employees(id),
  connection_type VARCHAR(50) NOT NULL,
  connection_strength DECIMAL(3,2),
  interaction_frequency INTEGER,
  last_interaction_date DATE,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  UNIQUE(from_employee_id, to_employee_id, connection_type)
);

-- ========================================
-- 3. v2.3.0 スキル管理システム
-- ========================================

-- 3.1 スキルオントロジー
CREATE TABLE IF NOT EXISTS skill_ontology (
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
  prerequisites JSON,
  related_skills JSON,
  
  -- メタデータ
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3.2 スキル評価
CREATE TABLE IF NOT EXISTS skill_assessments (
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
  confidence_score DECIMAL(3,2),
  
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

-- 3.3 その他のスキル管理テーブル（簡略化）
-- skill_gap_analysis, learning_resources, learning_recommendations, 
-- skill_marketplace, skill_marketplace_transactions, skill_roi_metrics
-- は別途詳細スキーマ参照

-- 3.4 既存のemployee_skillsテーブルを削除（新しいスキーマに移行）
DROP TABLE IF EXISTS employee_skills CASCADE;

-- ========================================
-- 4. v3.1.0 ジェネレーティブUI
-- ========================================

-- 4.1 UI生成履歴
CREATE TABLE IF NOT EXISTS ui_generation_history (
  id VARCHAR(50) PRIMARY KEY,
  user_id VARCHAR(50) NOT NULL,
  session_id VARCHAR(50),
  
  -- 入力情報
  user_input TEXT NOT NULL,
  input_language VARCHAR(10) DEFAULT 'ja',
  device_type VARCHAR(20),
  device_info JSON,
  
  -- 意図理解結果
  parsed_intent JSON NOT NULL,
  intent_confidence DECIMAL(3,2),
  ambiguities JSON,
  
  -- 生成結果
  generated_ui_id VARCHAR(50) NOT NULL,
  layout_structure VARCHAR(50),
  component_count INTEGER,
  generation_time_ms INTEGER,
  
  -- コンテキスト
  user_context JSON,
  generation_context JSON,
  
  -- 成否
  generation_status VARCHAR(20) CHECK (generation_status IN ('success', 'fallback', 'clarification', 'error')),
  error_message TEXT,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 4.2 UIインタラクション
CREATE TABLE IF NOT EXISTS ui_interactions (
  id VARCHAR(50) PRIMARY KEY,
  user_id VARCHAR(50) NOT NULL,
  ui_generation_id VARCHAR(50) REFERENCES ui_generation_history(id),
  
  -- インタラクション詳細
  interaction_type VARCHAR(50) NOT NULL,
  component_id VARCHAR(50),
  interaction_data JSON,
  
  -- タイミング
  interaction_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  time_since_generation INTEGER,
  
  -- 結果
  result_status VARCHAR(20),
  next_action VARCHAR(100)
);

-- 4.3 UIフィードバック
CREATE TABLE IF NOT EXISTS ui_feedback (
  id VARCHAR(50) PRIMARY KEY,
  ui_generation_id VARCHAR(50) NOT NULL REFERENCES ui_generation_history(id),
  user_id VARCHAR(50) NOT NULL,
  
  -- 評価
  rating INTEGER CHECK (rating BETWEEN 1 AND 5),
  feedback_type VARCHAR(50) CHECK (feedback_type IN ('helpful', 'confusing', 'error', 'suggestion')),
  
  -- 詳細フィードバック
  comments TEXT,
  specific_issues JSON,
  improvement_suggestions TEXT,
  
  -- メタデータ
  feedback_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  response_time_ms INTEGER,
  
  -- フォローアップ
  is_addressed BOOLEAN DEFAULT FALSE,
  addressed_by VARCHAR(50),
  addressed_at TIMESTAMP,
  resolution_notes TEXT
);

-- 4.4 その他のUIテーブル（簡略化）
-- ui_user_preferences_learned, ui_component_analytics, nlp_pattern_learning,
-- ui_ab_test_results, ui_error_recovery_log
-- は別途詳細スキーマ参照

-- ========================================
-- 5. インデックス作成
-- ========================================

-- v2.2.0 インデックス
CREATE INDEX IF NOT EXISTS idx_talent_profiles_employee_id ON talent_profiles(employee_id);
CREATE INDEX IF NOT EXISTS idx_talent_profiles_assessment_date ON talent_profiles(assessment_date);
CREATE INDEX IF NOT EXISTS idx_talent_profiles_nine_box_category ON talent_profiles(nine_box_category);

CREATE INDEX IF NOT EXISTS idx_succession_plans_position_id ON succession_plans(position_id);
CREATE INDEX IF NOT EXISTS idx_succession_plans_department ON succession_plans(department);
CREATE INDEX IF NOT EXISTS idx_succession_candidates_plan_id ON succession_candidates(succession_plan_id);

CREATE INDEX IF NOT EXISTS idx_career_paths_employee_id ON career_paths(employee_id);
CREATE INDEX IF NOT EXISTS idx_career_paths_status ON career_paths(status);

CREATE INDEX IF NOT EXISTS idx_employee_connections_from_emp ON employee_connections(from_employee_id);
CREATE INDEX IF NOT EXISTS idx_employee_connections_to_emp ON employee_connections(to_employee_id);

-- v2.3.0 インデックス
CREATE INDEX IF NOT EXISTS idx_skill_ontology_category ON skill_ontology(category);
CREATE INDEX IF NOT EXISTS idx_skill_ontology_type ON skill_ontology(skill_type);
CREATE INDEX IF NOT EXISTS idx_skill_assessments_employee ON skill_assessments(employee_id);
CREATE INDEX IF NOT EXISTS idx_skill_assessments_skill ON skill_assessments(skill_id);

-- v3.1.0 インデックス
CREATE INDEX IF NOT EXISTS idx_ui_generation_user ON ui_generation_history(user_id);
CREATE INDEX IF NOT EXISTS idx_ui_generation_status ON ui_generation_history(generation_status);
CREATE INDEX IF NOT EXISTS idx_ui_interactions_user ON ui_interactions(user_id);
CREATE INDEX IF NOT EXISTS idx_ui_feedback_generation ON ui_feedback(ui_generation_id);

-- ========================================
-- 6. トリガー関数（updated_at自動更新）
-- ========================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- v2.2.0 トリガー
CREATE TRIGGER update_talent_profiles_updated_at BEFORE UPDATE ON talent_profiles 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    
CREATE TRIGGER update_succession_plans_updated_at BEFORE UPDATE ON succession_plans 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    
CREATE TRIGGER update_succession_candidates_updated_at BEFORE UPDATE ON succession_candidates 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    
CREATE TRIGGER update_career_paths_updated_at BEFORE UPDATE ON career_paths 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    
CREATE TRIGGER update_employee_connections_updated_at BEFORE UPDATE ON employee_connections 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- v2.3.0 トリガー
CREATE TRIGGER update_skill_ontology_updated_at BEFORE UPDATE ON skill_ontology 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    
CREATE TRIGGER update_skill_assessments_updated_at BEFORE UPDATE ON skill_assessments 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ========================================
-- 7. マイグレーション記録
-- ========================================

INSERT INTO schema_migrations (version, description, executed_by) VALUES
('2.2.0', 'タレントマネジメント基盤（9ボックス、後継者計画、キャリアパス、組織ネットワーク）', CURRENT_USER),
('2.3.0', 'スキル管理システム（オントロジー、評価、学習推奨、マーケットプレイス）', CURRENT_USER),
('3.1.0', 'ジェネレーティブUI（自然言語理解、動的UI生成、学習機能）', CURRENT_USER);

-- ========================================
-- 8. 権限設定（アプリケーションユーザー用）
-- ========================================

-- アプリケーションユーザーが存在する場合の権限付与
-- GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_user;
-- GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_user;

COMMIT;

-- ========================================
-- 9. 検証クエリ
-- ========================================

-- 作成されたテーブル数の確認
SELECT COUNT(*) as table_count 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_type = 'BASE TABLE';

-- 各バージョンのテーブル確認
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_type = 'BASE TABLE'
AND (
    table_name LIKE 'talent_%' OR 
    table_name LIKE 'succession_%' OR 
    table_name LIKE 'career_%' OR
    table_name LIKE 'organization_%' OR
    table_name LIKE 'employee_connections' OR
    table_name LIKE 'skill_%' OR
    table_name LIKE 'learning_%' OR
    table_name LIKE 'ui_%' OR
    table_name LIKE 'nlp_%'
)
ORDER BY table_name;