export function formatMoney(amountInAgorot: number) {
  if (!Number.isSafeInteger(amountInAgorot) || amountInAgorot < 0) {
    throw new RangeError('Money must be nonnegative integer agorot');
  }
  const wholeShekels = Math.floor(amountInAgorot / 100);
  const remainingAgorot = amountInAgorot % 100;
  const fractional = String(remainingAgorot).padStart(2, '0');
  return `₪${wholeShekels}${remainingAgorot ? `.${fractional}` : ''}`;
}
