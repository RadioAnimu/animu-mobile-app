// Metro resolves an image to its asset registry id (what `source` takes).
declare module "*.png" {
  const png: number;
  export default png;
}
