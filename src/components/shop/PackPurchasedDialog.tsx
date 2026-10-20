import { PackType } from '@/types/pack';
import packStandard5Img from '@/assets/pack-standard-5.png';
import packStandard10Img from '@/assets/pack-standard-10.png';
import packStandard20Img from '@/assets/pack-standard-20.png';
import packStandard50Img from '@/assets/pack-standard-50.png';
import packLucky5Img from '@/assets/pack-lucky-5.png';
import packLucky10Img from '@/assets/pack-lucky-10.png';
import packLucky20Img from '@/assets/pack-lucky-20.png';
import packLucky50Img from '@/assets/pack-lucky-50.png';
import packUltra5Img from '@/assets/pack-ultra-5.png';
import packUltra10Img from '@/assets/pack-ultra-10.png';
import packUltra20Img from '@/assets/pack-ultra-20.png';
import packUltra50Img from '@/assets/pack-ultra-50.png';
import packBoosterImg from '@/assets/pack-booster.png';
import packLuckyImg from '@/assets/pack-lucky.png';
import packUltraImg from '@/assets/pack-ultra.png';

const PACK_IMAGE_MAP: Record<string, string> = {
  standard_5: packStandard5Img,
  standard_10: packStandard10Img,
  standard_20: packStandard20Img,
  standard_50: packStandard50Img,
  lucky_5: packLucky5Img,
  lucky_10: packLucky10Img,
  lucky_20: packLucky20Img,
  lucky_50: packLucky50Img,
  ultra_5: packUltra5Img,
  ultra_10: packUltra10Img,
  ultra_20: packUltra20Img,
  ultra_50: packUltra50Img,
  standard: packStandard10Img,
  lucky: packLuckyImg,
  ultra: packUltraImg,
  booster: packBoosterImg,
};

export const getPackImage = (packId: string = ''): string => {
  const clean = packId.toLowerCase().trim();
  if (PACK_IMAGE_MAP[clean]) return PACK_IMAGE_MAP[clean];

  if (clean.includes('ultra')) {
    if (clean.includes('50')) return packUltra50Img;
    if (clean.includes('20')) return packUltra20Img;
    if (clean.includes('5')) return packUltra5Img;
    return packUltra10Img;
  }
  if (clean.includes('lucky') || clean.includes('chanceux')) {
    if (clean.includes('50')) return packLucky50Img;
    if (clean.includes('20')) return packLucky20Img;
    if (clean.includes('5')) return packLucky5Img;
    return packLucky10Img;
  }
  if (clean.includes('50')) return packStandard50Img;
  if (clean.includes('20')) return packStandard20Img;
  if (clean.includes('5')) return packStandard5Img;
  return packStandard10Img;
};

