/**
 * AI-OS v3.2.0 APIサーバー
 * エンタープライズコンソール用のREST APIサーバー
 */

import express, { Express } from 'express';
import cors from 'cors';
import { Pool } from 'pg';
import dotenv from 'dotenv';
import v3_2_0Router, { initializeV3_2_0_API } from './v3.2.0/api/routes/v3.2.0-endpoints.js';

dotenv.config();

class APIServer {
  private app: Express;
  private db: Pool;
  private port: number;

  constructor() {
    this.app = express();
    this.port = parseInt(process.env.API_PORT || '3001');
    
    // PostgreSQL接続プールの設定
    this.db = new Pool({
      connectionString: process.env.DATABASE_URL || 'postgresql://aiuser:aipass123@localhost:5432/ai_native_hr_platform',
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });

    this.setupMiddleware();
    this.setupRoutes();
  }

  private setupMiddleware(): void {
    // CORS設定
    this.app.use(cors({
      origin: [
        'http://localhost:5173',
        'http://localhost:5174',
        'http://localhost:3000',
        process.env.FRONTEND_URL || 'http://localhost:5173'
      ],
      credentials: true,
    }));

    // JSONパーサー
    this.app.use(express.json({ limit: '50mb' }));
    this.app.use(express.urlencoded({ extended: true }));

    // リクエストログ
    this.app.use((req, res, next) => {
      console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
      next();
    });
  }

  private setupRoutes(): void {
    // ヘルスチェック
    this.app.get('/health', (req, res) => {
      res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        version: '3.2.0',
      });
    });

    // v3.2.0 APIの初期化と登録
    initializeV3_2_0_API(this.db);
    this.app.use('/api/v3.2.0', v3_2_0Router);

    // 404ハンドラー
    this.app.use((req, res) => {
      res.status(404).json({
        error: 'Not Found',
        message: `The requested resource ${req.path} was not found`,
      });
    });

    // エラーハンドラー
    this.app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
      console.error('Server Error:', err);
      res.status(err.status || 500).json({
        error: err.message || 'Internal Server Error',
        code: err.code,
      });
    });
  }

  public async start(): Promise<void> {
    try {
      // データベース接続テスト
      await this.db.query('SELECT NOW()');
      console.log('✅ Database connection established');

      // サーバー起動
      this.app.listen(this.port, () => {
        console.log(`🚀 AI-OS API Server v3.2.0 is running on http://localhost:${this.port}`);
        console.log(`📍 API Endpoints: http://localhost:${this.port}/api/v3.2.0`);
        console.log(`🏥 Health Check: http://localhost:${this.port}/health`);
      });
    } catch (error) {
      console.error('❌ Failed to start server:', error);
      process.exit(1);
    }
  }

  public async stop(): Promise<void> {
    await this.db.end();
    console.log('API Server stopped');
  }
}

// サーバーの起動
if (import.meta.url === `file://${process.argv[1]}`) {
  const server = new APIServer();
  
  // グレースフルシャットダウン
  process.on('SIGTERM', async () => {
    console.log('SIGTERM received, shutting down gracefully');
    await server.stop();
    process.exit(0);
  });

  process.on('SIGINT', async () => {
    console.log('SIGINT received, shutting down gracefully');
    await server.stop();
    process.exit(0);
  });

  server.start().catch(console.error);
}

export default APIServer;