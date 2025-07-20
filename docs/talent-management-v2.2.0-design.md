# タレントマネジメント基盤 v2.2.0 設計書

## 1. 概要
タレントマネジメント基盤は、従業員のパフォーマンスとポテンシャルを評価し、組織の人材戦略を支援するシステムです。

## 2. 主要機能

### 2.1 9ボックスグリッド
- パフォーマンス評価（3段階: 低・中・高）
- ポテンシャル評価（3段階: 低・中・高）
- 9つのカテゴリへの分類と個別育成計画

### 2.2 後継者計画
- 重要ポジションの定義と管理
- 後継者候補の評価とプール管理
- レディネス評価と育成計画

### 2.3 キャリアパス最適化
- スキルベースマッチング
- AI駆動のキャリア推奨
- 必要スキルギャップ分析

### 2.4 組織ネットワーク分析
- コミュニケーションパターン分析
- キーパーソン特定
- チーム最適化提案

## 3. データモデル

### 3.1 タレントプロファイル (talent_profiles)
```sql
CREATE TABLE talent_profiles (
  id VARCHAR(50) PRIMARY KEY,
  employee_id VARCHAR(50) NOT NULL REFERENCES employees(id),
  performance_rating DECIMAL(3,2) NOT NULL CHECK (performance_rating BETWEEN 1 AND 5),
  potential_rating DECIMAL(3,2) NOT NULL CHECK (potential_rating BETWEEN 1 AND 5),
  nine_box_category VARCHAR(20) NOT NULL,
  assessment_date DATE NOT NULL,
  assessment_by VARCHAR(50) NOT NULL,
  
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
```

### 3.2 後継者計画 (succession_plans)
```sql
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
```

### 3.3 キャリアパス (career_paths)
```sql
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
```

### 3.4 組織ネットワーク (organization_networks)
```sql
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
```

## 4. API設計

### 4.1 タレントプロファイルAPI
- `POST /api/talent/profiles` - タレントプロファイル作成
- `GET /api/talent/profiles/:employeeId` - プロファイル取得
- `PUT /api/talent/profiles/:profileId` - プロファイル更新
- `GET /api/talent/nine-box` - 9ボックスグリッドデータ取得

### 4.2 後継者計画API
- `POST /api/succession/plans` - 後継者計画作成
- `GET /api/succession/plans/:positionId` - 計画取得
- `POST /api/succession/candidates` - 候補者追加
- `GET /api/succession/readiness-dashboard` - レディネスダッシュボード

### 4.3 キャリアパスAPI
- `POST /api/career/paths/recommend` - AI推奨キャリアパス生成
- `GET /api/career/paths/:employeeId` - キャリアパス取得
- `PUT /api/career/paths/:pathId/progress` - 進捗更新

### 4.4 組織ネットワークAPI
- `POST /api/network/analyze` - ネットワーク分析実行
- `GET /api/network/influencers` - インフルエンサー取得
- `GET /api/network/teams/optimize` - チーム最適化提案

## 5. 実装優先順位
1. データモデルとデータベース構築
2. 9ボックスグリッド機能
3. 後継者計画機能
4. キャリアパス最適化
5. 組織ネットワーク分析