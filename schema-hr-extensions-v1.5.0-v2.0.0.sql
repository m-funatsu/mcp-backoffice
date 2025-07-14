-- HR Extension Tables for v1.5.0-v2.0.0 Features
-- Employee Lifecycle Management, Talent Management, Learning & Training, Human Capital Disclosure

-- Employee lifecycle stages table (従業員ライフサイクル管理)
CREATE TABLE IF NOT EXISTS employee_lifecycle_stages (
  id TEXT PRIMARY KEY,
  employee_id TEXT NOT NULL,
  stage TEXT CHECK (stage IN ('pre_hire', 'onboarding', 'active', 'performance_review', 'transition', 'offboarding')) NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE,
  status TEXT CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled')) DEFAULT 'pending',
  responsible_manager TEXT,
  checklist_data JSON,
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (employee_id) REFERENCES employees(id),
  FOREIGN KEY (responsible_manager) REFERENCES employees(id)
);

-- Onboarding plans table (オンボーディング計画)
CREATE TABLE IF NOT EXISTS onboarding_plans (
  id TEXT PRIMARY KEY,
  employee_id TEXT NOT NULL,
  plan_type TEXT CHECK (plan_type IN ('standard', 'manager', 'executive', 'intern')) DEFAULT 'standard',
  department_specific_items JSON,
  duration_weeks INTEGER DEFAULT 4,
  mentor_id TEXT,
  hr_contact_id TEXT,
  status TEXT CHECK (status IN ('draft', 'active', 'completed', 'cancelled')) DEFAULT 'draft',
  completion_percentage REAL DEFAULT 0.0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (employee_id) REFERENCES employees(id),
  FOREIGN KEY (mentor_id) REFERENCES employees(id),
  FOREIGN KEY (hr_contact_id) REFERENCES employees(id)
);

-- Onboarding tasks table (オンボーディングタスク)
CREATE TABLE IF NOT EXISTS onboarding_tasks (
  id TEXT PRIMARY KEY,
  onboarding_plan_id TEXT NOT NULL,
  task_name TEXT NOT NULL,
  task_description TEXT,
  task_category TEXT CHECK (task_category IN ('documentation', 'training', 'introduction', 'setup', 'assessment')) NOT NULL,
  assigned_to TEXT,
  due_date DATE,
  priority TEXT CHECK (priority IN ('low', 'medium', 'high', 'critical')) DEFAULT 'medium',
  status TEXT CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled')) DEFAULT 'pending',
  completion_date DATE,
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (onboarding_plan_id) REFERENCES onboarding_plans(id),
  FOREIGN KEY (assigned_to) REFERENCES employees(id)
);

-- Performance evaluations table (人事評価)
CREATE TABLE IF NOT EXISTS performance_evaluations (
  id TEXT PRIMARY KEY,
  employee_id TEXT NOT NULL,
  evaluator_id TEXT NOT NULL,
  evaluation_period TEXT NOT NULL, -- YYYY-MM format
  evaluation_type TEXT CHECK (evaluation_type IN ('annual', 'semi_annual', 'quarterly', 'probation', 'special')) NOT NULL,
  overall_rating REAL CHECK (overall_rating >= 1.0 AND overall_rating <= 5.0),
  performance_metrics JSON,
  strengths TEXT,
  areas_for_improvement TEXT,
  development_goals TEXT,
  career_advancement_recommendation TEXT,
  status TEXT CHECK (status IN ('draft', 'submitted', 'approved', 'finalized')) DEFAULT 'draft',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (employee_id) REFERENCES employees(id),
  FOREIGN KEY (evaluator_id) REFERENCES employees(id)
);

-- Talent profiles table (人材プロファイル)
CREATE TABLE IF NOT EXISTS talent_profiles (
  id TEXT PRIMARY KEY,
  employee_id TEXT NOT NULL,
  career_level TEXT CHECK (career_level IN ('entry', 'junior', 'mid', 'senior', 'expert', 'leadership')) NOT NULL,
  core_competencies JSON,
  technical_skills JSON,
  soft_skills JSON,
  career_aspirations TEXT,
  mobility_preferences JSON,
  performance_trend TEXT CHECK (performance_trend IN ('improving', 'stable', 'declining')) DEFAULT 'stable',
  potential_rating TEXT CHECK (potential_rating IN ('high', 'medium', 'low')) DEFAULT 'medium',
  retention_risk TEXT CHECK (retention_risk IN ('low', 'medium', 'high')) DEFAULT 'low',
  succession_readiness TEXT CHECK (succession_readiness IN ('ready_now', 'ready_1_year', 'ready_2_years', 'not_ready')) DEFAULT 'not_ready',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (employee_id) REFERENCES employees(id),
  UNIQUE(employee_id)
);

