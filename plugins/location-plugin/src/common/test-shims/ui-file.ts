export const downloadFile = async (_url: string): Promise<Blob> => {
  return new Blob([''], { type: 'text/plain' });
};
