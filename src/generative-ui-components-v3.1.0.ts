/**
 * ジェネレーティブUIコンポーネントライブラリ v3.1.0
 * Generative UI Components - Adaptive & Intelligent Interface Elements
 * 
 * 戦略的価値:
 * - コンテキスト適応型UIコンポーネント
 * - AI駆動のインタラクション最適化
 * - アクセシビリティファーストの設計
 * 
 * 技術的特徴:
 * - 動的プロパティ生成
 * - インテリジェントレイアウト調整
 * - リアルタイムパフォーマンス監視
 * - 多デバイス対応
 */

import { EventEmitter } from 'events';
import type { 
  GenerativeComponent, 
  UserContext, 
  DeviceInfo,
  ComponentConfiguration,
  DataSource,
  Filter
} from './generative-ui-engine-v3.1.0.js';

// ===== 型定義 =====

export interface ChartDataPoint {
  readonly x: number | string | Date;
  readonly y: number;
  readonly label?: string;
  readonly metadata?: Record<string, unknown>;
}

export interface ComponentRenderResult {
  readonly componentId: string;
  readonly htmlStructure: string;
  readonly styleSheet: string;
  readonly interactionHandlers: Record<string, EventHandler>;
  readonly accessibility: AccessibilityAttributes;
  readonly metadata?: Record<string, unknown>;
}

export interface ComponentInteraction {
  readonly type: string;
  readonly payload?: unknown;
  readonly timestamp: number;
  readonly sourceId?: string;
}

export interface EventHandler {
  readonly event: string;
  readonly handler: (event: Event) => void | Promise<void>;
}

export interface AccessibilityAttributes {
  readonly role?: string;
  readonly ariaLabel?: string;
  readonly ariaDescribedBy?: string;
  readonly tabIndex?: number;
  readonly focusable?: boolean;
}

export interface ChartConfiguration {
  readonly type: 'line' | 'bar' | 'pie' | 'scatter' | 'area';
  readonly title?: string;
  readonly width?: number;
  readonly height?: number;
  readonly colors?: string[];
  readonly showLegend?: boolean;
  readonly animation?: boolean;
}

export interface TableDataRow {
  readonly id: string | number;
  readonly [key: string]: unknown;
}

export interface TableColumn {
  readonly key: string;
  readonly label: string;
  readonly title?: string;
  readonly sortable?: boolean;
  readonly filterable?: boolean;
  readonly width?: string;
  readonly align?: 'left' | 'center' | 'right';
  readonly formatter?: (value: unknown) => string;
}

export interface TableConfiguration {
  readonly columns: TableColumn[];
  readonly pageSize?: number;
  readonly showPagination?: boolean;
  readonly enableSorting?: boolean;
  readonly enableFiltering?: boolean;
  readonly responsive?: boolean;
}

export interface FormField {
  readonly name: string;
  readonly type: 'text' | 'number' | 'email' | 'select' | 'textarea' | 'checkbox' | 'radio' | 'date';
  readonly label: string;
  readonly required?: boolean;
  readonly placeholder?: string;
  readonly options?: Array<{ value: string | number; label: string }>;
  readonly validation?: {
    pattern?: string;
    min?: number;
    max?: number;
    minLength?: number;
    maxLength?: number;
  };
}

// ===== スマートコンポーネント基盤 =====

export abstract class SmartComponent extends EventEmitter {
  public readonly id: string;
  public readonly type: string;
  protected config: ComponentConfiguration;
  protected dataSource: DataSource;
  protected context: UserContext;
  protected deviceInfo?: DeviceInfo;

  constructor(
    id: string,
    type: string,
    config: ComponentConfiguration,
    dataSource: DataSource,
    context: UserContext,
    deviceInfo?: DeviceInfo
  ) {
    super();
    this.id = id;
    this.type = type;
    this.config = config;
    this.dataSource = dataSource;
    this.context = context;
    this.deviceInfo = deviceInfo;
  }

  abstract render(): Promise<ComponentRenderResult>;
  abstract handleInteraction(interaction: ComponentInteraction): Promise<void>;
  
  protected abstract adaptToDevice(): ComponentConfiguration;
  protected abstract optimizePerformance(): void;
  
  public async initialize(): Promise<void> {
    await this.loadData();
    this.optimizePerformance();
    this.setupEventHandlers();
    
    console.log(`🎨 Smart component initialized: ${this.type}#${this.id}`);
  }

