export const ROLL_BUCKETS = Array.from({ length: 20 }, (_, index) => ({
  min: index === 0 ? 0.01 : index * 5 + 0.01,
  max: (index + 1) * 5,
  range: `${(index === 0 ? 0.01 : index * 5 + 0.01).toFixed(2)}–${((index + 1) * 5).toFixed(2)}`,
}));
