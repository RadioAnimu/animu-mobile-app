// Metro resolves an image to its asset registry id (what `source` takes).
declare module "*.webp" {
  const webp: number;
  export default webp;
}
