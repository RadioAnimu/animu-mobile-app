import { myPlayer, MyPlayerProps } from "./player";

function isUrlAnImage(url: string) {
  return url.match(/\.(jpeg|jpg|gif|png|webp)$/) != null;
}

export { isUrlAnImage, myPlayer, MyPlayerProps };
