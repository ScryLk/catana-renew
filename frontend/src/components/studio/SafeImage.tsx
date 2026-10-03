import type { ImgHTMLAttributes } from 'react';
import { isSafeImageUrl } from '../../utils/imagePolicy';
export function SafeImage(props: Omit<ImgHTMLAttributes<HTMLImageElement>, 'src'> & {src?: string | null}) {
  return isSafeImageUrl(props.src) ? <img {...props} src={props.src} /> : null;
}
