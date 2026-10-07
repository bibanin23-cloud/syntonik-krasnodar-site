export function calculate(consumption, mileage, price, reduction) {
  if (![consumption, mileage, price, reduction].every(Number.isFinite) || consumption <= 0 || mileage < 0 || price <= 0 || ![0.1, 0.2, 0.3].includes(reduction)) throw new RangeError('Проверьте исходные данные');
  const fuelBefore = consumption * mileage / 100;
  const fuelAfter = fuelBefore * (1 - reduction);
  const monthlySavings = (fuelBefore - fuelAfter) * price;
  const syntonikMlMonth = fuelAfter / 10;
  const syntonikCostMonth = syntonikMlMonth * 22;
  const netMonthlySavings = monthlySavings - syntonikCostMonth;
  const result = {fuelBefore, fuelAfter, consumptionAfter: consumption * (1 - reduction), monthlySavings, yearlySavings: monthlySavings * 12, syntonikMlMonth, syntonikMlYear: syntonikMlMonth * 12, syntonikCostMonth, netMonthlySavings, netYearlySavings: netMonthlySavings * 12};
  if (!Object.values(result).every(Number.isFinite)) throw new RangeError('Слишком большие значения');
  return result;
}
