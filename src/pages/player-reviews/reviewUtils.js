export const REVIEW_TIERS = [
  { min: 9, max: 10, name: 'Excellent', color: 'green' },
  { min: 8, max: 8.9, name: 'Great', color: 'green' },
  { min: 7, max: 7.9, name: 'Good', color: 'yellow' },
  { min: 6, max: 6.9, name: 'Average', color: 'red' },
  { min: 5, max: 5.9, name: 'Poor', color: 'red' }
];

export const getTier = (score) => {
  const value = Number(score);
  return REVIEW_TIERS.find((tier) => value >= tier.min && value <= tier.max) || REVIEW_TIERS.at(-1);
};
