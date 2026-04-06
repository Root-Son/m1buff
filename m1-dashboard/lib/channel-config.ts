/* ──────────────────────────────────────────────
 * 채널별 가중치 / 할인율 설정
 * 셋팅가 × (1 + markup) = gross
 * gross × (1 - minDiscount) = 최대 노출가
 * gross × (1 - maxDiscount) = 최소 노출가
 * ────────────────────────────────────────────── */

export interface ChannelRate {
  markup: number;      // 채널 가중치 (0.16 = 16%)
  minDiscount: number; // 최소 할인율 (0.10 = 10%)
  maxDiscount: number; // 최대 할인율 (0.30 = 30%)
}

export type BranchChannelConfig = Record<string, ChannelRate>;

const CHANNELS = ["부킹닷컴", "씨트립", "아고다", "익스피디아", "야놀자", "여기어때", "트립토파즈", "에어비앤비"] as const;
export { CHANNELS };

// 기본값 (매핑 안 된 지점용)
const DEFAULT: BranchChannelConfig = {
  "부킹닷컴":   { markup: 0.12, minDiscount: 0.10, maxDiscount: 0.25 },
  "씨트립":     { markup: 0.05, minDiscount: 0.10, maxDiscount: 0.27 },
  "아고다":     { markup: 0.15, minDiscount: 0.10, maxDiscount: 0.20 },
  "익스피디아":  { markup: 0.10, minDiscount: 0.10, maxDiscount: 0.20 },
  "야놀자":     { markup: 0.15, minDiscount: 0,    maxDiscount: 0.25 },
  "여기어때":   { markup: 0.10, minDiscount: 0,    maxDiscount: 0.15 },
  "트립토파즈":  { markup: 0,    minDiscount: 0,    maxDiscount: 0.10 },
  "에어비앤비":  { markup: 0,    minDiscount: 0,    maxDiscount: 0.15 },
};

