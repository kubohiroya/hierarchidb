export interface NetworkPortLike {
  get(
    url: string,
    init?: RequestInit
  ): Promise<{ ok: boolean; status: number; arrayBuffer(): Promise<ArrayBuffer> }>;
}