  protected async loadData(): Promise<unknown> {
    // データソースから情報を取得（キャッシング対応）
    if (this.dataSource.caching.enabled) {
      const cachedData = await this.getCachedData();
      if (cachedData) return cachedData;
    }

    const data = await this.fetchData();
    
    if (this.dataSource.caching.enabled) {
      await this.setCachedData(data);
    }

    return data;
  }

  protected abstract fetchData(): Promise<unknown>;
  protected abstract getCachedData(): Promise<unknown | null>;
  protected abstract setCachedData(data: unknown): Promise<void>;

  protected setupEventHandlers(): void {
    this.on('data_changed', () => {
      this.render();
    });

    this.on('config_updated', () => {
      this.config = this.adaptToDevice();
      this.render();
    });
  }
}

// ===== インテリジェントチャートコンポーネント =====

export class IntelligentChart extends SmartComponent {
  private chartData: ChartDataPoint[];
  private renderCache: Map<string, ComponentRenderResult> = new Map();

  constructor(
    id: string,
    config: ComponentConfiguration,
    dataSource: DataSource,
    context: UserContext,
    deviceInfo?: DeviceInfo
  ) {
    super(id, 'chart', config, dataSource, context, deviceInfo);
    this.chartData = [];
  }

  async render(): Promise<ComponentRenderResult> {
    const cacheKey = this.generateCacheKey();
    
    if (this.renderCache.has(cacheKey)) {
      return this.renderCache.get(cacheKey)!;
    }

    const data = await this.loadData();
    const adaptedConfig = this.adaptToDevice();
    
    const renderResult: ComponentRenderResult = {
      componentId: this.id,
      htmlStructure: this.generateChartHTML(data, adaptedConfig),
      styleSheet: this.generateChartCSS(adaptedConfig),
      interactionHandlers: this.generateInteractionHandlers(),
      accessibility: this.generateAccessibilityAttributes(),
      metadata: {
        renderTime: Date.now(),
        dataPoints: data.length,
        chartType: adaptedConfig.chart?.type
      }
    };

    this.renderCache.set(cacheKey, renderResult);
    
    // イベント発火
    this.emit('rendered', renderResult);
    
    return renderResult;
  }

  async handleInteraction(interaction: ComponentInteraction): Promise<void> {
    switch (interaction.type) {
      case 'zoom':
        await this.handleZoom(interaction.data);
        break;
      case 'filter':
        await this.handleFilter(interaction.data);
        break;
      case 'drill_down':
        await this.handleDrillDown(interaction.data);
        break;
      case 'export':
        await this.handleExport(interaction.data);
        break;
      default:
        console.warn(`Unsupported interaction: ${interaction.type}`);
    }
  }

  protected adaptToDevice(): ComponentConfiguration {
    if (!this.deviceInfo) return this.config;

    const adapted = { ...this.config };
    
    if (this.deviceInfo.deviceType === 'mobile') {
      // モバイル最適化
      adapted.chart = {
        ...adapted.chart,
        type: this.simplifyChartType(adapted.chart?.type),
        animation: false, // バッテリー節約
        responsive: true
      };
    }

    if (this.deviceInfo.touchCapable) {
      // タッチ操作最適化
      adapted.chart = {
        ...adapted.chart,
        touchOptimized: true,
        gestureSupport: true
      };
    }

    return adapted;
  }

  protected optimizePerformance(): void {
    // データポイント数に応じた最適化
    if (this.chartData.length > 10000) {
      // 大量データ用の最適化
      this.enableDataVirtualization();
      this.enableLazyRendering();
    }

    // デバイス性能に応じた最適化
    if (this.deviceInfo?.screenWidth && this.deviceInfo.screenWidth < 768) {
      this.reduceAnimations();
      this.simplifyVisuals();
    }
  }

  protected async fetchData(): Promise<ChartDataPoint[]> {
    // データソースに応じた取得ロジック
    switch (this.dataSource.type) {
      case 'database':
        return await this.fetchFromDatabase();
      case 'api':
        return await this.fetchFromAPI();
      case 'calculation':
        return await this.performCalculation();
      default:
        throw new Error(`Unsupported data source type: ${this.dataSource.type}`);
    }
  }

  protected async getCachedData(): Promise<ChartDataPoint[] | null> {
    // キャッシュ戦略に応じた取得
    switch (this.dataSource.caching.strategy) {
      case 'memory':
        return this.getMemoryCache();
      case 'redis':
        return await this.getRedisCache();
      case 'database':
        return await this.getDatabaseCache();
      default:
        return null;
    }
  }