-- Development plans table (能力開発計画)
CREATE TABLE IF NOT EXISTS development_plans (
  id TEXT PRIMARY KEY,
  employee_id TEXT NOT NULL,
  plan_name TEXT NOT NULL,
  development_goals JSON,
  target_competencies JSON,
  learning_methods JSON,
  timeline_months INTEGER DEFAULT 12,
  budget_allocated DECIMAL(10,2) DEFAULT 0,
  progress_percentage REAL DEFAULT 0.0,
  status TEXT CHECK (status IN ('draft', 'active', 'completed', 'cancelled')) DEFAULT 'draft',
  created_by TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (employee_id) REFERENCES employees(id),
  FOREIGN KEY (created_by) REFERENCES employees(id)
);

-- Training courses table (研修コース)
CREATE TABLE IF NOT EXISTS training_courses (
  id TEXT PRIMARY KEY,
  course_name TEXT NOT NULL,
  course_code TEXT UNIQUE NOT NULL,
  description TEXT,
  course_type TEXT CHECK (course_type IN ('technical', 'soft_skills', 'leadership', 'compliance', 'safety', 'orientation')) NOT NULL,
  delivery_method TEXT CHECK (delivery_method IN ('online', 'in_person', 'hybrid', 'self_paced')) NOT NULL,
  duration_hours INTEGER NOT NULL,
  max_participants INTEGER,
  prerequisites TEXT,
  learning_objectives JSON,
  certification_provided BOOLEAN DEFAULT FALSE,
  cost_per_participant DECIMAL(10,2) DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Learning paths table (ラーニングパス)
CREATE TABLE IF NOT EXISTS learning_paths (
  id TEXT PRIMARY KEY,
  path_name TEXT NOT NULL,
  description TEXT,
  target_role TEXT,
  recommended_sequence JSON,
  estimated_duration_months INTEGER,
  difficulty_level TEXT CHECK (difficulty_level IN ('beginner', 'intermediate', 'advanced', 'expert')) NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Course enrollments table (コース受講登録)
CREATE TABLE IF NOT EXISTS course_enrollments (
  id TEXT PRIMARY KEY,
  employee_id TEXT NOT NULL,
  course_id TEXT NOT NULL,
  enrollment_date DATE NOT NULL,
  start_date DATE,
  target_completion_date DATE,
  actual_completion_date DATE,
  status TEXT CHECK (status IN ('enrolled', 'in_progress', 'completed', 'cancelled', 'failed')) DEFAULT 'enrolled',
  completion_percentage REAL DEFAULT 0.0,
  final_score REAL,
  certification_earned BOOLEAN DEFAULT FALSE,
  feedback TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (employee_id) REFERENCES employees(id),
  FOREIGN KEY (course_id) REFERENCES training_courses(id),
  UNIQUE(employee_id, course_id)
);

-- Skills assessments table (スキルアセスメント)
CREATE TABLE IF NOT EXISTS skills_assessments (
  id TEXT PRIMARY KEY,
  employee_id TEXT NOT NULL,
  assessment_type TEXT CHECK (assessment_type IN ('self_assessment', 'manager_assessment', 'peer_assessment', 'external_assessment')) NOT NULL,
  skill_category TEXT CHECK (skill_category IN ('technical', 'leadership', 'communication', 'problem_solving', 'teamwork')) NOT NULL,
  skill_items JSON,
  overall_score REAL CHECK (overall_score >= 1.0 AND overall_score <= 5.0),
  assessment_date DATE NOT NULL,
  assessor_id TEXT,
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (employee_id) REFERENCES employees(id),
  FOREIGN KEY (assessor_id) REFERENCES employees(id)
);

-- Employee engagement surveys table (従業員エンゲージメント調査)
CREATE TABLE IF NOT EXISTS engagement_surveys (
  id TEXT PRIMARY KEY,
  survey_name TEXT NOT NULL,
  survey_period TEXT NOT NULL, -- YYYY-MM format
  survey_questions JSON,
  target_audience TEXT CHECK (target_audience IN ('all', 'department', 'role', 'tenure')) DEFAULT 'all',
  response_rate REAL,
  status TEXT CHECK (status IN ('draft', 'active', 'closed', 'analyzed')) DEFAULT 'draft',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Survey responses table (調査回答)
CREATE TABLE IF NOT EXISTS survey_responses (
  id TEXT PRIMARY KEY,
  survey_id TEXT NOT NULL,
  employee_id TEXT NOT NULL,
  responses JSON,
  response_date DATE NOT NULL,
  overall_satisfaction REAL CHECK (overall_satisfaction >= 1.0 AND overall_satisfaction <= 5.0),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (survey_id) REFERENCES engagement_surveys(id),
  FOREIGN KEY (employee_id) REFERENCES employees(id),
  UNIQUE(survey_id, employee_id)
);

-- Human capital metrics table (人的資本指標)
CREATE TABLE IF NOT EXISTS human_capital_metrics (
  id TEXT PRIMARY KEY,
  metric_name TEXT NOT NULL,
  metric_category TEXT CHECK (metric_category IN ('workforce', 'costs', 'productivity', 'engagement', 'diversity', 'skills', 'recruitment', 'retention')) NOT NULL,
  metric_value REAL,
  metric_unit TEXT,
  calculation_method TEXT,
  reporting_period TEXT NOT NULL, -- YYYY-MM format
  benchmark_value REAL,
  is_iso30414_compliant BOOLEAN DEFAULT FALSE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Diversity and inclusion metrics table (多様性・包括性指標)
CREATE TABLE IF NOT EXISTS diversity_metrics (
  id TEXT PRIMARY KEY,
  metric_type TEXT CHECK (metric_type IN ('gender', 'age', 'nationality', 'disability', 'education', 'tenure')) NOT NULL,
  category_breakdown JSON,
  leadership_representation JSON,
  pay_equity_metrics JSON,
  reporting_period TEXT NOT NULL, -- YYYY-MM format
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Succession planning table (後継者計画)
CREATE TABLE IF NOT EXISTS succession_plans (
  id TEXT PRIMARY KEY,
  position_title TEXT NOT NULL,
  department TEXT NOT NULL,
  criticality TEXT CHECK (criticality IN ('low', 'medium', 'high', 'critical')) DEFAULT 'medium',
  succession_candidates JSON,
  readiness_assessment JSON,
  development_actions JSON,
  timeline_months INTEGER DEFAULT 12,
  status TEXT CHECK (status IN ('draft', 'active', 'completed', 'cancelled')) DEFAULT 'draft',
  created_by TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (created_by) REFERENCES employees(id)
);

-- Employee wellness records table (従業員ウェルネス記録)
CREATE TABLE IF NOT EXISTS wellness_records (
  id TEXT PRIMARY KEY,
  employee_id TEXT NOT NULL,
  wellness_type TEXT CHECK (wellness_type IN ('physical', 'mental', 'financial', 'social')) NOT NULL,
  activity_name TEXT NOT NULL,
  activity_date DATE NOT NULL,
  participation_status TEXT CHECK (participation_status IN ('registered', 'attended', 'completed', 'cancelled')) DEFAULT 'registered',
  feedback_score REAL CHECK (feedback_score >= 1.0 AND feedback_score <= 5.0),
  health_impact_score REAL CHECK (health_impact_score >= 1.0 AND health_impact_score <= 5.0),
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (employee_id) REFERENCES employees(id)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_employee_lifecycle_stages_employee ON employee_lifecycle_stages(employee_id);
CREATE INDEX IF NOT EXISTS idx_onboarding_plans_employee ON onboarding_plans(employee_id);
CREATE INDEX IF NOT EXISTS idx_performance_evaluations_employee ON performance_evaluations(employee_id);
CREATE INDEX IF NOT EXISTS idx_talent_profiles_employee ON talent_profiles(employee_id);
CREATE INDEX IF NOT EXISTS idx_development_plans_employee ON development_plans(employee_id);
CREATE INDEX IF NOT EXISTS idx_course_enrollments_employee ON course_enrollments(employee_id);
CREATE INDEX IF NOT EXISTS idx_skills_assessments_employee ON skills_assessments(employee_id);
CREATE INDEX IF NOT EXISTS idx_survey_responses_employee ON survey_responses(employee_id);
CREATE INDEX IF NOT EXISTS idx_human_capital_metrics_period ON human_capital_metrics(reporting_period);
CREATE INDEX IF NOT EXISTS idx_diversity_metrics_period ON diversity_metrics(reporting_period);
CREATE INDEX IF NOT EXISTS idx_wellness_records_employee ON wellness_records(employee_id);

-- Insert default training courses
INSERT OR IGNORE INTO training_courses (id, course_name, course_code, description, course_type, delivery_method, duration_hours, learning_objectives, certification_provided, cost_per_participant) VALUES
('COURSE_001', 'New Employee Orientation', 'NEO_001', 'Comprehensive orientation program for new hires', 'orientation', 'hybrid', 8, '["Understanding company culture", "Basic policies and procedures", "Role-specific training"]', true, 0),
('COURSE_002', 'Leadership Development Program', 'LDP_001', 'Leadership skills development for managers', 'leadership', 'in_person', 40, '["Leadership fundamentals", "Team management", "Strategic thinking"]', true, 50000),
('COURSE_003', 'Compliance Training', 'COMP_001', 'Annual compliance training for all employees', 'compliance', 'online', 2, '["Legal compliance", "Ethical guidelines", "Reporting procedures"]', true, 0),
('COURSE_004', 'Technical Skills Workshop', 'TECH_001', 'Technical skills enhancement workshop', 'technical', 'hybrid', 16, '["Technical proficiency", "Best practices", "Industry standards"]', false, 30000),
('COURSE_005', 'Communication Skills', 'COMM_001', 'Effective communication in the workplace', 'soft_skills', 'online', 6, '["Verbal communication", "Written communication", "Presentation skills"]', false, 15000);

-- Insert default learning paths
INSERT OR IGNORE INTO learning_paths (id, path_name, description, target_role, recommended_sequence, estimated_duration_months, difficulty_level) VALUES
('PATH_001', 'New Manager Development', 'Comprehensive path for new managers', 'Manager', '["COURSE_002", "COURSE_005", "COURSE_003"]', 6, 'intermediate'),
('PATH_002', 'Technical Excellence', 'Technical skills advancement path', 'Senior Engineer', '["COURSE_004", "COURSE_005"]', 4, 'advanced'),
('PATH_003', 'Leadership Excellence', 'Executive leadership development', 'Executive', '["COURSE_002", "COURSE_005"]', 12, 'expert');

-- Insert default engagement survey
INSERT OR IGNORE INTO engagement_surveys (id, survey_name, survey_period, survey_questions, target_audience, status) VALUES
('SURVEY_001', 'Annual Employee Engagement Survey 2024', '2024-12', '[
  {"question": "Overall job satisfaction", "type": "rating", "scale": 5},
  {"question": "Work-life balance satisfaction", "type": "rating", "scale": 5},
  {"question": "Career development opportunities", "type": "rating", "scale": 5},
  {"question": "Manager support", "type": "rating", "scale": 5},
  {"question": "Company culture", "type": "rating", "scale": 5}
]', 'all', 'closed');

-- Insert default human capital metrics
INSERT OR IGNORE INTO human_capital_metrics (id, metric_name, metric_category, metric_value, metric_unit, calculation_method, reporting_period, is_iso30414_compliant) VALUES
('HCM_001', 'Employee Turnover Rate', 'retention', 12.5, 'percentage', 'Annual turnover calculation', '2024-12', true),
('HCM_002', 'Training Hours per Employee', 'skills', 24.5, 'hours', 'Total training hours / employee count', '2024-12', true),
('HCM_003', 'Employee Engagement Score', 'engagement', 4.2, 'score', 'Average survey response score', '2024-12', true),
('HCM_004', 'Diversity Index', 'diversity', 0.78, 'index', 'Simpson diversity index calculation', '2024-12', true),
('HCM_005', 'Revenue per Employee', 'productivity', 125000, 'JPY', 'Total revenue / employee count', '2024-12', true);