#!/usr/bin/env tsx

/**
 * 型カバレッジチェックスクリプト
 * TypeScriptコード内のany型使用状況を分析し、型安全性を評価します
 */

import { promises as fs } from 'fs';
import path from 'path';
import { execSync } from 'child_process';

interface TypeCoverageReport {
  totalFiles: number;
  filesWithAny: number;
  totalAnyCount: number;
  fileReports: FileReport[];
  coveragePercentage: number;
}

interface FileReport {
  filePath: string;
  anyCount: number;
  locations: AnyLocation[];
}

interface AnyLocation {
  line: number;
  column: number;
  text: string;
}

/**
 * ソースディレクトリ内のTypeScriptファイルを再帰的に取得
 */
async function getTypeScriptFiles(dir: string): Promise<string[]> {
  const files: string[] = [];
  
  async function traverse(currentDir: string): Promise<void> {
    const entries = await fs.readdir(currentDir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);
      
      if (entry.isDirectory()) {
        // node_modules, dist, coverageなどは除外
        if (!['node_modules', 'dist', 'coverage', '.git'].includes(entry.name)) {
          await traverse(fullPath);
        }
      } else if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx'))) {
        // テストファイルは除外オプション
        if (!entry.name.includes('.test.') && !entry.name.includes('.spec.')) {
          files.push(fullPath);
        }
      }
    }
  }
  
  await traverse(dir);
  return files;
}

/**
 * ファイル内のany型使用箇所を検出
 */
async function detectAnyInFile(filePath: string): Promise<FileReport> {
  const content = await fs.readFile(filePath, 'utf-8');
  const lines = content.split('\n');
  const locations: AnyLocation[] = [];
  
  // any型のパターン
  const anyPatterns = [
    /:\s*any\b/g,                    // : any
    /<any>/g,                        // <any>
    /as\s+any\b/g,                   // as any
    /:\s*any\[\]/g,                  // : any[]
    /:\s*Array<any>/g,               // : Array<any>
    /:\s*Promise<any>/g,             // : Promise<any>
    /:\s*\{[^}]*:\s*any[^}]*\}/g,   // { prop: any }
    /\bany\s*\|/g,                   // any | 
    /\|\s*any\b/g,                   // | any
    /\((.*?:\s*)?any\)/g,            // (param: any)
  ];
  
  lines.forEach((line, lineIndex) => {
    // コメント行は除外
    const trimmedLine = line.trim();
    if (trimmedLine.startsWith('//') || trimmedLine.startsWith('*')) {
      return;
    }
    
    anyPatterns.forEach(pattern => {
      let match;
      while ((match = pattern.exec(line)) !== null) {
        locations.push({
          line: lineIndex + 1,
          column: match.index + 1,
          text: line.trim()
        });
      }
      pattern.lastIndex = 0; // Reset regex
    });
  });
  
  return {
    filePath: path.relative(process.cwd(), filePath),
    anyCount: locations.length,
    locations
  };
}

/**
 * 型カバレッジレポートを生成
 */
async function generateTypeCoverageReport(srcDir: string): Promise<TypeCoverageReport> {
  console.log('🔍 型カバレッジ分析を開始します...\n');
  
  const files = await getTypeScriptFiles(srcDir);
  console.log(`📁 ${files.length} 個のTypeScriptファイルを検出\n`);
  
  const fileReports: FileReport[] = [];
  let totalAnyCount = 0;
  
  for (const file of files) {
    const report = await detectAnyInFile(file);
    if (report.anyCount > 0) {
      fileReports.push(report);
      totalAnyCount += report.anyCount;
    }
  }
  
  const filesWithAny = fileReports.length;
  const coveragePercentage = ((files.length - filesWithAny) / files.length) * 100;
  
  return {
    totalFiles: files.length,
    filesWithAny,
    totalAnyCount,
    fileReports: fileReports.sort((a, b) => b.anyCount - a.anyCount),
    coveragePercentage
  };
}

/**
 * レポートをコンソールに出力
 */
function printReport(report: TypeCoverageReport): void {
  console.log('📊 型カバレッジレポート');
  console.log('====================\n');
  
  console.log(`✅ 総ファイル数: ${report.totalFiles}`);
  console.log(`❌ any型を含むファイル数: ${report.filesWithAny}`);
  console.log(`🎯 型カバレッジ: ${report.coveragePercentage.toFixed(2)}%`);
  console.log(`⚠️  any型の総使用数: ${report.totalAnyCount}\n`);
  
  if (report.fileReports.length > 0) {
    console.log('📋 any型使用ファイル（使用数順）:');
    console.log('================================\n');
    
    report.fileReports.forEach((fileReport, index) => {
      console.log(`${index + 1}. ${fileReport.filePath} (${fileReport.anyCount} 箇所)`);
      
      // 最初の3つの使用箇所を表示
      fileReport.locations.slice(0, 3).forEach(loc => {
        console.log(`   行 ${loc.line}: ${loc.text}`);
      });
      
      if (fileReport.locations.length > 3) {
        console.log(`   ... 他 ${fileReport.locations.length - 3} 箇所\n`);
      } else {
        console.log();
      }
    });
  }
  
  // 改善提案
  console.log('💡 改善提案:');
  console.log('==========\n');
  
  if (report.coveragePercentage < 100) {
    console.log('1. any型をunknown型に置き換え、適切な型ガードを使用');
    console.log('2. 具体的な型定義やインターフェースを作成');
    console.log('3. ジェネリック型を活用して型安全性を保持');
    console.log('4. 型推論を活用し、明示的な型注釈を減らす');
  } else {
    console.log('🎉 素晴らしい！any型の使用がありません！');
  }
}

/**
 * CSVレポートを生成
 */
async function generateCSVReport(report: TypeCoverageReport, outputPath: string): Promise<void> {
  const csvLines: string[] = [
    'File Path,Any Count,First Location',
    ...report.fileReports.map(fr => 
      `"${fr.filePath}",${fr.anyCount},"Line ${fr.locations[0]?.line || 'N/A'}"`
    )
  ];
  
  await fs.writeFile(outputPath, csvLines.join('\n'));
  console.log(`\n📄 CSVレポートを生成: ${outputPath}`);
}

/**
 * メイン実行関数
 */
async function main(): Promise<void> {
  const srcDir = path.join(process.cwd(), 'src');
  const outputCSV = process.argv.includes('--csv');
  
  try {
    const report = await generateTypeCoverageReport(srcDir);
    printReport(report);
    
    if (outputCSV) {
      const csvPath = path.join(process.cwd(), 'type-coverage-report.csv');
      await generateCSVReport(report, csvPath);
    }
    
    // TypeScript compilerでの型チェック
    console.log('\n🔧 TypeScriptコンパイラでの型チェック...\n');
    try {
      execSync('npm run typecheck:strict', { stdio: 'inherit' });
      console.log('✅ 型チェック完了！');
    } catch (error) {
      console.error('❌ 型チェックでエラーが発生しました');
      process.exit(1);
    }
    
    // 目標達成度の評価
    if (report.totalAnyCount === 0) {
      console.log('\n🏆 目標達成！any型の使用数が0になりました！');
    } else {
      console.log(`\n📈 目標まであと ${report.totalAnyCount} 箇所のany型を除去する必要があります`);
    }
    
  } catch (error) {
    console.error('❌ エラーが発生しました:', error);
    process.exit(1);
  }
}

// 実行
main().catch(console.error);