// 지점별 채널 설정
const BRANCH_CHANNELS: Record<string, BranchChannelConfig> = {
  // ── 서울 ──
  "강남예전로이움점": {
    "부킹닷컴":   { markup: 0.16, minDiscount: 0.10, maxDiscount: 0.30 },
    "씨트립":     { markup: 0.19, minDiscount: 0.10, maxDiscount: 0.33 },
    "아고다":     { markup: 0.20, minDiscount: 0.10, maxDiscount: 0.20 },
    "익스피디아":  { markup: 0.03, minDiscount: 0.10, maxDiscount: 0.20 },
    "야놀자":     { markup: 0.10, minDiscount: 0.10, maxDiscount: 0.20 },
    "여기어때":   { markup: 0.10, minDiscount: 0,    maxDiscount: 0.15 },
    "트립토파즈":  { markup: 0,    minDiscount: 0,    maxDiscount: 0.15 },
    "에어비앤비":  { markup: 0,    minDiscount: 0,    maxDiscount: 0.20 },
  },
  "강남예전시그니티점": {
    "부킹닷컴":   { markup: 0.10, minDiscount: 0.10, maxDiscount: 0.30 },
    "씨트립":     { markup: 0.13, minDiscount: 0.10, maxDiscount: 0.33 },
    "아고다":     { markup: 0.20, minDiscount: 0.10, maxDiscount: 0.20 },
    "익스피디아":  { markup: 0.05, minDiscount: 0.10, maxDiscount: 0.25 },
    "야놀자":     { markup: 0,    minDiscount: 0.10, maxDiscount: 0.20 },
    "여기어때":   { markup: 0.10, minDiscount: 0,    maxDiscount: 0.15 },
    "트립토파즈":  { markup: 0,    minDiscount: 0,    maxDiscount: 0.15 },
    "에어비앤비":  { markup: 0,    minDiscount: 0,    maxDiscount: 0.20 },
  },
  "명동점": {
    "부킹닷컴":   { markup: 0.15, minDiscount: 0.10, maxDiscount: 0.30 },
    "씨트립":     { markup: 0.03, minDiscount: 0.10, maxDiscount: 0.33 },
    "아고다":     { markup: 0.20, minDiscount: 0.10, maxDiscount: 0.20 },
    "익스피디아":  { markup: 0.14, minDiscount: 0.10, maxDiscount: 0.25 },
    "야놀자":     { markup: 0.10, minDiscount: 0,    maxDiscount: 0.20 },
    "여기어때":   { markup: 0.10, minDiscount: 0,    maxDiscount: 0.15 },
    "트립토파즈":  { markup: 0,    minDiscount: 0,    maxDiscount: 0.15 },
    "에어비앤비":  { markup: 0,    minDiscount: 0,    maxDiscount: 0.20 },
  },
  "부티크익선점": {
    "부킹닷컴":   { markup: 0.10, minDiscount: 0.10, maxDiscount: 0.30 },
    "씨트립":     { markup: 0.03, minDiscount: 0.10, maxDiscount: 0.35 },
    "아고다":     { markup: 0.20, minDiscount: 0.10, maxDiscount: 0.20 },
    "익스피디아":  { markup: 0.07, minDiscount: 0.10, maxDiscount: 0.16 },
    "야놀자":     { markup: 0.10, minDiscount: 0,    maxDiscount: 0.20 },
    "여기어때":   { markup: 0.10, minDiscount: 0,    maxDiscount: 0.15 },
    "트립토파즈":  { markup: 0,    minDiscount: 0,    maxDiscount: 0.15 },
    "에어비앤비":  { markup: 0,    minDiscount: 0,    maxDiscount: 0.20 },
  },

  // ── 부산 A ──
  "해운대패러그라프점": {
    "부킹닷컴":   { markup: 0.10, minDiscount: 0.10, maxDiscount: 0.25 },
    "씨트립":     { markup: 0,    minDiscount: 0.10, maxDiscount: 0.25 },
    "아고다":     { markup: 0.15, minDiscount: 0.10, maxDiscount: 0.20 },
    "익스피디아":  { markup: 0.07, minDiscount: 0.10, maxDiscount: 0.15 },
    "야놀자":     { markup: 0.20, minDiscount: 0,    maxDiscount: 0.25 },
    "여기어때":   { markup: 0.10, minDiscount: 0,    maxDiscount: 0.15 },
    "트립토파즈":  { markup: 0,    minDiscount: 0,    maxDiscount: 0.15 },
    "에어비앤비":  { markup: 0,    minDiscount: 0,    maxDiscount: 0.20 },
  },
  "해운대역": {
    "부킹닷컴":   { markup: 0.10, minDiscount: 0.10, maxDiscount: 0.25 },
    "씨트립":     { markup: 0.03, minDiscount: 0.10, maxDiscount: 0.25 },
    "아고다":     { markup: 0.15, minDiscount: 0.10, maxDiscount: 0.20 },
    "익스피디아":  { markup: 0.12, minDiscount: 0.10, maxDiscount: 0.15 },
    "야놀자":     { markup: 0.20, minDiscount: 0,    maxDiscount: 0.25 },
    "여기어때":   { markup: 0.10, minDiscount: 0,    maxDiscount: 0.15 },
    "트립토파즈":  { markup: 0,    minDiscount: 0,    maxDiscount: 0.15 },
    "에어비앤비":  { markup: 0,    minDiscount: 0,    maxDiscount: 0.20 },
  },
  "부산기장점": {
    "부킹닷컴":   { markup: 0.10, minDiscount: 0.10, maxDiscount: 0.25 },
    "씨트립":     { markup: 0.03, minDiscount: 0.10, maxDiscount: 0.25 },
    "아고다":     { markup: 0.15, minDiscount: 0.10, maxDiscount: 0.20 },
    "익스피디아":  { markup: 0.07, minDiscount: 0.10, maxDiscount: 0.16 },
    "야놀자":     { markup: 0.20, minDiscount: 0,    maxDiscount: 0.25 },
    "여기어때":   { markup: 0.10, minDiscount: 0,    maxDiscount: 0.15 },
    "트립토파즈":  { markup: 0,    minDiscount: 0,    maxDiscount: 0.15 },
    "에어비앤비":  { markup: 0,    minDiscount: 0,    maxDiscount: 0.20 },
  },
  "부산역점": {
    "부킹닷컴":   { markup: 0.10, minDiscount: 0.10, maxDiscount: 0.25 },
    "씨트립":     { markup: 0,    minDiscount: 0.10, maxDiscount: 0.25 },
    "아고다":     { markup: 0.15, minDiscount: 0.10, maxDiscount: 0.20 },
    "익스피디아":  { markup: 0.07, minDiscount: 0.10, maxDiscount: 0.20 },
    "야놀자":     { markup: 0.20, minDiscount: 0,    maxDiscount: 0.25 },
    "여기어때":   { markup: 0.10, minDiscount: 0,    maxDiscount: 0.15 },
    "트립토파즈":  { markup: 0,    minDiscount: 0,    maxDiscount: 0.15 },
    "에어비앤비":  { markup: 0,    minDiscount: 0,    maxDiscount: 0.20 },
  },

  // ── 부산 B ──
  "서면점": {
    "부킹닷컴":   { markup: 0.15, minDiscount: 0.10, maxDiscount: 0.30 },
    "씨트립":     { markup: 0.15, minDiscount: 0.10, maxDiscount: 0.25 },
    "아고다":     { markup: 0.15, minDiscount: 0.10, maxDiscount: 0.20 },
    "익스피디아":  { markup: 0.15, minDiscount: 0.10, maxDiscount: 0.20 },
    "야놀자":     { markup: 0.20, minDiscount: 0,    maxDiscount: 0.25 },
    "여기어때":   { markup: 0.10, minDiscount: 0,    maxDiscount: 0.15 },
    "트립토파즈":  { markup: 0,    minDiscount: 0,    maxDiscount: 0.15 },
    "에어비앤비":  { markup: 0,    minDiscount: 0,    maxDiscount: 0.20 },
  },
  "부산시청점": {
    "부킹닷컴":   { markup: 0.10, minDiscount: 0.10, maxDiscount: 0.25 },
    "씨트립":     { markup: 0.03, minDiscount: 0.10, maxDiscount: 0.25 },
    "아고다":     { markup: 0.15, minDiscount: 0.10, maxDiscount: 0.20 },
    "익스피디아":  { markup: 0.07, minDiscount: 0.10, maxDiscount: 0.20 },
    "야놀자":     { markup: 0.20, minDiscount: 0,    maxDiscount: 0.25 },
    "여기어때":   { markup: 0.10, minDiscount: 0,    maxDiscount: 0.15 },
    "트립토파즈":  { markup: 0,    minDiscount: 0,    maxDiscount: 0.15 },
    "에어비앤비":  { markup: 0,    minDiscount: 0,    maxDiscount: 0.20 },
  },
  "부티크남포BIFF점": {
    "부킹닷컴":   { markup: 0.15, minDiscount: 0.10, maxDiscount: 0.20 },
    "씨트립":     { markup: 0.03, minDiscount: 0.10, maxDiscount: 0.25 },
    "아고다":     { markup: 0.15, minDiscount: 0.10, maxDiscount: 0.20 },
    "익스피디아":  { markup: 0.10, minDiscount: 0.10, maxDiscount: 0.20 },
    "야놀자":     { markup: 0.20, minDiscount: 0,    maxDiscount: 0.25 },
    "여기어때":   { markup: 0.10, minDiscount: 0,    maxDiscount: 0.15 },
    "트립토파즈":  { markup: 0,    minDiscount: 0,    maxDiscount: 0.15 },
    "에어비앤비":  { markup: 0,    minDiscount: 0,    maxDiscount: 0.20 },
  },
  "부산송도해변점": {
    "부킹닷컴":   { markup: 0.12, minDiscount: 0.10, maxDiscount: 0.30 },
    "씨트립":     { markup: 0.03, minDiscount: 0.10, maxDiscount: 0.22 },
    "아고다":     { markup: 0.15, minDiscount: 0.10, maxDiscount: 0.20 },
    "익스피디아":  { markup: 0.07, minDiscount: 0.10, maxDiscount: 0.20 },
    "야놀자":     { markup: 0.20, minDiscount: 0,    maxDiscount: 0.25 },
    "여기어때":   { markup: 0.10, minDiscount: 0,    maxDiscount: 0.15 },
    "트립토파즈":  { markup: 0,    minDiscount: 0,    maxDiscount: 0.15 },
    "에어비앤비":  { markup: 0,    minDiscount: 0,    maxDiscount: 0.20 },
  },
  "스타즈울산점": {
    "부킹닷컴":   { markup: 0.10, minDiscount: 0.10, maxDiscount: 0.25 },
    "씨트립":     { markup: 0.03, minDiscount: 0.10, maxDiscount: 0.25 },
    "아고다":     { markup: 0.05, minDiscount: 0.10, maxDiscount: 0.20 },
    "익스피디아":  { markup: 0.07, minDiscount: 0.10, maxDiscount: 0.16 },
    "야놀자":     { markup: 0.20, minDiscount: 0,    maxDiscount: 0.25 },
    "여기어때":   { markup: 0.10, minDiscount: 0,    maxDiscount: 0.15 },
    "트립토파즈":  { markup: 0,    minDiscount: 0,    maxDiscount: 0.15 },
    "에어비앤비":  { markup: 0,    minDiscount: 0,    maxDiscount: 0.15 },
  },

  // ── 경인비수도 ──
  "거북섬점": {
    "부킹닷컴":   { markup: 0.10, minDiscount: 0.10, maxDiscount: 0.25 },
    "씨트립":     { markup: 0.10, minDiscount: 0.15, maxDiscount: 0.27 },
    "아고다":     { markup: 0.17, minDiscount: 0.15, maxDiscount: 0.24 },
    "익스피디아":  { markup: 0.07, minDiscount: 0.10, maxDiscount: 0.20 },
    "야놀자":     { markup: 0.20, minDiscount: 0,    maxDiscount: 0.20 },
    "여기어때":   { markup: 0.10, minDiscount: 0,    maxDiscount: 0.20 },
    "트립토파즈":  { markup: 0,    minDiscount: 0,    maxDiscount: 0 },
    "에어비앤비":  { markup: -0.10, minDiscount: 0,   maxDiscount: 0 },
  },
  "웨이브파크점": {
    "부킹닷컴":   { markup: 0.13, minDiscount: 0.10, maxDiscount: 0.30 },
    "씨트립":     { markup: 0.09, minDiscount: 0.10, maxDiscount: 0.33 },
    "아고다":     { markup: 0.18, minDiscount: 0.15, maxDiscount: 0.25 },
    "익스피디아":  { markup: 0.13, minDiscount: 0.10, maxDiscount: 0.30 },
    "야놀자":     { markup: 0.20, minDiscount: 0,    maxDiscount: 0.20 },
    "여기어때":   { markup: 0.10, minDiscount: 0,    maxDiscount: 0.20 },
    "트립토파즈":  { markup: 0,    minDiscount: 0,    maxDiscount: 0 },
    "에어비앤비":  { markup: -0.10, minDiscount: 0,   maxDiscount: 0 },
  },
  "호텔 동탄": {
    "부킹닷컴":   { markup: 0.10, minDiscount: 0.10, maxDiscount: 0.15 },
    "씨트립":     { markup: 0,    minDiscount: 0.10, maxDiscount: 0.26 },
    "아고다":     { markup: 0.10, minDiscount: 0.15, maxDiscount: 0.24 },
    "익스피디아":  { markup: 0.11, minDiscount: 0.10, maxDiscount: 0.21 },
    "야놀자":     { markup: 0.20, minDiscount: 0,    maxDiscount: 0.20 },
    "여기어때":   { markup: 0.10, minDiscount: 0,    maxDiscount: 0.20 },
    "트립토파즈":  { markup: 0,    minDiscount: 0,    maxDiscount: 0 },
    "에어비앤비":  { markup: -0.10, minDiscount: 0,   maxDiscount: 0 },
  },
  "당진터미널점": {
    "부킹닷컴":   { markup: 0.04, minDiscount: 0.10, maxDiscount: 0.20 },
    "씨트립":     { markup: 0,    minDiscount: 0.10, maxDiscount: 0.24 },
    "아고다":     { markup: 0.05, minDiscount: 0.10, maxDiscount: 0.20 },
    "익스피디아":  { markup: 0.05, minDiscount: 0.10, maxDiscount: 0.21 },
    "야놀자":     { markup: 0.20, minDiscount: 0,    maxDiscount: 0.25 },
    "여기어때":   { markup: 0.10, minDiscount: 0,    maxDiscount: 0.20 },
    "트립토파즈":  { markup: 0,    minDiscount: 0,    maxDiscount: 0 },
    "에어비앤비":  { markup: -0.10, minDiscount: 0,   maxDiscount: 0 },
  },
  "송도달빛공원점": {
    "부킹닷컴":   { markup: 0.17, minDiscount: 0.10, maxDiscount: 0.25 },
    "씨트립":     { markup: 0.10, minDiscount: 0.10, maxDiscount: 0.26 },
    "아고다":     { markup: 0.25, minDiscount: 0.15, maxDiscount: 0.21 },
    "익스피디아":  { markup: 0.16, minDiscount: 0.10, maxDiscount: 0.20 },
    "야놀자":     { markup: 0.20, minDiscount: 0,    maxDiscount: 0.20 },
    "여기어때":   { markup: 0.10, minDiscount: 0,    maxDiscount: 0.20 },
    "트립토파즈":  { markup: 0,    minDiscount: 0,    maxDiscount: 0 },
    "에어비앤비":  { markup: -0.10, minDiscount: 0,   maxDiscount: 0 },
  },
  "인천차이나타운": {
    "부킹닷컴":   { markup: 0.17, minDiscount: 0.10, maxDiscount: 0.25 },
    "씨트립":     { markup: 0.11, minDiscount: 0.10, maxDiscount: 0.30 },
    "아고다":     { markup: 0.23, minDiscount: 0.15, maxDiscount: 0.25 },
    "익스피디아":  { markup: 0.16, minDiscount: 0.10, maxDiscount: 0.20 },
    "야놀자":     { markup: 0.20, minDiscount: 0,    maxDiscount: 0.20 },
    "여기어때":   { markup: 0.10, minDiscount: 0,    maxDiscount: 0.20 },
    "트립토파즈":  { markup: 0,    minDiscount: 0,    maxDiscount: 0 },
    "에어비앤비":  { markup: -0.10, minDiscount: 0,   maxDiscount: 0 },
  },
  "제주공항점": {
    "부킹닷컴":   { markup: 0.13, minDiscount: 0.10, maxDiscount: 0.25 },
    "씨트립":     { markup: 0.06, minDiscount: 0.10, maxDiscount: 0.27 },
    "아고다":     { markup: 0.16, minDiscount: 0.10, maxDiscount: 0.20 },
    "익스피디아":  { markup: 0.13, minDiscount: 0.10, maxDiscount: 0.21 },
    "야놀자":     { markup: 0.20, minDiscount: 0,    maxDiscount: 0.20 },
    "여기어때":   { markup: 0.10, minDiscount: 0,    maxDiscount: 0.20 },
    "트립토파즈":  { markup: 0,    minDiscount: 0,    maxDiscount: 0 },
    "에어비앤비":  { markup: -0.10, minDiscount: 0,   maxDiscount: 0 },
  },

  // ── 강원 (속초) ──
  "속초해변 AB점": {
    "부킹닷컴":   { markup: 0.12, minDiscount: 0.10, maxDiscount: 0.25 },
    "씨트립":     { markup: 0.05, minDiscount: 0.10, maxDiscount: 0.26 },
    "아고다":     { markup: 0.18, minDiscount: 0.10, maxDiscount: 0.20 },
    "익스피디아":  { markup: 0.12, minDiscount: 0.10, maxDiscount: 0.21 },
    "야놀자":     { markup: 0.20, minDiscount: 0,    maxDiscount: 0.25 },
    "여기어때":   { markup: 0.10, minDiscount: 0,    maxDiscount: 0.20 },
    "트립토파즈":  { markup: 0,    minDiscount: 0,    maxDiscount: 0 },
    "에어비앤비":  { markup: -0.10, minDiscount: 0,   maxDiscount: 0 },
  },
  "속초해변C점": {
    "부킹닷컴":   { markup: 0.15, minDiscount: 0.10, maxDiscount: 0.25 },
    "씨트립":     { markup: 0.07, minDiscount: 0.10, maxDiscount: 0.27 },
    "아고다":     { markup: 0.18, minDiscount: 0.10, maxDiscount: 0.20 },
    "익스피디아":  { markup: 0.15, minDiscount: 0.10, maxDiscount: 0.21 },
    "야놀자":     { markup: 0.20, minDiscount: 0,    maxDiscount: 0.25 },
    "여기어때":   { markup: 0.10, minDiscount: 0,    maxDiscount: 0.20 },
    "트립토파즈":  { markup: 0,    minDiscount: 0,    maxDiscount: 0 },
    "에어비앤비":  { markup: -0.10, minDiscount: 0,   maxDiscount: 0 },
  },
  "속초등대해변점": {
    "부킹닷컴":   { markup: 0.18, minDiscount: 0.10, maxDiscount: 0.25 },
    "씨트립":     { markup: 0.12, minDiscount: 0.10, maxDiscount: 0.26 },
    "아고다":     { markup: 0.28, minDiscount: 0.10, maxDiscount: 0.25 },
    "익스피디아":  { markup: 0.18, minDiscount: 0.10, maxDiscount: 0.25 },
    "야놀자":     { markup: 0.20, minDiscount: 0,    maxDiscount: 0.25 },
    "여기어때":   { markup: 0.10, minDiscount: 0,    maxDiscount: 0.20 },
    "트립토파즈":  { markup: 0,    minDiscount: 0,    maxDiscount: 0 },
    "에어비앤비":  { markup: -0.10, minDiscount: 0,   maxDiscount: 0 },
  },
  "속초해변": {
    "부킹닷컴":   { markup: 0.18, minDiscount: 0.10, maxDiscount: 0.25 },
    "씨트립":     { markup: 0.10, minDiscount: 0.10, maxDiscount: 0.27 },
    "아고다":     { markup: 0.26, minDiscount: 0.10, maxDiscount: 0.25 },
    "익스피디아":  { markup: 0.18, minDiscount: 0.10, maxDiscount: 0.21 },
    "야놀자":     { markup: 0.20, minDiscount: 0,    maxDiscount: 0.25 },
    "여기어때":   { markup: 0.10, minDiscount: 0,    maxDiscount: 0.20 },
    "트립토파즈":  { markup: 0,    minDiscount: 0,    maxDiscount: 0 },
    "에어비앤비":  { markup: -0.10, minDiscount: 0,   maxDiscount: 0 },
  },
  "속초중앙점": {
    "부킹닷컴":   { markup: 0.11, minDiscount: 0.10, maxDiscount: 0.25 },
    "씨트립":     { markup: 0.05, minDiscount: 0.10, maxDiscount: 0.27 },
    "아고다":     { markup: 0.14, minDiscount: 0.10, maxDiscount: 0.20 },
    "익스피디아":  { markup: 0.11, minDiscount: 0.10, maxDiscount: 0.21 },
    "야놀자":     { markup: 0.20, minDiscount: 0,    maxDiscount: 0.25 },
    "여기어때":   { markup: 0.10, minDiscount: 0,    maxDiscount: 0.20 },
    "트립토파즈":  { markup: 0,    minDiscount: 0,    maxDiscount: 0 },
    "에어비앤비":  { markup: -0.10, minDiscount: 0,   maxDiscount: 0 },
  },
  "속초자이엘라더비치": {
    "부킹닷컴":   { markup: 0.20, minDiscount: 0.10, maxDiscount: 0.25 },
    "씨트립":     { markup: 0.13, minDiscount: 0.10, maxDiscount: 0.27 },
    "아고다":     { markup: 0.30, minDiscount: 0.10, maxDiscount: 0.25 },
    "익스피디아":  { markup: 0.20, minDiscount: 0.10, maxDiscount: 0.21 },
    "야놀자":     { markup: 0.20, minDiscount: 0,    maxDiscount: 0.25 },
    "여기어때":   { markup: 0.10, minDiscount: 0,    maxDiscount: 0.20 },
    "트립토파즈":  { markup: 0,    minDiscount: 0,    maxDiscount: 0 },
    "에어비앤비":  { markup: -0.10, minDiscount: 0,   maxDiscount: 0 },
  },
  "낙산해변": {
    "부킹닷컴":   { markup: 0.15, minDiscount: 0.10, maxDiscount: 0.25 },
    "씨트립":     { markup: 0.10, minDiscount: 0.10, maxDiscount: 0.27 },
    "아고다":     { markup: 0.28, minDiscount: 0.10, maxDiscount: 0.25 },
    "익스피디아":  { markup: 0.15, minDiscount: 0.10, maxDiscount: 0.20 },
    "야놀자":     { markup: 0.20, minDiscount: 0,    maxDiscount: 0.25 },
    "여기어때":   { markup: 0.10, minDiscount: 0,    maxDiscount: 0.20 },
    "트립토파즈":  { markup: 0,    minDiscount: 0,    maxDiscount: 0 },
    "에어비앤비":  { markup: -0.10, minDiscount: 0,   maxDiscount: 0 },
  },
};

