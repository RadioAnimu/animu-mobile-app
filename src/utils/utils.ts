export const isUrlAnImageFormat = (url: string): boolean => {
  return url.match(/\.(jpeg|jpg|gif|png|webp)$/) != null;
};
