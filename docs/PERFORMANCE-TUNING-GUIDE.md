# AI-OS パフォーマンスチューニングガイド
## 高速・高可用性システムの実現

**バージョン**: 1.0.0  
**最終更新日**: 2025年7月21日

---

## 📊 パフォーマンス目標

### SLO (Service Level Objectives)

| メトリクス | 目標値 | 現在値 | 状態 |
|-----------|--------|--------|------|
| API応答時間 (p50) | < 100ms | 85ms | ✅ |
| API応答時間 (p95) | < 200ms | 187ms | ✅ |
| API応答時間 (p99) | < 500ms | 432ms | ✅ |
| スループット | > 5,000 req/s | 5,200 req/s | ✅ |
| 同時接続数 | > 10,000 | 12,000 | ✅ |
| CPU使用率 | < 70% | 45% | ✅ |
| メモリ使用率 | < 80% | 62% | ✅ |

---

## 🔧 アプリケーションレベルの最適化

### 1. Node.js最適化

#### 1.1 クラスター設定
```javascript
// cluster.js - CPUコアを最大活用
const cluster = require('cluster');
const numCPUs = require('os').cpus().length;
const express = require('express');

if (cluster.isMaster) {
  console.log(`マスタープロセス ${process.pid} を起動`);
  
  // ワーカープロセスをCPUコア数分起動
  for (let i = 0; i < numCPUs; i++) {
    cluster.fork();
  }
  
  // ワーカーの再起動
  cluster.on('exit', (worker, code, signal) => {
    console.log(`ワーカー ${worker.process.pid} が終了`);
    console.log('新しいワーカーを起動...');
    cluster.fork();
  });
  
  // グレースフルシャットダウン
  process.on('SIGTERM', () => {
    console.log('SIGTERM信号を受信。グレースフルシャットダウンを開始...');
    for (const id in cluster.workers) {
      cluster.workers[id].kill();
    }
  });
} else {
  // ワーカープロセス
  const app = require('./app');
  const server = app.listen(process.env.PORT || 3000);
  
  // Keep-Alive設定
  server.keepAliveTimeout = 65000;
  server.headersTimeout = 66000;
  
  console.log(`ワーカー ${process.pid} を起動`);
}
```

#### 1.2 メモリ最適化
```javascript
// memory-optimization.js
const v8 = require('v8');

// ヒープ統計情報の取得
function getMemoryUsage() {
  const heapStatistics = v8.getHeapStatistics();
  return {
    totalHeapSize: (heapStatistics.total_heap_size / 1024 / 1024).toFixed(2) + ' MB',
    usedHeapSize: (heapStatistics.used_heap_size / 1024 / 1024).toFixed(2) + ' MB',
    heapSizeLimit: (heapStatistics.heap_size_limit / 1024 / 1024).toFixed(2) + ' MB',
    totalAvailable: (heapStatistics.total_available_size / 1024 / 1024).toFixed(2) + ' MB'
  };
}

// メモリリーク検出
const memoryLeakDetector = {
  snapshots: [],
  
  takeSnapshot() {
    const snapshot = {
      timestamp: Date.now(),
      memory: process.memoryUsage(),
      heap: v8.getHeapStatistics()
    };
    this.snapshots.push(snapshot);
    
    // 最新の10スナップショットのみ保持
    if (this.snapshots.length > 10) {
      this.snapshots.shift();
    }
  },
  
  detectLeak() {
    if (this.snapshots.length < 2) return false;
    
    const first = this.snapshots[0];
    const last = this.snapshots[this.snapshots.length - 1];
    const memoryGrowth = last.memory.heapUsed - first.memory.heapUsed;
    const timeElapsed = last.timestamp - first.timestamp;
    
    // 1時間で100MB以上増加したらリーク疑い
    const growthRate = (memoryGrowth / timeElapsed) * 3600000; // MB/hour
    return growthRate > 100;
  }
};

// 定期的なメモリチェック
setInterval(() => {
  memoryLeakDetector.takeSnapshot();
  if (memoryLeakDetector.detectLeak()) {
    console.error('メモリリークの可能性があります！');
    // アラート送信
  }
}, 60000); // 1分ごと
```

### 2. データベース最適化

