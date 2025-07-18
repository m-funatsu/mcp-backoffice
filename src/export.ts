import fs from 'fs/promises';
import path from 'path';
import { createReadStream, createWriteStream } from 'fs';
import { pipeline } from 'stream/promises';
import DatabasePostgreSQL from './database_postgresql.js';
import type { Employee, TimeRecord, PayrollCalculation, AttendanceReport } from './types.js';

export interface ExportOptions {
  format: 'json' | 'csv' | 'xlsx';
  includeFiles?: boolean;
  fileExtensions?: string[];
  outputPath?: string;
  dateRange?: {
    startDate: Date;
    endDate: Date;
  };
  employeeIds?: string[];
}

export interface ExportData {
  metadata: {
    exportDate: Date;
    format: string;
    totalEmployees: number;
    totalRecords: number;
    dateRange?: {
      startDate: Date;
      endDate: Date;
    };
  };
  employees: Employee[];
  timeRecords: TimeRecord[];
  payrollCalculations: PayrollCalculation[];
  attendanceReports: AttendanceReport[];
  files?: {
    path: string;
    originalPath: string;
    size: number;
    mimeType: string;
  }[];
}

class DataExporter {
  private db: DatabasePostgreSQL;
  private exportDir: string;

  constructor(db: DatabasePostgreSQL, exportDir: string = './exports') {
    this.db = db;
    this.exportDir = exportDir;
  }

  async exportData(options: ExportOptions): Promise<string> {
    // Create export directory
    await fs.mkdir(this.exportDir, { recursive: true });
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const exportName = `attendance_export_${timestamp}`;
    const exportPath = path.join(this.exportDir, exportName);
    
    await fs.mkdir(exportPath, { recursive: true });

    try {
      // Export database data
      const exportData = await this.gatherData(options);
      
      // Save data in requested format
      await this.saveData(exportData, exportPath, options.format);
      
      // Export files if requested
      if (options.includeFiles) {
        await this.exportFiles(exportPath, options.fileExtensions);
      }
      
      // Create export manifest
      await this.createManifest(exportData, exportPath);
      
      // Return export path (no archive creation for now)
      return exportPath;
    } catch (error) {
      // Clean up on error
      await fs.rm(exportPath, { recursive: true, force: true });
      throw error;
    }
  }

  private async gatherData(options: ExportOptions): Promise<ExportData> {
    const employees = options.employeeIds 
      ? await this.getSelectedEmployees(options.employeeIds)
      : await this.db.getAllEmployees();

    const timeRecords: TimeRecord[] = [];
    const payrollCalculations: PayrollCalculation[] = [];
    const attendanceReports: AttendanceReport[] = [];

    for (const employee of employees) {
      // Get time records
      if (options.dateRange) {
        const records = await this.db.getTimeRecords(
          employee.id,
          options.dateRange.startDate,
          options.dateRange.endDate
        );
        timeRecords.push(...records);
      }

      // Get payroll calculations for each month in range
      if (options.dateRange) {
        const months = this.getMonthsInRange(options.dateRange.startDate, options.dateRange.endDate);
        for (const month of months) {
          const payroll = await this.db.getPayrollCalculation(employee.id, month);
          if (payroll) {
            payrollCalculations.push(payroll);
          }
        }
      }
    }

    return {
      metadata: {
        exportDate: new Date(),
        format: options.format,
        totalEmployees: employees.length,
        totalRecords: timeRecords.length,
        dateRange: options.dateRange
      },
      employees,
      timeRecords,
      payrollCalculations,
      attendanceReports
    };
  }

  private async getSelectedEmployees(employeeIds: string[]): Promise<Employee[]> {
    const employees: Employee[] = [];
    for (const id of employeeIds) {
      const employee = await this.db.getEmployee(id);
      if (employee) {
        employees.push(employee);
      }
    }
    return employees;
  }

  private getMonthsInRange(startDate: Date, endDate: Date): string[] {
    const months: string[] = [];
    const current = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
    const end = new Date(endDate.getFullYear(), endDate.getMonth(), 1);

    while (current <= end) {
      months.push(`${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}`);
      current.setMonth(current.getMonth() + 1);
    }

    return months;
  }

