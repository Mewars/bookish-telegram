// Pricing calculation only: no wallet, payment API or settlement authority.
// The server must lock an accepted quote; rates are not trusted from a browser.
export function quoteTaskCommission(amountKopecks:number,feeBasisPoints:number,providerFeeKopecks:number|null=null){
  if(!Number.isSafeInteger(amountKopecks)||amountKopecks<=0)throw Error('Сумма должна быть положительным целым числом копеек.');
  if(!Number.isSafeInteger(feeBasisPoints)||feeBasisPoints<0||feeBasisPoints>10000)throw Error('Комиссия должна быть от 0 до 10000 базисных пунктов.');
  if(providerFeeKopecks!==null&&(!Number.isSafeInteger(providerFeeKopecks)||providerFeeKopecks<0))throw Error('Расходы провайдера должны быть целым числом копеек.');
  const platformGrossKopecks=Number((BigInt(amountKopecks)*BigInt(feeBasisPoints)+5000n)/10000n);
  return {amountKopecks,feeBasisPoints,platformGrossKopecks,
    executorKopecks:amountKopecks-platformGrossKopecks,providerFeeKopecks,
    platformNetBeforeTaxKopecks:providerFeeKopecks===null?null:platformGrossKopecks-providerFeeKopecks};
}