/**
 * 셋팅가 → 대표 노출가 (채널 평균)
 * 모든 채널 중간값의 평균을 대표 노출가로 사용
 */
export function toDisplayPrice(branch: string, settingPrice: number): number {
  const channels = calcChannelPrices(branch, settingPrice);
  const midpoints = channels.map(ch => (ch.min + ch.max) / 2);
  return Math.round(midpoints.reduce((s, v) => s + v, 0) / midpoints.length);
}

/**
 * 노출가 → 셋팅가 역산
 */
export function toSettingPrice(branch: string, displayPrice: number): number {
  // 역산: displayPrice = settingPrice × avgFactor → settingPrice = displayPrice / avgFactor
  // avgFactor를 1원 기준으로 계산
  const factor = toDisplayPrice(branch, 10000) / 10000;
  return factor > 0 ? Math.round(displayPrice / factor) : displayPrice;
}

/**
 * 셋팅가 → 채널별 노출가 범위 계산
 */
export function calcChannelPrices(branch: string, settingPrice: number): {
  channel: string;
  min: number;
  max: number;
}[] {
  const config = BRANCH_CHANNELS[branch] || DEFAULT;
  return CHANNELS.map(ch => {
    const rate = config[ch] || DEFAULT[ch];
    if (!rate) return { channel: ch, min: settingPrice, max: settingPrice };
    const gross = Math.round(settingPrice * (1 + rate.markup));
    const max = Math.round(gross * (1 - rate.minDiscount));
    const min = Math.round(gross * (1 - rate.maxDiscount));
    return { channel: ch, min, max };
  });
}
