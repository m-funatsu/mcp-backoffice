/**
 * AI-OS JavaScript SDK
 * @version 1.0.0
 * @description AI-OSプラットフォームとの統合を簡単にするためのJavaScript SDK
 */

class AIOSClient {
  constructor(config = {}) {
    this.apiKey = config.apiKey || process.env.AIOS_API_KEY;
    this.baseUrl = config.baseUrl || 'https://api.ai-os.com';
    this.version = config.version || 'v1';
    this.timeout = config.timeout || 30000;
    this.retryAttempts = config.retryAttempts || 3;
    this.retryDelay = config.retryDelay || 1000;
    
    if (!this.apiKey) {
      throw new Error('APIキーが必要です。configまたは環境変数AIOS_API_KEYで設定してください。');
    }
  }

  /**
   * HTTPリクエストを実行
   * @private
   */
  async _request(method, endpoint, data = null, options = {}) {
    const url = `${this.baseUrl}/api/${this.version}${endpoint}`;
    const headers = {
      'Authorization': `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
      'X-SDK-Version': '1.0.0',
      'X-SDK-Language': 'JavaScript',
      ...options.headers
    };

    const config = {
      method,
      headers,
      timeout: this.timeout,
      ...options
    };

    if (data && ['POST', 'PUT', 'PATCH'].includes(method)) {
      config.body = JSON.stringify(data);
    }

    let lastError;
    for (let attempt = 0; attempt < this.retryAttempts; attempt++) {
      try {
        const response = await fetch(url, config);
        
        if (!response.ok) {
          const error = await response.json();
          throw new AIOSError(error.message || 'APIエラー', response.status, error);
        }
        
        return await response.json();
      } catch (error) {
        lastError = error;
        if (attempt < this.retryAttempts - 1) {
          await this._sleep(this.retryDelay * Math.pow(2, attempt));
        }
      }
    }
    
    throw lastError;
  }

  /**
   * スリープユーティリティ
   * @private
   */
  _sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 従業員管理
   */
  get employees() {
    return {
      /**
       * 全従業員の取得
       * @param {Object} params - クエリパラメータ
       * @returns {Promise<Array>} 従業員リスト
       */
      list: async (params = {}) => {
        const queryString = new URLSearchParams(params).toString();
        return this._request('GET', `/employees${queryString ? '?' + queryString : ''}`);
      },

      /**
       * 従業員の詳細取得
       * @param {string} employeeId - 従業員ID
       * @returns {Promise<Object>} 従業員情報
       */
      get: async (employeeId) => {
        return this._request('GET', `/employees/${employeeId}`);
      },

      /**
       * 従業員の作成
       * @param {Object} data - 従業員データ
       * @returns {Promise<Object>} 作成された従業員
       */
      create: async (data) => {
        return this._request('POST', '/employees', data);
      },

      /**
       * 従業員の更新
       * @param {string} employeeId - 従業員ID
       * @param {Object} data - 更新データ
       * @returns {Promise<Object>} 更新された従業員
       */
      update: async (employeeId, data) => {
        return this._request('PUT', `/employees/${employeeId}`, data);
      },

      /**
       * 従業員の削除
       * @param {string} employeeId - 従業員ID
       * @returns {Promise<void>}
       */
      delete: async (employeeId) => {
        return this._request('DELETE', `/employees/${employeeId}`);
      }
    };
  }

  /**
   * 勤怠管理
   */
  get timeRecords() {
    return {
      /**
       * 打刻
       * @param {Object} data - 打刻データ
       * @returns {Promise<Object>} 打刻結果
       */
      clock: async (data) => {
        return this._request('POST', '/time-records/clock', data);
      },

      /**
       * 出勤打刻
       * @param {string} employeeId - 従業員ID
       * @returns {Promise<Object>} 打刻結果
       */
      clockIn: async (employeeId) => {
        return this._request('POST', '/time-records/clock-in', { employeeId });
      },

      /**
       * 退勤打刻
       * @param {string} employeeId - 従業員ID
       * @returns {Promise<Object>} 打刻結果
       */
      clockOut: async (employeeId) => {
        return this._request('POST', '/time-records/clock-out', { employeeId });
      },

      /**
       * 勤怠記録の取得
       * @param {Object} params - クエリパラメータ
       * @returns {Promise<Array>} 勤怠記録リスト
       */
      list: async (params = {}) => {
        const queryString = new URLSearchParams(params).toString();
        return this._request('GET', `/time-records${queryString ? '?' + queryString : ''}`);
      },

      /**
       * 月次勤怠サマリー取得
       * @param {string} employeeId - 従業員ID
       * @param {string} yearMonth - 年月（YYYY-MM）
       * @returns {Promise<Object>} 月次サマリー
       */
      getMonthlySummary: async (employeeId, yearMonth) => {
        return this._request('GET', `/time-records/summary/${employeeId}/${yearMonth}`);
      }
    };
  }

  /**
   * 給与管理
   */
  get payroll() {
    return {
      /**
       * 給与計算実行
       * @param {Object} data - 計算パラメータ
       * @returns {Promise<Object>} 計算結果
       */
      calculate: async (data) => {
        return this._request('POST', '/payroll/calculate', data);
      },

      /**
       * 給与明細取得
       * @param {string} employeeId - 従業員ID
       * @param {string} yearMonth - 年月（YYYY-MM）
       * @returns {Promise<Object>} 給与明細
       */
      getPayslip: async (employeeId, yearMonth) => {
        return this._request('GET', `/payroll/payslips/${employeeId}/${yearMonth}`);
      },

      /**
       * 給与明細一覧取得
       * @param {Object} params - クエリパラメータ
       * @returns {Promise<Array>} 給与明細リスト
       */
      listPayslips: async (params = {}) => {
        const queryString = new URLSearchParams(params).toString();
        return this._request('GET', `/payroll/payslips${queryString ? '?' + queryString : ''}`);
      },

      /**
       * 給与承認
       * @param {string} batchId - バッチID
       * @returns {Promise<Object>} 承認結果
       */
      approve: async (batchId) => {
        return this._request('POST', `/payroll/batches/${batchId}/approve`);
      }
    };
  }

  /**
   * 休暇管理
   */
  get leaves() {
    return {
      /**
       * 休暇申請
       * @param {Object} data - 申請データ
       * @returns {Promise<Object>} 申請結果
       */
      request: async (data) => {
        return this._request('POST', '/leaves/requests', data);
      },

      /**
       * 休暇申請一覧取得
       * @param {Object} params - クエリパラメータ
       * @returns {Promise<Array>} 申請リスト
       */
      listRequests: async (params = {}) => {
        const queryString = new URLSearchParams(params).toString();
        return this._request('GET', `/leaves/requests${queryString ? '?' + queryString : ''}`);
      },

      /**
       * 休暇残高取得
       * @param {string} employeeId - 従業員ID
       * @returns {Promise<Object>} 休暇残高
       */
      getBalance: async (employeeId) => {
        return this._request('GET', `/leaves/balance/${employeeId}`);
      },

      /**
       * 休暇申請承認
       * @param {string} requestId - 申請ID
       * @returns {Promise<Object>} 承認結果
       */
      approve: async (requestId) => {
        return this._request('POST', `/leaves/requests/${requestId}/approve`);
      },

      /**
       * 休暇申請却下
       * @param {string} requestId - 申請ID
       * @param {string} reason - 却下理由
       * @returns {Promise<Object>} 却下結果
       */
      reject: async (requestId, reason) => {
        return this._request('POST', `/leaves/requests/${requestId}/reject`, { reason });
      }
    };
  }

  /**
   * 経費管理
   */
  get expenses() {
    return {
      /**
       * 経費申請
       * @param {Object} data - 申請データ
       * @returns {Promise<Object>} 申請結果
       */
      submit: async (data) => {
        return this._request('POST', '/expenses', data);
      },

      /**
       * レシートアップロード
       * @param {File} file - レシートファイル
       * @param {Object} metadata - メタデータ
       * @returns {Promise<Object>} アップロード結果
       */
      uploadReceipt: async (file, metadata = {}) => {
        const formData = new FormData();
        formData.append('receipt', file);
        Object.keys(metadata).forEach(key => {
          formData.append(key, metadata[key]);
        });

        return this._request('POST', '/expenses/receipts', null, {
          headers: { 'Content-Type': undefined },
          body: formData
        });
      },

      /**
       * 経費申請一覧取得
       * @param {Object} params - クエリパラメータ
       * @returns {Promise<Array>} 申請リスト
       */
      list: async (params = {}) => {
        const queryString = new URLSearchParams(params).toString();
        return this._request('GET', `/expenses${queryString ? '?' + queryString : ''}`);
      },

      /**
       * 経費申請承認
       * @param {string} expenseId - 経費ID
       * @returns {Promise<Object>} 承認結果
       */
      approve: async (expenseId) => {
        return this._request('POST', `/expenses/${expenseId}/approve`);
      }
    };
  }

  /**
   * レポート・分析
   */
  get reports() {
    return {
      /**
       * レポート生成
       * @param {string} reportType - レポートタイプ
       * @param {Object} params - パラメータ
       * @returns {Promise<Object>} レポート
       */
      generate: async (reportType, params = {}) => {
        return this._request('POST', `/reports/${reportType}`, params);
      },

      /**
       * ダッシュボードデータ取得
       * @param {string} dashboardId - ダッシュボードID
       * @returns {Promise<Object>} ダッシュボードデータ
       */
      getDashboard: async (dashboardId) => {
        return this._request('GET', `/reports/dashboards/${dashboardId}`);
      },

      /**
       * 人的資本指標取得
       * @param {Object} params - パラメータ
       * @returns {Promise<Object>} 人的資本指標
       */
      getHumanCapitalMetrics: async (params = {}) => {
        const queryString = new URLSearchParams(params).toString();
        return this._request('GET', `/reports/human-capital${queryString ? '?' + queryString : ''}`);
      }
    };
  }

  /**
   * Webhook管理
   */
  get webhooks() {
    return {
      /**
       * Webhook登録
       * @param {Object} data - Webhook設定
       * @returns {Promise<Object>} 登録結果
       */
      create: async (data) => {
        return this._request('POST', '/webhooks', data);
      },

      /**
       * Webhook一覧取得
       * @returns {Promise<Array>} Webhookリスト
       */
      list: async () => {
        return this._request('GET', '/webhooks');
      },

      /**
       * Webhook削除
       * @param {string} webhookId - WebhookID
       * @returns {Promise<void>}
       */
      delete: async (webhookId) => {
        return this._request('DELETE', `/webhooks/${webhookId}`);
      }
    };
  }
}

/**
 * カスタムエラークラス
 */
class AIOSError extends Error {
  constructor(message, statusCode, response) {
    super(message);
    this.name = 'AIOSError';
    this.statusCode = statusCode;
    this.response = response;
  }
}

// Node.js環境用のエクスポート
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { AIOSClient, AIOSError };
}

// ブラウザ環境用のエクスポート
if (typeof window !== 'undefined') {
  window.AIOSClient = AIOSClient;
  window.AIOSError = AIOSError;
}