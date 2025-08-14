export const generateImageUrl = (email?: string): string => {
  if (!email) return '';
  // Basic Gravatar URL generation
  return `https://www.gravatar.com/avatar/${btoa(email.toLowerCase().trim())}?d=identicon&s=40`;
};