  protected async setCachedData(data: ChartDataPoint[]): Promise<void> {
    // キャッシュ戦略に応じた保存
    switch (this.dataSource.caching.strategy) {
      case 'memory':
        this.setMemoryCache(data);
        break;
      case 'redis':
        await this.setRedisCache(data);
        break;
      case 'database':
        await this.setDatabaseCache(data);
        break;
    }
  }

  // プライベートメソッド（実装簡略化）
  private generateCacheKey(): string {
    return `chart_${this.id}_${JSON.stringify(this.config)}_${this.deviceInfo?.deviceType}`;
  }

  private generateChartHTML(data: ChartDataPoint[], config: ComponentConfiguration): string {
    const chartConfig = config.chart;
    if (!chartConfig) return '<div>Chart configuration missing</div>';

    return `
      <div class="intelligent-chart" id="${this.id}">
        <div class="chart-header">
          <h3 class="chart-title">${this.getTitle()}</h3>
          <div class="chart-controls">
            <button class="chart-zoom-btn" aria-label="ズーム">🔍</button>
            <button class="chart-filter-btn" aria-label="フィルター">🔽</button>
            <button class="chart-export-btn" aria-label="エクスポート">📤</button>
          </div>
        </div>
        <div class="chart-canvas" role="img" aria-label="データチャート">
          <canvas id="chart-${this.id}" width="100%" height="400"></canvas>
        </div>
        <div class="chart-legend" role="complementary">
          ${this.generateLegend(data, chartConfig)}
        </div>
      </div>
    `;
  }

  private generateChartCSS(config: ComponentConfiguration): string {
    const theme = this.context.preferences.theme;
    const highContrast = this.context.preferences.accessibilitySettings.highContrast;
    
    return `
      .intelligent-chart {
        background: ${theme === 'dark' ? '#2d3748' : '#ffffff'};
        border: 1px solid ${highContrast ? '#000000' : '#e2e8f0'};
        border-radius: 8px;
        padding: 16px;
        margin: 8px;
        transition: all 0.3s ease;
      }
      
      .chart-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 16px;
      }
      
      .chart-title {
        font-size: ${this.context.preferences.accessibilitySettings.fontSize === 'large' ? '1.5rem' : '1.25rem'};
        color: ${theme === 'dark' ? '#f7fafc' : '#2d3748'};
        margin: 0;
      }
      
      .chart-controls button {
        background: transparent;
        border: 1px solid ${highContrast ? '#000000' : '#cbd5e0'};
        padding: 8px;
        margin-left: 8px;
        border-radius: 4px;
        cursor: pointer;
        font-size: ${this.context.preferences.accessibilitySettings.fontSize === 'large' ? '1.2rem' : '1rem'};
      }
      
      .chart-canvas {
        position: relative;
        width: 100%;
        height: 400px;
      }
      
      .chart-legend {
        margin-top: 16px;
        font-size: ${this.context.preferences.accessibilitySettings.fontSize === 'large' ? '1.1rem' : '0.9rem'};
      }
      
      @media (max-width: 768px) {
        .intelligent-chart {
          padding: 12px;
        }
        
        .chart-header {
          flex-direction: column;
          align-items: flex-start;
        }
        
        .chart-controls {
          margin-top: 8px;
        }
        
        .chart-canvas {
          height: 250px;
        }
      }
    `;
  }

  private generateInteractionHandlers(): InteractionHandler[] {
    return [
      {
        event: 'click',
        selector: '.chart-zoom-btn',
        handler: 'handleZoomClick'
      },
      {
        event: 'click',
        selector: '.chart-filter-btn',
        handler: 'handleFilterClick'
      },
      {
        event: 'click',
        selector: '.chart-export-btn',
        handler: 'handleExportClick'
      },
      {
        event: 'touchstart',
        selector: '.chart-canvas',
        handler: 'handleTouchStart'
      }
    ];
  }

  private generateAccessibilityAttributes(): AccessibilityAttributes {
    return {
      ariaLabel: `${this.getTitle()}のデータチャート`,
      role: 'img',
      tabIndex: 0,
      ariaDescribedBy: `chart-${this.id}-description`,
      keyboardShortcuts: {
        'Ctrl+Plus': 'ズームイン',
        'Ctrl+Minus': 'ズームアウト',
        'Ctrl+F': 'フィルター表示'
      }
    };
  }

  private getTitle(): string {
    return this.config.chart?.title || 'データチャート';
  }

  private generateLegend(data: ChartDataPoint[], chartConfig: ChartConfiguration): string {
    // 凡例生成ロジック（簡略化）
    return '<div class="legend-items">凡例</div>';
  }