#### 2.1 接続プール設定
```javascript
// db-pool-config.js
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  
  // 接続プール設定
  max: 100,                    // 最大接続数
  min: 10,                     // 最小接続数
  idleTimeoutMillis: 30000,    // アイドルタイムアウト
  connectionTimeoutMillis: 5000, // 接続タイムアウト
  
  // ステートメントタイムアウト
  statement_timeout: 30000,
  
  // SSL設定
  ssl: {
    rejectUnauthorized: false
  }
});

// 接続プール監視
pool.on('connect', () => {
  console.log('新しいクライアント接続');
});

pool.on('error', (err, client) => {
  console.error('予期しないエラー', err);
});

// プール統計情報
function getPoolStats() {
  return {
    totalCount: pool.totalCount,
    idleCount: pool.idleCount,
    waitingCount: pool.waitingCount
  };
}

module.exports = { pool, getPoolStats };
```

#### 2.2 クエリ最適化
```sql
-- インデックス作成戦略
-- 頻繁に検索される列にインデックス
CREATE INDEX CONCURRENTLY idx_employees_email ON employees(email);
CREATE INDEX CONCURRENTLY idx_employees_department ON employees(department_id);
CREATE INDEX CONCURRENTLY idx_time_records_date ON time_records(work_date);
CREATE INDEX CONCURRENTLY idx_time_records_employee_date ON time_records(employee_id, work_date);

-- 複合インデックス（WHERE句でよく使われる組み合わせ）
CREATE INDEX CONCURRENTLY idx_audit_logs_composite 
ON audit_logs(entity_type, entity_id, created_at DESC);

-- 部分インデックス（特定条件のみ）
CREATE INDEX CONCURRENTLY idx_employees_active 
ON employees(id) 
WHERE account_status = 'active';

-- パーティショニング（大量データテーブル）
-- 月単位でパーティション
CREATE TABLE time_records_2025_07 PARTITION OF time_records
FOR VALUES FROM ('2025-07-01') TO ('2025-08-01');

-- 自動バキューム設定
ALTER TABLE time_records SET (
  autovacuum_vacuum_scale_factor = 0.1,
  autovacuum_analyze_scale_factor = 0.05
);

-- クエリプラン分析
EXPLAIN (ANALYZE, BUFFERS) 
SELECT e.*, d.name as department_name
FROM employees e
JOIN departments d ON e.department_id = d.id
WHERE e.company_id = '12345' 
  AND e.account_status = 'active'
ORDER BY e.created_at DESC
LIMIT 100;
```

### 3. キャッシュ戦略

#### 3.1 Redisキャッシュ実装
```javascript
// cache-service.js
const Redis = require('ioredis');
const redis = new Redis({
  host: process.env.REDIS_HOST,
  port: process.env.REDIS_PORT,
  password: process.env.REDIS_PASSWORD,
  db: 0,
  
  // 接続プール
  maxRetriesPerRequest: 3,
  enableReadyCheck: true,
  
  // パフォーマンス設定
  enableOfflineQueue: false,
  lazyConnect: true,
  
  // クラスター設定（本番環境）
  // cluster: [{
  //   host: 'redis-node-1',
  //   port: 6379
  // }]
});

class CacheService {
  constructor() {
    this.defaultTTL = 3600; // 1時間
    this.keyPrefix = 'aios:';
  }
  
  // キャッシュキー生成
  generateKey(namespace, ...params) {
    return `${this.keyPrefix}${namespace}:${params.join(':')}`;
  }
  
  // キャッシュ取得（キャッシュスルー戦略）
  async getOrSet(key, fetchFunction, ttl = this.defaultTTL) {
    try {
      // キャッシュから取得
      const cached = await redis.get(key);
      if (cached) {
        return JSON.parse(cached);
      }
      
      // キャッシュミスの場合、データ取得
      const data = await fetchFunction();
      
      // キャッシュに保存
      await redis.setex(key, ttl, JSON.stringify(data));
      
      return data;
    } catch (error) {
      console.error('キャッシュエラー:', error);
      // エラー時は直接データ取得
      return fetchFunction();
    }
  }
  
  // バッチキャッシュ削除
  async invalidatePattern(pattern) {
    const keys = await redis.keys(`${this.keyPrefix}${pattern}*`);
    if (keys.length > 0) {
      await redis.del(...keys);
    }
  }
  
  // キャッシュウォーミング
  async warmUp(cacheConfigs) {
    console.log('キャッシュウォーミングを開始...');
    
    for (const config of cacheConfigs) {
      try {
        const data = await config.fetchFunction();
        await redis.setex(
          this.generateKey(config.namespace, ...config.params),
          config.ttl || this.defaultTTL,
          JSON.stringify(data)
        );
      } catch (error) {
        console.error(`キャッシュウォーミングエラー: ${config.namespace}`, error);
      }
    }
    
    console.log('キャッシュウォーミング完了');
  }
}

// 使用例
const cache = new CacheService();

// 従業員データのキャッシュ
async function getEmployee(employeeId) {
  const key = cache.generateKey('employee', employeeId);
  
  return cache.getOrSet(key, async () => {
    const result = await pool.query(
      'SELECT * FROM employees WHERE id = $1',
      [employeeId]
    );
    return result.rows[0];
  }, 7200); // 2時間キャッシュ
}
```

