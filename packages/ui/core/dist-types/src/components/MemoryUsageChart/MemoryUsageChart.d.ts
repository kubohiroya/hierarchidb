import type React from 'react';
export interface MemoryUsageChartProps {
    /**
        */
    variant?: 'simple' | 'detailed' | 'compact';
    /**
        */
    width?: string | number;
    /**
        */
    height?: number;
    /**
        */
    updateInterval?: number;
    /**
        */
    timeRange?: number;
    /**
        */
    maxDataPoints?: number;
    /**
        */
    categoryColors?: {
        [key: string]: string;
    };
    /**
     * 0-1
     */
    warningThreshold?: number;
    /**
     * 0-1
     */
    criticalThreshold?: number;
    /**
        */
    showGrid?: boolean;
    /**
        */
    showLegend?: boolean;
    /**
        */
    maxMemory?: number;
}
/**
  * :
 * :
 * :
 * : React
  */
export declare const MemoryUsageChart: React.FC<MemoryUsageChartProps>;
//# sourceMappingURL=MemoryUsageChart.d.ts.map