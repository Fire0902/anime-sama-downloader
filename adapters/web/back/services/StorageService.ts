import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';

export interface StorageInfo {
  downloadPath: string;
  downloadPathSize: number;       // Bytes used by download folder
  diskTotal: number;              // Total disk space
  diskFree: number;               // Free disk space
  diskUsed: number;               // Used disk space
  percentUsed: number;            // Percentage of disk used (0-100)
  percentDownloadOfDisk: number;  // Percentage download folder uses of disk
}

class StorageService {
  /**
   * Get human readable size
   */
  private static formatBytes(bytes: number): string {
    if (bytes === 0 || !Number.isFinite(bytes) || bytes < 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  }

  /**
   * Calculate directory size recursively
   */
  private static getDirectorySize(dir: string): number {
    if (!fs.existsSync(dir)) {
      return 0;
    }

    let size = 0;
    const files = fs.readdirSync(dir);

    for (const file of files) {
      try {
        const filePath = path.join(dir, file);
        const stats = fs.statSync(filePath);
        if (stats.isDirectory()) {
          size += this.getDirectorySize(filePath);
        } else {
          size += stats.size;
        }
      } catch (error) {
        // Skip files that can't be accessed
      }
    }

    return size;
  }

  /**
   * Get disk space info using fs.statfsSync (cross-platform) or fallback to OS-specific commands
   */
  private static getDiskSpace(dirPath: string): { total: number; free: number } {
    try {
      // Try using fs.statfsSync (available on Node 18+)
      if (fs.statfsSync) {
        const stats = fs.statfsSync(dirPath);
        return {
          total: stats.blocks * stats.blockSize,
          free: stats.bavail * stats.blockSize
        };
      }
    } catch (error) {
      // Fall back if statfsSync fails
    }

    // Fallback: use df command on Unix/Mac or powershell on Windows
    try {
      const platform = os.platform();

      if (platform === 'win32') {
        // Windows: use PowerShell
        return this.getWinDiskSpace(dirPath);
      } else {
        // Unix/Linux/Mac: use df
        return this.getUnixDiskSpace(dirPath);
      }
    } catch (error) {
      console.error('Error getting disk space:', error);
    }

    return { total: 0, free: 0 };
  }

  /**
   * Get disk space on Unix/Linux/macOS using df command
   */
  private static getUnixDiskSpace(dir: string): { total: number; free: number } {
    try {
      const output = execSync(`df -B1 "${dir}"`, {
        encoding: 'utf-8'
      });
      const lines = output.split('\n');
      if (lines.length >= 2) {
        const parts = lines[1].split(/\s+/);
        if (parts.length >= 4) {
          return {
            total: parseInt(parts[1], 10),
            free: parseInt(parts[3], 10)
          };
        }
      }
    } catch (error) {
      console.error('Error getting Unix disk space:', error);
    }

    return { total: 0, free: 0 };
  }

  /**
   * Get disk space on Windows using PowerShell
   */
  private static getWinDiskSpace(dirPath: string): { total: number; free: number } {
    try {
      const drive = path.parse(dirPath).root.replace(/\\/g, '');

      // PowerShell command to get disk info
      const psCommand = `Get-Volume -DriveLetter ${drive} | Select-Object @{Name='Total';Expression={$_.Size}},@{Name='Free';Expression={$_.SizeRemaining}} | ConvertTo-Json`;

      const output = execSync(`powershell -Command "${psCommand}"`, {
        encoding: 'utf-8'
      });

      const data = JSON.parse(output);
      return {
        total: data.Total || 0,
        free: data.Free || 0
      };
    } catch (error) {
      console.error('Error getting Windows disk space:', error);
    }

    return { total: 0, free: 0 };
  }

  /**
   * Get storage information
   */
  static getStorageInfo(downloadPath: string): StorageInfo {
    try {
      const diskSpace = this.getDiskSpace(downloadPath);
      const downloadPathSize = this.getDirectorySize(downloadPath);
      const diskUsed = diskSpace.total - diskSpace.free;
      const percentUsed = diskSpace.total > 0 ? (diskUsed / diskSpace.total) * 100 : 0;
      const percentDownloadOfDisk = diskSpace.total > 0 ? (downloadPathSize / diskSpace.total) * 100 : 0;

      return {
        downloadPath,
        downloadPathSize,
        diskTotal: diskSpace.total,
        diskFree: diskSpace.free,
        diskUsed,
        percentUsed,
        percentDownloadOfDisk
      };
    } catch (error) {
      console.error('Error getting storage info:', error);
      return {
        downloadPath,
        downloadPathSize: 0,
        diskTotal: 0,
        diskFree: 0,
        diskUsed: 0,
        percentUsed: 0,
        percentDownloadOfDisk: 0
      };
    }
  }

  /**
   * Format storage info for API response
   */
  static formatStorageInfo(info: StorageInfo) {
    return {
      ...info,
      downloadPathSizeFormatted: this.formatBytes(info.downloadPathSize),
      diskTotalFormatted: this.formatBytes(info.diskTotal),
      diskFreeFormatted: this.formatBytes(info.diskFree),
      diskUsedFormatted: this.formatBytes(info.diskUsed)
    };
  }
}

export default StorageService;