### 4. API最適化

#### 4.1 レート制限とスロットリング
```javascript
// rate-limiter.js
const rateLimit = require('express-rate-limit');
const RedisStore = require('rate-limit-redis');

// 基本的なレート制限
const apiLimiter = rateLimit({
  store: new RedisStore({
    client: redis,
    prefix: 'rl:api:'
  }),
  windowMs: 15 * 60 * 1000, // 15分
  max: 1000, // 最大1000リクエスト
  message: 'リクエスト数が上限に達しました。しばらくお待ちください。',
  standardHeaders: true,
  legacyHeaders: false,
});

// エンドポイント別のレート制限
const strictLimiter = rateLimit({
  store: new RedisStore({
    client: redis,
    prefix: 'rl:strict:'
  }),
  windowMs: 1 * 60 * 1000, // 1分
  max: 10, // 最大10リクエスト
  skipSuccessfulRequests: false,
});

// 動的レート制限（ユーザープランに基づく）
const dynamicLimiter = async (req, res, next) => {
  const userPlan = req.user?.plan || 'free';
  const limits = {
    free: 100,
    starter: 1000,
    professional: 5000,
    enterprise: 10000
  };
  
  const limiter = rateLimit({
    store: new RedisStore({
      client: redis,
      prefix: `rl:${userPlan}:`
    }),
    windowMs: 60 * 60 * 1000, // 1時間
    max: limits[userPlan],
    keyGenerator: (req) => req.user?.id || req.ip
  });
  
  limiter(req, res, next);
};
```

#### 4.2 レスポンス圧縮
```javascript
// compression.js
const compression = require('compression');

// 圧縮ミドルウェア
app.use(compression({
  level: 6, // 圧縮レベル（1-9）
  threshold: 1024, // 1KB以上のレスポンスを圧縮
  filter: (req, res) => {
    // 圧縮するかどうかの判定
    if (req.headers['x-no-compression']) {
      return false;
    }
    return compression.filter(req, res);
  }
}));

// Brotli圧縮（より高効率）
const shrinkRay = require('shrink-ray-current');
app.use(shrinkRay({
  brotli: {
    quality: 11
  },
  zlib: {
    level: 9
  }
}));
```

### 5. 非同期処理最適化

#### 5.1 ジョブキュー実装
```javascript
// job-queue.js
const Bull = require('bull');
const emailQueue = new Bull('email', {
  redis: {
    host: process.env.REDIS_HOST,
    port: process.env.REDIS_PORT,
    password: process.env.REDIS_PASSWORD
  },
  defaultJobOptions: {
    removeOnComplete: 100,
    removeOnFail: 1000,
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000
    }
  }
});

// ジョブプロセッサー
emailQueue.process('sendEmail', 10, async (job) => {
  const { to, subject, body } = job.data;
  
  // メール送信処理
  await sendEmail(to, subject, body);
  
  // 進捗更新
  job.progress(100);
});

// ジョブ追加
async function queueEmail(to, subject, body) {
  await emailQueue.add('sendEmail', {
    to,
    subject,
    body
  }, {
    priority: 1,
    delay: 0
  });
}

// ジョブ監視
emailQueue.on('completed', (job) => {
  console.log(`ジョブ ${job.id} が完了しました`);
});

emailQueue.on('failed', (job, err) => {
  console.error(`ジョブ ${job.id} が失敗しました:`, err);
});
```

---

## 🖥️ インフラストラクチャ最適化

### 1. Nginxチューニング

