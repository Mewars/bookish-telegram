import { brandAssets } from '../utils/brand';

export function BrandMark({ size = 32, className = '' }: { size?: number; className?: string }) {
  return <img className={`brand-mark ${className}`} src={brandAssets.star} width={size} height={size} alt="" aria-hidden="true"/>;
}