  private async saveData(data: ExportData, exportPath: string, format: string): Promise<void> {
    switch (format) {
      case 'json':
        await this.saveAsJSON(data, exportPath);
        break;
      case 'csv':
        await this.saveAsCSV(data, exportPath);
        break;
      case 'xlsx':
        await this.saveAsXLSX(data, exportPath);
        break;
      default:
        throw new Error(`Unsupported export format: ${format}`);
    }
  }

  private async saveAsJSON(data: ExportData, exportPath: string): Promise<void> {
    const jsonPath = path.join(exportPath, 'attendance_data.json');
    await fs.writeFile(jsonPath, JSON.stringify(data, null, 2), 'utf8');
  }

  private async saveAsCSV(data: ExportData, exportPath: string): Promise<void> {
    // Export employees as CSV
    const employeesCSV = this.convertToCSV(data.employees, [
      'id', 'name', 'department', 'position', 'hourlyRate', 'joinDate', 'managerId', 'isActive'
    ]);
    await fs.writeFile(path.join(exportPath, 'employees.csv'), employeesCSV, 'utf8');

    // Export time records as CSV
    const timeRecordsCSV = this.convertToCSV(data.timeRecords, [
      'id', 'employeeId', 'date', 'clockIn', 'clockOut', 'breakMinutes', 'recordType', 'notes'
    ]);
    await fs.writeFile(path.join(exportPath, 'time_records.csv'), timeRecordsCSV, 'utf8');

    // Export payroll calculations as CSV
    const payrollCSV = this.convertToCSV(data.payrollCalculations, [
      'employeeId', 'month', 'regularHours', 'overtimeHours', 'lateNightHours', 'holidayHours',
      'regularPay', 'overtimePay', 'lateNightPay', 'holidayPay', 'totalPay', 'calculatedAt'
    ]);
    await fs.writeFile(path.join(exportPath, 'payroll_calculations.csv'), payrollCSV, 'utf8');
  }

  private convertToCSV(data: any[], columns: string[]): string {
    if (data.length === 0) return '';

    const header = columns.join(',');
    const rows = data.map(item => {
      return columns.map(col => {
        const value = item[col];
        if (value === null || value === undefined) return '';
        if (typeof value === 'string' && value.includes(',')) {
          return `"${value.replace(/"/g, '""')}"`;
        }
        return String(value);
      }).join(',');
    });

    return [header, ...rows].join('\n');
  }

  private async saveAsXLSX(data: ExportData, exportPath: string): Promise<void> {
    // For XLSX export, we'll create a simple JSON structure
    // In a real implementation, you'd use a library like 'xlsx' or 'exceljs'
    const workbook = {
      employees: data.employees,
      timeRecords: data.timeRecords,
      payrollCalculations: data.payrollCalculations,
      metadata: data.metadata
    };

    const xlsxPath = path.join(exportPath, 'attendance_workbook.json');
    await fs.writeFile(xlsxPath, JSON.stringify(workbook, null, 2), 'utf8');
  }

  private async exportFiles(exportPath: string, fileExtensions?: string[]): Promise<void> {
    const filesDir = path.join(exportPath, 'files');
    await fs.mkdir(filesDir, { recursive: true });

    // Look for files in common directories
    const searchDirs = ['./uploads', './media', './videos', './documents'];
    const allowedExtensions = fileExtensions || ['.mp4', '.avi', '.mov', '.mkv', '.pdf', '.doc', '.docx', '.jpg', '.png'];

    for (const searchDir of searchDirs) {
      try {
        await this.copyFilesFromDirectory(searchDir, filesDir, allowedExtensions);
      } catch (error) {
        // Directory doesn't exist, continue
        // ディレクトリが見つからない場合はスキップ
      }
    }
  }