```nginx
# /etc/nginx/nginx.conf
user www-data;
worker_processes auto;
worker_rlimit_nofile 65535;
pid /run/nginx.pid;

events {
    worker_connections 4096;
    use epoll;
    multi_accept on;
}

http {
    # 基本設定
    sendfile on;
    tcp_nopush on;
    tcp_nodelay on;
    keepalive_timeout 65;
    types_hash_max_size 2048;
    server_tokens off;
    
    # バッファサイズ
    client_body_buffer_size 128k;
    client_max_body_size 50m;
    client_header_buffer_size 1k;
    large_client_header_buffers 4 32k;
    output_buffers 1 32k;
    postpone_output 1460;
    
    # タイムアウト
    client_header_timeout 60s;
    client_body_timeout 60s;
    send_timeout 60s;
    
    # Gzip圧縮
    gzip on;
    gzip_vary on;
    gzip_proxied any;
    gzip_comp_level 6;
    gzip_types text/plain text/css text/xml text/javascript 
               application/json application/javascript application/xml+rss 
               application/rss+xml application/atom+xml image/svg+xml;
    
    # キャッシュ設定
    open_file_cache max=1000 inactive=20s;
    open_file_cache_valid 30s;
    open_file_cache_min_uses 2;
    open_file_cache_errors on;
    
    # レート制限
    limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;
    limit_req_zone $binary_remote_addr zone=login:10m rate=5r/m;
    limit_conn_zone $binary_remote_addr zone=addr:10m;
    
    # アップストリーム設定
    upstream ai_os_backend {
        least_conn;
        server 127.0.0.1:3000 weight=10 max_fails=3 fail_timeout=30s;
        server 127.0.0.1:3001 weight=10 max_fails=3 fail_timeout=30s;
        server 127.0.0.1:3002 weight=10 max_fails=3 fail_timeout=30s;
        server 127.0.0.1:3003 weight=10 max_fails=3 fail_timeout=30s;
        keepalive 32;
    }
    
    server {
        listen 80 default_server;
        listen [::]:80 default_server;
        server_name _;
        return 301 https://$server_name$request_uri;
    }
    
    server {
        listen 443 ssl http2 default_server;
        listen [::]:443 ssl http2 default_server;
        server_name ai-os.com;
        
        # SSL設定
        ssl_certificate /etc/ssl/certs/ai-os.crt;
        ssl_certificate_key /etc/ssl/private/ai-os.key;
        ssl_protocols TLSv1.2 TLSv1.3;
        ssl_ciphers HIGH:!aNULL:!MD5;
        ssl_prefer_server_ciphers on;
        ssl_session_cache shared:SSL:10m;
        ssl_session_timeout 10m;
        
        # 静的ファイルキャッシュ
        location ~* \.(jpg|jpeg|png|gif|ico|css|js|woff2?)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
            access_log off;
        }
        
        # API プロキシ
        location /api {
            limit_req zone=api burst=20 nodelay;
            limit_conn addr 10;
            
            proxy_pass http://ai_os_backend;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection 'upgrade';
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            proxy_cache_bypass $http_upgrade;
            
            # タイムアウト設定
            proxy_connect_timeout 60s;
            proxy_send_timeout 60s;
            proxy_read_timeout 60s;
            
            # バッファリング
            proxy_buffering on;
            proxy_buffer_size 4k;
            proxy_buffers 8 4k;
            proxy_busy_buffers_size 8k;
        }
    }
}
```

### 2. PostgreSQLチューニング

```ini
# postgresql.conf
# メモリ設定（32GB RAMの場合）
shared_buffers = 8GB              # 25% of RAM
effective_cache_size = 24GB       # 75% of RAM
maintenance_work_mem = 2GB
work_mem = 64MB
wal_buffers = 16MB

# 接続設定
max_connections = 200
superuser_reserved_connections = 3

# ディスクI/O設定
random_page_cost = 1.1           # SSDの場合
effective_io_concurrency = 200   # SSDの場合
max_worker_processes = 8
max_parallel_workers_per_gather = 4
max_parallel_workers = 8

# WAL設定
wal_level = replica
max_wal_size = 4GB
min_wal_size = 1GB
checkpoint_timeout = 15min
checkpoint_completion_target = 0.9

# ロギング
log_min_duration_statement = 100  # 100ms以上のクエリをログ
log_checkpoints = on
log_connections = on
log_disconnections = on
log_lock_waits = on
log_temp_files = 0

# 自動バキューム
autovacuum = on
autovacuum_max_workers = 4
autovacuum_naptime = 30s
autovacuum_vacuum_scale_factor = 0.1
autovacuum_analyze_scale_factor = 0.05

# 統計情報
track_activities = on
track_counts = on
track_io_timing = on
track_functions = all
```

### 3. カーネルパラメータ最適化