  private simplifyChartType(chartType?: string): string {
    // モバイル向けチャートタイプ簡略化
    const simplificationMap: Record<string, string> = {
      'scatter': 'line',
      'heatmap': 'bar',
      'complex': 'bar'
    };
    
    return simplificationMap[chartType || ''] || chartType || 'bar';
  }

  // データ処理メソッド（実装簡略化）
  private async fetchFromDatabase(): Promise<ChartDataPoint[]> { return []; }
  private async fetchFromAPI(): Promise<ChartDataPoint[]> { return []; }
  private async performCalculation(): Promise<ChartDataPoint[]> { return []; }
  
  // キャッシュメソッド（実装簡略化）
  private getMemoryCache(): ChartDataPoint[] | null { return null; }
  private async getRedisCache(): Promise<ChartDataPoint[] | null> { return null; }
  private async getDatabaseCache(): Promise<ChartDataPoint[] | null> { return null; }
  private setMemoryCache(data: ChartDataPoint[]): void {}
  private async setRedisCache(data: ChartDataPoint[]): Promise<void> {}
  private async setDatabaseCache(data: ChartDataPoint[]): Promise<void> {}
  
  // 最適化メソッド（実装簡略化）
  private enableDataVirtualization(): void {}
  private enableLazyRendering(): void {}
  private reduceAnimations(): void {}
  private simplifyVisuals(): void {}
  
  // インタラクションハンドラー（実装簡略化）
  private async handleZoom(data: unknown): Promise<void> {}
  private async handleFilter(data: unknown): Promise<void> {}
  private async handleDrillDown(data: unknown): Promise<void> {}
  private async handleExport(data: unknown): Promise<void> {}
}

// ===== アダプティブデータテーブル =====

export class AdaptiveDataTable extends SmartComponent {
  private tableData: TableDataRow[] = [];
  private currentPage: number = 1;
  private pageSize: number = 10;
  private sortConfig: SortConfig | null = null;
  private filterConfig: Filter[] = [];

  constructor(
    id: string,
    config: ComponentConfiguration,
    dataSource: DataSource,
    context: UserContext,
    deviceInfo?: DeviceInfo
  ) {
    super(id, 'table', config, dataSource, context, deviceInfo);
    this.adaptPageSize();
  }

  async render(): Promise<ComponentRenderResult> {
    const data = await this.loadData();
    const processedData = this.processData(data);
    const adaptedConfig = this.adaptToDevice();

    return {
      componentId: this.id,
      htmlStructure: this.generateTableHTML(processedData, adaptedConfig),
      styleSheet: this.generateTableCSS(adaptedConfig),
      interactionHandlers: this.generateTableInteractionHandlers(),
      accessibility: this.generateTableAccessibilityAttributes(),
      metadata: {
        renderTime: Date.now(),
        totalRows: data.length,
        visibleRows: processedData.length,
        currentPage: this.currentPage
      }
    };
  }

  async handleInteraction(interaction: ComponentInteraction): Promise<void> {
    switch (interaction.type) {
      case 'sort':
        this.handleSort(interaction.data);
        break;
      case 'filter':
        this.handleTableFilter(interaction.data);
        break;
      case 'paginate':
        this.handlePagination(interaction.data);
        break;
      case 'select_row':
        this.handleRowSelection(interaction.data);
        break;
    }
    
    await this.render();
  }

  protected adaptToDevice(): ComponentConfiguration {
    const adapted = { ...this.config };
    
    if (this.deviceInfo?.deviceType === 'mobile') {
      // モバイル: カード表示に切り替え
      adapted.table = {
        ...adapted.table,
        layout: 'card',
        hideColumns: this.getColumnsToHideOnMobile(),
        stackable: true
      };
    } else if (this.deviceInfo?.deviceType === 'tablet') {
      // タブレット: 重要カラムのみ表示
      adapted.table = {
        ...adapted.table,
        responsiveColumns: true,
        priorityColumns: this.getPriorityColumns()
      };
    }

    return adapted;
  }

  protected optimizePerformance(): void {
    // 大量データの場合は仮想スクロール
    if (this.tableData.length > 1000) {
      this.enableVirtualScrolling();
    }

    // ページサイズの動的調整
    this.adaptPageSize();
  }

  protected async fetchData(): Promise<TableDataRow[]> {
    // データソース取得（実装簡略化）
    return [];
  }

  protected async getCachedData(): Promise<TableDataRow[] | null> {
    return null;
  }

  protected async setCachedData(data: TableDataRow[]): Promise<void> {
    // キャッシュ保存
  }