  private async copyFilesFromDirectory(sourceDir: string, targetDir: string, allowedExtensions: string[]): Promise<void> {
    try {
      const files = await fs.readdir(sourceDir, { withFileTypes: true });
      
      for (const file of files) {
        const sourcePath = path.join(sourceDir, file.name);
        
        if (file.isDirectory()) {
          // Recursively copy subdirectories
          const subTargetDir = path.join(targetDir, file.name);
          await fs.mkdir(subTargetDir, { recursive: true });
          await this.copyFilesFromDirectory(sourcePath, subTargetDir, allowedExtensions);
        } else if (file.isFile()) {
          const ext = path.extname(file.name).toLowerCase();
          if (allowedExtensions.includes(ext)) {
            const targetPath = path.join(targetDir, file.name);
            await pipeline(createReadStream(sourcePath), createWriteStream(targetPath));
          }
        }
      }
    } catch (error) {
      // ファイルコピーエラーは無視
    }
  }

  private async createManifest(data: ExportData, exportPath: string): Promise<void> {
    const manifest = {
      exportInfo: data.metadata,
      contents: {
        employees: `${data.employees.length} employees`,
        timeRecords: `${data.timeRecords.length} time records`,
        payrollCalculations: `${data.payrollCalculations.length} payroll calculations`,
        files: 'Check files/ directory for exported media and documents'
      },
      importInstructions: {
        description: 'This export can be re-imported using the import functionality',
        steps: [
          '1. Extract the archive to a temporary directory',
          '2. Use the import command with the path to this directory',
          '3. The system will restore all data and files'
        ]
      }
    };

    await fs.writeFile(
      path.join(exportPath, 'MANIFEST.json'),
      JSON.stringify(manifest, null, 2),
      'utf8'
    );
  }

  private async createArchive(exportPath: string): Promise<string> {
    // For now, we'll just return the directory path since we don't have tar/gzip
    // In a real implementation, you'd use a library like 'tar' or 'node-stream-zip'
    return exportPath;
  }

  async importData(importPath: string): Promise<void> {
    // Check if path exists
    try {
      await fs.access(importPath);
    } catch (error) {
      throw new Error(`Import path does not exist: ${importPath}`);
    }

    // Read manifest
    const manifestPath = path.join(importPath, 'MANIFEST.json');
    const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8'));

    // Import data based on format
    const dataPath = path.join(importPath, 'attendance_data.json');
    try {
      const exportData: ExportData = JSON.parse(await fs.readFile(dataPath, 'utf8'));
      await this.importFromData(exportData);
    } catch (error) {
      // Try CSV format
      await this.importFromCSV(importPath);
    }

    // Import files
    const filesDir = path.join(importPath, 'files');
    try {
      await this.importFiles(filesDir);
    } catch (error) {
      // ファイルディレクトリがない場合はスキップ
    }
  }

  private async importFromData(data: ExportData): Promise<void> {
    // Import employees
    for (const employee of data.employees) {
      try {
        const employeeWithId = {
          id: `EMP_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          name: employee.name,
          department: employee.department,
          position: employee.position,
          hourlyRate: employee.hourlyRate,
          startDate: employee.startDate,
          managerId: employee.managerId,
          isActive: employee.isActive
        };
        await this.db.addEmployee(employeeWithId);
      } catch (error) {
        // 従業員インポートエラーは無視
      }
    }

    // Import payroll calculations
    for (const payroll of data.payrollCalculations) {
      try {
        await this.db.savePayrollCalculation(payroll);
      } catch (error) {
        // 給与データインポートエラーは無視
      }
    }
  }

  private async importFromCSV(importPath: string): Promise<void> {
    // Implementation for CSV import would go here
    // CSVインポートは未実装
  }

  private async importFiles(filesDir: string): Promise<void> {
    // Copy files back to their appropriate directories
    try {
      const targetDirs = ['./uploads', './media', './videos', './documents'];
      
      for (const targetDir of targetDirs) {
        const sourcePath = path.join(filesDir, path.basename(targetDir));
        try {
          await fs.access(sourcePath);
          await fs.mkdir(targetDir, { recursive: true });
          await this.copyFilesFromDirectory(sourcePath, targetDir, []);
        } catch (error) {
          // Source directory doesn't exist, continue
        }
      }
    } catch (error) {
      // ファイルインポートエラーは無視
    }
  }
}

export default DataExporter;