import {useCopy} from '../lib/localization';
import type {Product} from '../lib/types';

/** The Gateway supplies both amounts and the discount for the selected variant. */
type PriceDetails=Pick<Product,'price'>&Partial<Pick<Product,'original_price'|'purchase_variant'|'discount_percent'|'upgrade'>>;
export function OfferPrice({product,price=product.upgrade?.price??product.price}:{product:PriceDetails;price?:Product['price']}){
  const t=useCopy('commerce');
  const original=product.original_price;
  const discounted=product.purchase_variant==='scene_unlock_upgrade'&&original&&(product.discount_percent??0)>0;
  return <>{discounted&&<><del aria-label={t('Исходная цена','Original price')}>{original.amount} {original.currency}</del>{' '}</>}
    {price?`${price.amount} ${price.currency}`:'—'}
    {discounted&&<> · {t('Скидка','Discount')} {product.discount_percent}%</>}
  </>;
}