  private processData(data: TableDataRow[]): TableDataRow[] {
    let processed = [...data];

    // フィルタリング
    if (this.filterConfig.length > 0) {
      processed = this.applyFilters(processed);
    }

    // ソート
    if (this.sortConfig) {
      processed = this.applySorting(processed);
    }

    // ページネーション
    const startIndex = (this.currentPage - 1) * this.pageSize;
    return processed.slice(startIndex, startIndex + this.pageSize);
  }

  private generateTableHTML(data: TableDataRow[], config: ComponentConfiguration): string {
    const tableConfig = config.table;
    if (!tableConfig) return '<div>Table configuration missing</div>';

    if (config.table?.layout === 'card' && this.deviceInfo?.deviceType === 'mobile') {
      return this.generateCardLayout(data, tableConfig);
    }

    return `
      <div class="adaptive-data-table" id="${this.id}">
        <div class="table-header">
          <div class="table-controls">
            <input type="text" class="table-search" placeholder="検索..." />
            <button class="table-filter-btn">フィルター</button>
            <button class="table-export-btn">エクスポート</button>
          </div>
        </div>
        <div class="table-container">
          <table class="data-table" role="table">
            <thead>
              <tr role="row">
                ${tableConfig.columns?.map(col => `
                  <th role="columnheader" 
                      ${col.sortable ? 'class="sortable"' : ''}
                      data-column="${col.key}">
                    ${col.title}
                    ${col.sortable ? '<span class="sort-indicator">⇅</span>' : ''}
                  </th>
                `).join('') || ''}
              </tr>
            </thead>
            <tbody>
              ${data.map((row, index) => `
                <tr role="row" data-row-index="${index}">
                  ${tableConfig.columns?.map(col => `
                    <td role="cell" data-column="${col.key}">
                      ${this.formatCellValue(row[col.key], col)}
                    </td>
                  `).join('') || ''}
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
        ${this.generatePaginationHTML()}
      </div>
    `;
  }

  private generateCardLayout(data: TableDataRow[], tableConfig: TableConfiguration): string {
    return `
      <div class="adaptive-data-table card-layout" id="${this.id}">
        <div class="table-header">
          <input type="text" class="table-search" placeholder="検索..." />
        </div>
        <div class="cards-container">
          ${data.map((row, index) => `
            <div class="data-card" data-row-index="${index}">
              ${tableConfig.columns?.map((col: TableColumn) => `
                <div class="card-field">
                  <span class="field-label">${col.title}:</span>
                  <span class="field-value">${this.formatCellValue(row[col.key], col)}</span>
                </div>
              `).join('') || ''}
            </div>
          `).join('')}
        </div>
        ${this.generatePaginationHTML()}
      </div>
    `;
  }

  private generateTableCSS(config: ComponentConfiguration): string {
    const theme = this.context.preferences.theme;
    const fontSize = this.context.preferences.accessibilitySettings.fontSize;
    
    return `
      .adaptive-data-table {
        background: ${theme === 'dark' ? '#2d3748' : '#ffffff'};
        border: 1px solid ${theme === 'dark' ? '#4a5568' : '#e2e8f0'};
        border-radius: 8px;
        overflow: hidden;
      }

      .table-header {
        padding: 16px;
        background: ${theme === 'dark' ? '#4a5568' : '#f7fafc'};
        border-bottom: 1px solid ${theme === 'dark' ? '#4a5568' : '#e2e8f0'};
      }

      .table-controls {
        display: flex;
        gap: 12px;
        align-items: center;
      }

      .table-search {
        flex: 1;
        padding: 8px 12px;
        border: 1px solid ${theme === 'dark' ? '#4a5568' : '#cbd5e0'};
        border-radius: 4px;
        font-size: ${fontSize === 'large' ? '1.1rem' : '1rem'};
      }

      .data-table {
        width: 100%;
        border-collapse: collapse;
        font-size: ${fontSize === 'large' ? '1.1rem' : '0.9rem'};
      }

      .data-table th {
        padding: 12px;
        text-align: left;
        font-weight: 600;
        background: ${theme === 'dark' ? '#4a5568' : '#f7fafc'};
        border-bottom: 2px solid ${theme === 'dark' ? '#2d3748' : '#e2e8f0'};
      }

      .data-table td {
        padding: 12px;
        border-bottom: 1px solid ${theme === 'dark' ? '#4a5568' : '#e2e8f0'};
      }

      .sortable {
        cursor: pointer;
        user-select: none;
      }

      .sortable:hover {
        background: ${theme === 'dark' ? '#2d3748' : '#edf2f7'};
      }

      /* カードレイアウト（モバイル） */
      .card-layout .cards-container {
        padding: 16px;
      }

      .data-card {
        background: ${theme === 'dark' ? '#4a5568' : '#f7fafc'};
        border: 1px solid ${theme === 'dark' ? '#4a5568' : '#e2e8f0'};
        border-radius: 8px;
        padding: 16px;
        margin-bottom: 12px;
      }

      .card-field {
        display: flex;
        justify-content: space-between;
        margin-bottom: 8px;
      }

      .field-label {
        font-weight: 600;
        color: ${theme === 'dark' ? '#a0aec0' : '#4a5568'};
      }

      .field-value {
        color: ${theme === 'dark' ? '#f7fafc' : '#2d3748'};
      }

      @media (max-width: 768px) {
        .table-controls {
          flex-direction: column;
          align-items: stretch;
        }
        
        .table-search {
          margin-bottom: 12px;
        }
      }
    `;
  }

  private generateTableInteractionHandlers(): InteractionHandler[] {
    return [
      {
        event: 'click',
        selector: '.sortable',
        handler: 'handleSortClick'
      },
      {
        event: 'input',
        selector: '.table-search',
        handler: 'handleSearchInput'
      },
      {
        event: 'click',
        selector: '.page-btn',
        handler: 'handlePageClick'
      }
    ];
  }

  private generateTableAccessibilityAttributes(): AccessibilityAttributes {
    return {
      ariaLabel: 'データテーブル',
      role: 'table',
      tabIndex: 0,
      ariaDescribedBy: `table-${this.id}-description`,
      keyboardShortcuts: {
        'ArrowUp': '前の行',
        'ArrowDown': '次の行',
        'PageUp': '前のページ',
        'PageDown': '次のページ'
      }
    };
  }

  private generatePaginationHTML(): string {
    const totalPages = Math.ceil(this.tableData.length / this.pageSize);
    
    if (totalPages <= 1) return '';

    return `
      <div class="table-pagination">
        <button class="page-btn" data-page="prev" ${this.currentPage === 1 ? 'disabled' : ''}>
          前へ
        </button>
        <span class="page-info">
          ${this.currentPage} / ${totalPages} ページ
        </span>
        <button class="page-btn" data-page="next" ${this.currentPage === totalPages ? 'disabled' : ''}>
          次へ
        </button>
      </div>
    `;
  }

  private formatCellValue(value: unknown, column: TableColumn): string {
    if (column.formatter) {
      return column.formatter(value);
    }

    switch (column.dataType) {
      case 'date':
        return new Date(value).toLocaleDateString('ja-JP');
      case 'number':
        return value?.toLocaleString('ja-JP') || '0';
      case 'boolean':
        return value ? '✓' : '✗';
      default:
        return String(value || '');
    }
  }

  // ユーティリティメソッド（実装簡略化）
  private adaptPageSize(): void {
    if (this.deviceInfo?.deviceType === 'mobile') {
      this.pageSize = 5;
    } else {
      this.pageSize = 10;
    }
  }

  private getColumnsToHideOnMobile(): string[] {
    return ['id', 'created_at', 'updated_at'];
  }

  private getPriorityColumns(): string[] {
    return ['name', 'status', 'amount'];
  }

  private enableVirtualScrolling(): void {}
  
  private applyFilters(data: TableDataRow[]): TableDataRow[] {
    return data;
  }

  private applySorting(data: TableDataRow[]): TableDataRow[] {
    return data;
  }

  private handleSort(data: unknown): void {}
  private handleTableFilter(data: unknown): void {}
  private handlePagination(data: unknown): void {}
  private handleRowSelection(data: unknown): void {}
}

// ===== スマートフォームコンポーネント =====

export class SmartForm extends SmartComponent {
  private formData: Record<string, unknown> = {};
  private validationErrors: Record<string, string> = {};

  constructor(
    id: string,
    config: ComponentConfiguration,
    dataSource: DataSource,
    context: UserContext,
    deviceInfo?: DeviceInfo
  ) {
    super(id, 'form', config, dataSource, context, deviceInfo);
  }

  async render(): Promise<ComponentRenderResult> {
    const adaptedConfig = this.adaptToDevice();
    
    return {
      componentId: this.id,
      htmlStructure: this.generateFormHTML(adaptedConfig),
      styleSheet: this.generateFormCSS(adaptedConfig),
      interactionHandlers: this.generateFormInteractionHandlers(),
      accessibility: this.generateFormAccessibilityAttributes(),
      metadata: {
        renderTime: Date.now(),
        fieldCount: adaptedConfig.form?.fields.length || 0,
        validationEnabled: true
      }
    };
  }

  async handleInteraction(interaction: ComponentInteraction): Promise<void> {
    switch (interaction.type) {
      case 'field_change':
        this.handleFieldChange(interaction.data);
        break;
      case 'submit':
        await this.handleSubmit();
        break;
      case 'reset':
        this.handleReset();
        break;
      case 'validate':
        this.handleValidation(interaction.data);
        break;
    }
  }

  protected adaptToDevice(): ComponentConfiguration {
    const adapted = { ...this.config };
    
    if (this.deviceInfo?.deviceType === 'mobile') {
      // モバイル: フィールドを縦配置
      adapted.form = {
        ...adapted.form,
        layout: 'vertical',
        fieldSpacing: 'large',
        singleColumn: true
      };
    }

    return adapted;
  }

  protected optimizePerformance(): void {
    // バリデーションのデバウンス
    this.setupValidationDebounce();
  }

  protected async fetchData(): Promise<Record<string, unknown>> {
    return {};
  }

  protected async getCachedData(): Promise<Record<string, unknown> | null> {
    return null;
  }

  protected async setCachedData(data: Record<string, unknown>): Promise<void> {}

  private generateFormHTML(config: ComponentConfiguration): string {
    const formConfig = config.form;
    if (!formConfig) return '<div>Form configuration missing</div>';

    return `
      <form class="smart-form" id="${this.id}" novalidate>
        <div class="form-header">
          <h3 class="form-title">フォーム</h3>
        </div>
        <div class="form-fields">
          ${formConfig.fields.map(field => this.generateFieldHTML(field)).join('')}
        </div>
        <div class="form-actions">
          <button type="submit" class="submit-btn">送信</button>
          <button type="reset" class="reset-btn">リセット</button>
        </div>
      </form>
    `;
  }

  private generateFieldHTML(field: FormField): string {
    const fieldId = `${this.id}_${field.name}`;
    const hasError = this.validationErrors[field.name];
    
    return `
      <div class="form-field ${hasError ? 'has-error' : ''}" data-field="${field.name}">
        <label for="${fieldId}" class="field-label">
          ${field.label}
          ${field.required ? '<span class="required">*</span>' : ''}
        </label>
        ${this.generateInputHTML(field, fieldId)}
        ${hasError ? `<div class="field-error">${this.validationErrors[field.name]}</div>` : ''}
        ${field.helpText ? `<div class="field-help">${field.helpText}</div>` : ''}
      </div>
    `;
  }

  private generateInputHTML(field: FormField, fieldId: string): string {
    const commonAttrs = `
      id="${fieldId}"
      name="${field.name}"
      ${field.required ? 'required' : ''}
      aria-describedby="${fieldId}-help ${fieldId}-error"
    `;

    switch (field.type) {
      case 'text':
        return `<input type="text" class="field-input" ${commonAttrs} />`;
      case 'email':
        return `<input type="email" class="field-input" ${commonAttrs} />`;
      case 'number':
        return `<input type="number" class="field-input" ${commonAttrs} />`;
      case 'textarea':
        return `<textarea class="field-input field-textarea" ${commonAttrs}></textarea>`;
      case 'select':
        return `
          <select class="field-input field-select" ${commonAttrs}>
            <option value="">選択してください</option>
            ${field.options?.map((option) => 
              `<option value="${option.value}">${option.label}</option>`
            ).join('') || ''}
          </select>
        `;
      case 'checkbox':
        return `
          <div class="checkbox-group">
            <input type="checkbox" class="field-checkbox" ${commonAttrs} />
            <span class="checkbox-label">${field.label}</span>
          </div>
        `;
      default:
        return `<input type="text" class="field-input" ${commonAttrs} />`;
    }
  }

  private generateFormCSS(config: ComponentConfiguration): string {
    const theme = this.context.preferences.theme;
    const fontSize = this.context.preferences.accessibilitySettings.fontSize;
    
    return `
      .smart-form {
        background: ${theme === 'dark' ? '#2d3748' : '#ffffff'};
        border: 1px solid ${theme === 'dark' ? '#4a5568' : '#e2e8f0'};
        border-radius: 8px;
        padding: 24px;
        max-width: 600px;
      }

      .form-header {
        margin-bottom: 24px;
      }

      .form-title {
        font-size: ${fontSize === 'large' ? '1.5rem' : '1.25rem'};
        color: ${theme === 'dark' ? '#f7fafc' : '#2d3748'};
        margin: 0;
      }

      .form-fields {
        display: flex;
        flex-direction: column;
        gap: 20px;
      }

      .form-field {
        position: relative;
      }

      .field-label {
        display: block;
        font-weight: 600;
        margin-bottom: 8px;
        color: ${theme === 'dark' ? '#a0aec0' : '#4a5568'};
        font-size: ${fontSize === 'large' ? '1.1rem' : '1rem'};
      }

      .required {
        color: #e53e3e;
        margin-left: 4px;
      }

      .field-input {
        width: 100%;
        padding: 12px;
        border: 2px solid ${theme === 'dark' ? '#4a5568' : '#e2e8f0'};
        border-radius: 4px;
        font-size: ${fontSize === 'large' ? '1.1rem' : '1rem'};
        background: ${theme === 'dark' ? '#4a5568' : '#ffffff'};
        color: ${theme === 'dark' ? '#f7fafc' : '#2d3748'};
        transition: border-color 0.2s ease;
      }

      .field-input:focus {
        outline: none;
        border-color: #3182ce;
        box-shadow: 0 0 0 3px rgba(49, 130, 206, 0.1);
      }

      .field-textarea {
        min-height: 100px;
        resize: vertical;
      }

      .has-error .field-input {
        border-color: #e53e3e;
      }

      .field-error {
        color: #e53e3e;
        font-size: 0.875rem;
        margin-top: 4px;
      }

      .field-help {
        color: ${theme === 'dark' ? '#a0aec0' : '#718096'};
        font-size: 0.875rem;
        margin-top: 4px;
      }

      .checkbox-group {
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .field-checkbox {
        width: auto;
        margin: 0;
      }

      .form-actions {
        display: flex;
        gap: 12px;
        margin-top: 24px;
        justify-content: flex-end;
      }

      .submit-btn, .reset-btn {
        padding: 12px 24px;
        border: none;
        border-radius: 4px;
        font-size: ${fontSize === 'large' ? '1.1rem' : '1rem'};
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s ease;
      }

      .submit-btn {
        background: #3182ce;
        color: white;
      }

      .submit-btn:hover {
        background: #2c5aa0;
      }

      .reset-btn {
        background: transparent;
        color: ${theme === 'dark' ? '#a0aec0' : '#4a5568'};
        border: 1px solid ${theme === 'dark' ? '#4a5568' : '#e2e8f0'};
      }

      .reset-btn:hover {
        background: ${theme === 'dark' ? '#4a5568' : '#f7fafc'};
      }

      @media (max-width: 768px) {
        .smart-form {
          padding: 16px;
        }
        
        .form-actions {
          flex-direction: column;
        }
        
        .submit-btn, .reset-btn {
          width: 100%;
        }
      }
    `;
  }

  private generateFormInteractionHandlers(): InteractionHandler[] {
    return [
      {
        event: 'submit',
        selector: '.smart-form',
        handler: 'handleFormSubmit'
      },
      {
        event: 'change',
        selector: '.field-input',
        handler: 'handleFieldChange'
      },
      {
        event: 'blur',
        selector: '.field-input',
        handler: 'handleFieldBlur'
      }
    ];
  }

  private generateFormAccessibilityAttributes(): AccessibilityAttributes {
    return {
      ariaLabel: 'データ入力フォーム',
      role: 'form',
      tabIndex: 0,
      keyboardShortcuts: {
        'Ctrl+Enter': 'フォーム送信',
        'Escape': 'フォームリセット'
      }
    };
  }

  // フォーム処理メソッド（実装簡略化）
  private setupValidationDebounce(): void {}
  private handleFieldChange(data: unknown): void {}
  private async handleSubmit(): Promise<void> {}
  private handleReset(): void {}
  private handleValidation(data: unknown): void {}
}

// ===== 型定義 =====

export interface ComponentRenderResult {
  componentId: string;
  htmlStructure: string;
  styleSheet: string;
  interactionHandlers: InteractionHandler[];
  accessibility: AccessibilityAttributes;
  metadata: {
    renderTime: number;
    [key: string]: unknown;
  };
}

export interface ComponentInteraction {
  type: string;
  data: unknown;
  timestamp: Date;
  userId?: string;
}

export interface InteractionHandler {
  event: string;
  selector: string;
  handler: string;
}

export interface AccessibilityAttributes {
  ariaLabel: string;
  role?: string;
  tabIndex?: number;
  ariaDescribedBy?: string;
  keyboardShortcuts?: Record<string, string>;
}

export interface SortConfig {
  column: string;
  direction: 'asc' | 'desc';
}

export default {
  SmartComponent,
  IntelligentChart,
  AdaptiveDataTable,
  SmartForm
};