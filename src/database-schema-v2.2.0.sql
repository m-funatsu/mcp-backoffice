-- タレントマネジメント基盤 v2.2.0 データベーススキーマ

-- 1. タレントプロファイル
CREATE TABLE talent_profiles (
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

-- 2. 後継者計画
CREATE TABLE succession_plans (
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

CREATE TABLE succession_candidates (
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

-- 3. キャリアパス
CREATE TABLE career_paths (
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
  path_steps JSON, -- Array of positions and timeline
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

-- 4. 組織ネットワーク
CREATE TABLE organization_networks (
  id VARCHAR(50) PRIMARY KEY,
  analysis_date DATE NOT NULL,
  analysis_type VARCHAR(50) NOT NULL,
  
  -- ネットワークメトリクス
  network_density DECIMAL(3,2),
  clustering_coefficient DECIMAL(3,2),
  average_path_length DECIMAL(5,2),
  
  -- 結果
  key_influencers JSON, -- Array of employee_ids with influence scores
  bridge_employees JSON, -- Employees connecting different groups
  isolated_employees JSON,
  collaboration_clusters JSON,
  
  recommendations JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE employee_connections (
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

-- 5. スキル管理（v2.3.0で詳細実装予定）
CREATE TABLE employee_skills (
  id VARCHAR(50) PRIMARY KEY,
  employee_id VARCHAR(50) NOT NULL REFERENCES employees(id),
  skill_name VARCHAR(100) NOT NULL,
  skill_category VARCHAR(50) NOT NULL,
  proficiency_level INTEGER NOT NULL CHECK (proficiency_level BETWEEN 1 AND 5),
  assessed_date DATE,
  assessed_by VARCHAR(50),
  verification_status VARCHAR(20) DEFAULT 'self_reported',
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  UNIQUE(employee_id, skill_name)
);

-- インデックス
CREATE INDEX idx_talent_profiles_employee_id ON talent_profiles(employee_id);
CREATE INDEX idx_talent_profiles_assessment_date ON talent_profiles(assessment_date);
CREATE INDEX idx_talent_profiles_nine_box_category ON talent_profiles(nine_box_category);

CREATE INDEX idx_succession_plans_position_id ON succession_plans(position_id);
CREATE INDEX idx_succession_plans_department ON succession_plans(department);
CREATE INDEX idx_succession_candidates_plan_id ON succession_candidates(succession_plan_id);

CREATE INDEX idx_career_paths_employee_id ON career_paths(employee_id);
CREATE INDEX idx_career_paths_status ON career_paths(status);

CREATE INDEX idx_employee_connections_from_emp ON employee_connections(from_employee_id);
CREATE INDEX idx_employee_connections_to_emp ON employee_connections(to_employee_id);

CREATE INDEX idx_employee_skills_employee_id ON employee_skills(employee_id);
CREATE INDEX idx_employee_skills_category ON employee_skills(skill_category);