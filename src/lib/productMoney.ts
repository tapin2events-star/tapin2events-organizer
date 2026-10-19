// Product prices and fees. Must match create-product-checkout exactly.
// Buyer pays: items + shipping + service fee (3.7% + $1.79 per order) + processing fee (2.9%).
// The seller receives the full item price + shipping.
export const money = (n: number) => `$${(Number(n) || 0).toFixed(2)}`;

export function productFees(itemsTotal: number, shipping: number) {
  const subtotalCents = Math.round(itemsTotal * 100) + Math.round(shipping * 100);
  const serviceCents = Math.round(subtotalCents * 0.037) + 179;
  const processingCents = Math.round(subtotalCents * 0.029);
  return {
    subtotal: subtotalCents / 100,
    service: serviceCents / 100,
    processing: processingCents / 100,
    total: (subtotalCents + serviceCents + processingCents) / 100,
  };
}

// Price label for a product card: "From $20.00" when options cost different amounts.
export function priceLabel(base: number, adjustments: number[] = []) {
  if (!adjustments.length) return money(base);
  const prices = adjustments.map((a) => base + (Number(a) || 0));
  const min = Math.min(...prices), max = Math.max(...prices);
  return min === max ? money(min) : `From ${money(min)}`;
}
