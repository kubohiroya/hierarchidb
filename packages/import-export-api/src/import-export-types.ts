export interface FileLike {
  name: string;
  size: number;
  type?: string;
  lastModified?: number;
  arrayBuffer: () => Promise<ArrayBuffer>;
}
