-- ジェネレーティブUI v3.1.0 データベーススキーマ
-- 自然言語理解・動的UI生成・学習機能対応

-- 1. UI生成履歴
CREATE TABLE ui_generation_history (
  id VARCHAR(50) PRIMARY KEY,
  user_id VARCHAR(50) NOT NULL,
  session_id VARCHAR(50),
  
  -- 入力情報
  user_input TEXT NOT NULL,
  input_language VARCHAR(10) DEFAULT 'ja',
  device_type VARCHAR(20),
  device_info JSON,
  
  -- 意図理解結果
  parsed_intent JSON NOT NULL, -- primary, secondary, confidence, parameters, entities
  intent_confidence DECIMAL(3,2),
  ambiguities JSON,
  
  -- 生成結果
  generated_ui_id VARCHAR(50) NOT NULL,
  layout_structure VARCHAR(50),
  component_count INTEGER,
  generation_time_ms INTEGER,
  
  -- コンテキスト
  user_context JSON, -- role, permissions, preferences
  generation_context JSON, -- currentPage, recentActions
  
  -- 成否
  generation_status VARCHAR(20) CHECK (generation_status IN ('success', 'fallback', 'clarification', 'error')),
  error_message TEXT,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. UI対話履歴
CREATE TABLE ui_interactions (
  id VARCHAR(50) PRIMARY KEY,
  user_id VARCHAR(50) NOT NULL,
  ui_generation_id VARCHAR(50) REFERENCES ui_generation_history(id),
  
  -- インタラクション詳細
  interaction_type VARCHAR(50) NOT NULL, -- click, input, scroll, voice, gesture
  component_id VARCHAR(50),
  interaction_data JSON,
  
  -- タイミング
  interaction_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  time_since_generation INTEGER, -- milliseconds
  
  -- 結果
  result_status VARCHAR(20),
  next_action VARCHAR(100)
);

-- 3. UIフィードバック
CREATE TABLE ui_feedback (
  id VARCHAR(50) PRIMARY KEY,
  ui_generation_id VARCHAR(50) NOT NULL REFERENCES ui_generation_history(id),
  user_id VARCHAR(50) NOT NULL,
  
  -- 評価
  rating INTEGER CHECK (rating BETWEEN 1 AND 5),
  feedback_type VARCHAR(50) CHECK (feedback_type IN ('helpful', 'confusing', 'error', 'suggestion')),
  
  -- 詳細フィードバック
  comments TEXT,
  specific_issues JSON, -- Array of {component_id, issue_type, description}
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

-- 4. ユーザープリファレンス学習
CREATE TABLE ui_user_preferences_learned (
  id VARCHAR(50) PRIMARY KEY,
  user_id VARCHAR(50) NOT NULL UNIQUE,
  
  -- 学習された嗜好
  preferred_layout_density VARCHAR(20), -- compact, comfortable, spacious
  preferred_chart_types JSON, -- {context: chartType} mapping
  preferred_interaction_mode VARCHAR(50), -- click, voice, keyboard
  preferred_data_views JSON, -- frequently accessed data types
  
  -- 行動パターン
  common_queries JSON, -- Array of frequent query patterns
  peak_usage_hours JSON, -- Array of hour ranges
  average_session_duration INTEGER, -- minutes
  feature_usage_frequency JSON, -- {feature: usage_count}
  
  -- パーソナライゼーション
  color_scheme_preference VARCHAR(50),
  notification_preferences JSON,
  shortcut_customizations JSON,
  
  -- 学習メトリクス
  data_points_collected INTEGER,
  last_learning_update TIMESTAMP,
  confidence_score DECIMAL(3,2),
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 5. コンポーネント使用統計
CREATE TABLE ui_component_analytics (
  id VARCHAR(50) PRIMARY KEY,
  component_type VARCHAR(50) NOT NULL,
  component_configuration JSON,
  
  -- 使用統計
  total_renders INTEGER DEFAULT 0,
  successful_interactions INTEGER DEFAULT 0,
  error_count INTEGER DEFAULT 0,
  abandonment_count INTEGER DEFAULT 0,
  
  -- パフォーマンス
  average_render_time_ms DECIMAL(7,2),
  p95_render_time_ms DECIMAL(7,2),
  average_interaction_time_ms DECIMAL(7,2),
  
  -- 効果測定
  task_completion_rate DECIMAL(5,2),
  user_satisfaction_avg DECIMAL(3,2),
  accessibility_score DECIMAL(3,2),
  
  -- デバイス別統計
  mobile_usage_percentage DECIMAL(5,2),
  tablet_usage_percentage DECIMAL(5,2),
  desktop_usage_percentage DECIMAL(5,2),
  
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 6. 自然言語パターン学習
CREATE TABLE nlp_pattern_learning (
  id VARCHAR(50) PRIMARY KEY,
  
  -- パターン識別
  input_pattern TEXT NOT NULL,
  pattern_type VARCHAR(50), -- query, command, clarification
  language VARCHAR(10) DEFAULT 'ja',
  
  -- 意図マッピング
  mapped_intent VARCHAR(100) NOT NULL,
  intent_parameters JSON,
  success_rate DECIMAL(5,2),
  
  -- 使用統計
  occurrence_count INTEGER DEFAULT 1,
  last_seen TIMESTAMP,
  unique_users INTEGER DEFAULT 1,
  
  -- 学習状態
  is_verified BOOLEAN DEFAULT FALSE,
  verified_by VARCHAR(50),
  verification_date DATE,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  UNIQUE(input_pattern, language)
);

-- 7. A/Bテスト結果
CREATE TABLE ui_ab_test_results (
  id VARCHAR(50) PRIMARY KEY,
  test_name VARCHAR(200) NOT NULL,
  test_description TEXT,
  
  -- テスト設定
  variant_a_config JSON NOT NULL,
  variant_b_config JSON NOT NULL,
  
  -- 対象
  target_user_segment VARCHAR(100),
  total_participants INTEGER,
  
  -- 結果メトリクス
  variant_a_participants INTEGER,
  variant_b_participants INTEGER,
  
  variant_a_conversion_rate DECIMAL(5,2),
  variant_b_conversion_rate DECIMAL(5,2),
  
  variant_a_avg_time_on_task DECIMAL(7,2),
  variant_b_avg_time_on_task DECIMAL(7,2),
  
  variant_a_satisfaction_score DECIMAL(3,2),
  variant_b_satisfaction_score DECIMAL(3,2),
  
  -- 統計的有意性
  p_value DECIMAL(5,4),
  confidence_level DECIMAL(5,2),
  
  -- 結論
  winning_variant CHAR(1),
  recommendation TEXT,
  
  test_start_date DATE NOT NULL,
  test_end_date DATE,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 8. エラーログ・回復履歴
CREATE TABLE ui_error_recovery_log (
  id VARCHAR(50) PRIMARY KEY,
  error_id VARCHAR(50) NOT NULL,
  user_id VARCHAR(50),
  ui_generation_id VARCHAR(50),
  
  -- エラー情報
  error_type VARCHAR(100) NOT NULL,
  error_message TEXT,
  error_stack TEXT,
  error_context JSON,
  
  -- 回復試行
  recovery_attempts INTEGER DEFAULT 0,
  recovery_strategy VARCHAR(100),
  recovery_success BOOLEAN DEFAULT FALSE,
  
  -- フォールバック
  fallback_ui_generated BOOLEAN DEFAULT FALSE,
  fallback_ui_id VARCHAR(50),
  
  error_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  recovery_timestamp TIMESTAMP,
  
  -- 分析用
  user_impact_level VARCHAR(20), -- none, minor, major, critical
  requires_fix BOOLEAN DEFAULT TRUE,
  fix_deployed BOOLEAN DEFAULT FALSE
);

-- インデックス
CREATE INDEX idx_ui_generation_user ON ui_generation_history(user_id);
CREATE INDEX idx_ui_generation_status ON ui_generation_history(generation_status);
CREATE INDEX idx_ui_generation_created ON ui_generation_history(created_at);
CREATE INDEX idx_ui_generation_intent ON ui_generation_history(parsed_intent);

CREATE INDEX idx_ui_interactions_user ON ui_interactions(user_id);
CREATE INDEX idx_ui_interactions_generation ON ui_interactions(ui_generation_id);
CREATE INDEX idx_ui_interactions_type ON ui_interactions(interaction_type);

CREATE INDEX idx_ui_feedback_generation ON ui_feedback(ui_generation_id);
CREATE INDEX idx_ui_feedback_rating ON ui_feedback(rating);
CREATE INDEX idx_ui_feedback_type ON ui_feedback(feedback_type);

CREATE INDEX idx_ui_preferences_user ON ui_user_preferences_learned(user_id);

CREATE INDEX idx_component_analytics_type ON ui_component_analytics(component_type);
CREATE INDEX idx_component_analytics_period ON ui_component_analytics(period_start, period_end);

CREATE INDEX idx_nlp_pattern_intent ON nlp_pattern_learning(mapped_intent);
CREATE INDEX idx_nlp_pattern_language ON nlp_pattern_learning(language);

CREATE INDEX idx_ab_test_dates ON ui_ab_test_results(test_start_date, test_end_date);

CREATE INDEX idx_error_recovery_type ON ui_error_recovery_log(error_type);
CREATE INDEX idx_error_recovery_timestamp ON ui_error_recovery_log(error_timestamp);