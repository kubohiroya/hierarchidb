import type { MemoryData } from '../hooks/useMemoryData.js';
/**
  * : Canvas
 * :
 * :
 * : Canvas API
  */
export interface CanvasRenderOptions {
    width: number;
    height: number;
    theme: {
        palette: {
            divider: string;
            warning: {
                main: string;
            };
            error: {
                main: string;
            };
            text: {
                primary: string;
            };
        };
    };
    categoryColors: {
        [key: string]: string;
    };
    warningThreshold: number;
    criticalThreshold: number;
    showGrid: boolean;
    showAxes: boolean;
}
export interface ChartDataPoint {
    timestamp: number;
    memoryData: MemoryData;
}
/**
  * : Canvas
 * :
 * :
 * : Canvas API
  */
export declare class CanvasRenderer {
    private canvas;
    private ctx;
    private dataPoints;
    private animationId;
    /**
        * : Canvas
     * :
     * : Canvas API
        */
    constructor(canvas: HTMLCanvasElement);
    /**
        * : Retina/DPI
     * :
     * :
     * : CanvasDPI
        */
    private setupHighDPI;
    /**
        * :
     * :
     * :
     * :
        */
    addDataPoint(memoryData: MemoryData, maxDataPoints?: number): void;
    /**
        * :
     * :
     * :
        */
    clearData(): void;
    /**
        * :
     * :
     * :
     * :
        */
    render(options: CanvasRenderOptions): void;
    /**
        * :
     * :
     * :
     * : Canvas
        */
    private drawGrid;
    /**
        * :
     * :
     * :
     * :
        */
    private drawThresholdLines;
    /**
        * :
     * :
     * :
     * :
        */
    private drawChart;
    /**
        * : XY
     * :
     * :
     * :
        */
    private drawAxes;
    /**
        * : Canvas
     * :
     * :
     * :
        */
    dispose(): void;
}
//# sourceMappingURL=CanvasRenderer.d.ts.map