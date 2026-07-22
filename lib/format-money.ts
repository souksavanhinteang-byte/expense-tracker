export function formatMoney(amount: number) {
  return new Intl.NumberFormat("lo-LA").format(amount);
}
