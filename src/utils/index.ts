function isUrlAnImage(url: string) {
  return url.match(/\.(jpeg|jpg|gif|png|webp)$/) != null;
}

export { isUrlAnImage };