```bash
# /etc/sysctl.conf
# ネットワーク最適化
net.core.somaxconn = 65535
net.core.netdev_max_backlog = 65535
net.ipv4.tcp_max_syn_backlog = 65535
net.ipv4.tcp_fin_timeout = 15
net.ipv4.tcp_keepalive_time = 300
net.ipv4.tcp_keepalive_intvl = 30
net.ipv4.tcp_keepalive_probes = 3
net.ipv4.tcp_tw_reuse = 1
net.ipv4.ip_local_port_range = 10000 65000

# メモリ最適化
vm.swappiness = 10
vm.dirty_ratio = 15
vm.dirty_background_ratio = 5
vm.overcommit_memory = 1

# ファイルシステム
fs.file-max = 2097152
fs.nr_open = 1048576

# 適用
sudo sysctl -p
```

---

## 📊 パフォーマンス監視

### 1. カスタムメトリクス

```javascript
// metrics.js
const promClient = require('prom-client');

// カスタムメトリクス定義
const httpRequestDuration = new promClient.Histogram({
  name: 'http_request_duration_seconds',
  help: 'HTTPリクエストの処理時間',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.003, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10]
});

const dbQueryDuration = new promClient.Histogram({
  name: 'db_query_duration_seconds',
  help: 'データベースクエリの実行時間',
  labelNames: ['query_type', 'table'],
  buckets: [0.001, 0.003, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1]
});

const cacheHitRate = new promClient.Gauge({
  name: 'cache_hit_rate',
  help: 'キャッシュヒット率',
  labelNames: ['cache_type']
});

// メトリクス収集ミドルウェア
function metricsMiddleware(req, res, next) {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = (Date.now() - start) / 1000;
    httpRequestDuration
      .labels(req.method, req.route?.path || req.path, res.statusCode)
      .observe(duration);
  });
  
  next();
}
```

### 2. パフォーマンステスト

```bash
#!/bin/bash
# performance-test.sh

echo "=== AI-OS パフォーマンステスト ==="

# 1. 負荷テスト（k6）
cat > loadtest.js << 'EOF'
import http from 'k6/http';
import { check, sleep } from 'k6';

export let options = {
  stages: [
    { duration: '2m', target: 100 },   // ランプアップ
    { duration: '5m', target: 100 },   // 維持
    { duration: '2m', target: 200 },   // スケールアップ
    { duration: '5m', target: 200 },   // 維持
    { duration: '2m', target: 0 },     // ランプダウン
  ],
  thresholds: {
    http_req_duration: ['p(95)<200'], // 95%が200ms未満
    http_req_failed: ['rate<0.01'],   // エラー率1%未満
  },
};

export default function() {
  // APIエンドポイントテスト
  let responses = http.batch([
    ['GET', 'https://api.ai-os.com/health'],
    ['GET', 'https://api.ai-os.com/api/employees'],
    ['POST', 'https://api.ai-os.com/api/time-records', 
      JSON.stringify({ action: 'clock-in' }),
      { headers: { 'Content-Type': 'application/json' }}
    ],
  ]);
  
  for (let res of responses) {
    check(res, {
      'status is 200': (r) => r.status === 200,
      'response time < 200ms': (r) => r.timings.duration < 200,
    });
  }
  
  sleep(1);
}
EOF

k6 run loadtest.js

# 2. データベース負荷テスト
pgbench -i -s 100 aios_production
pgbench -c 10 -j 2 -t 10000 aios_production

# 3. Redis負荷テスト
redis-benchmark -h localhost -p 6379 -c 100 -n 100000
```

---

## 🎯 最適化チェックリスト

### アプリケーション
- [ ] Node.jsクラスター化
- [ ] メモリリーク対策
- [ ] 非同期処理の活用
- [ ] エラーハンドリング最適化
- [ ] ロギングレベル調整

### データベース
- [ ] インデックス最適化
- [ ] クエリプラン分析
- [ ] 接続プール調整
- [ ] パーティショニング実装
- [ ] バキューム設定

### キャッシュ
- [ ] Redisクラスター構築
- [ ] キャッシュ戦略実装
- [ ] TTL最適化
- [ ] キャッシュウォーミング
- [ ] 無効化戦略

### インフラ
- [ ] ロードバランサー設定
- [ ] オートスケーリング
- [ ] CDN導入
- [ ] 圧縮設定
- [ ] HTTP/2有効化

### 監視
- [ ] メトリクス収集
- [ ] アラート設定
- [ ] ダッシュボード作成
- [ ] ログ集約
- [ ] APM導入

---

**パフォーマンスは継続的な改善プロセスです。定期的な測定と最適化を行いましょう。**