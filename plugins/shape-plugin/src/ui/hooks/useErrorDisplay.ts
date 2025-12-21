export const useErrorDisplay = (error?: Error | null) => {
  if (!error) {
    return { message: null };
  }
  return { message: error.message };
};
