export default function ProductCard({
  item,
  badge,
  eyebrow,
  specs,
  fallback,
  className = '',
  imageClassName = '',
  onView,
  onQuote,
  onAddToCart
}) {
  const detailHref = item.slug
    ? `/products/${encodeURIComponent(item.slug)}/`
    : `?page=product-detail&id=${encodeURIComponent(item.id)}`;
  const imageAlt = [
    item.name,
    item.fitmentCategory || item.category || item.subcategory || 'construction equipment',
    'for sale from KONSTRUCTZ official image source cwqv.com'
  ].filter(Boolean).join(' ');

  const handleView = (event) => {
    event.preventDefault();
    onView(item);
  };

  const hasBuyOption = Boolean(
    item?.ecwidProductId ||
    item?.hash ||
    (item?.checkoutUrl && !item.checkoutUrl.includes('page=all-products')) ||
    (item?.price && item?.price !== 'Call for pricing' && item?.price !== 'Request Quote for Pricing' && item?.price !== 'Quote on request')
  );
  const isQuoteProduct = !hasBuyOption;

  const handlePrimaryClick = (event) => {
    event.preventDefault();
    if (isQuoteProduct && onQuote) {
      onQuote(item);
    } else {
      onView(item);
    }
  };

  const displayEyebrow = eyebrow || (item.fitmentCategory || item.type === 'Attachment' ? 'A T T A C H M E N T' : 'M A C H I N E R Y');

  return (
    <div className={`product-card ${className}`.trim()} itemScope itemType="https://schema.org/Product">
      <meta itemProp="name" content={item.name} />
      {item.image && <meta itemProp="image" content={item.image} />}
      <a
        href={detailHref}
        className={`card-image-area ${imageClassName}`.trim()}
        onClick={handleView}
        itemProp="url"
      >
        {badge && <span className="card-image-badge">{badge}</span>}
        {item.image ? (
          <img
            src={item.image}
            alt={imageAlt}
            title={imageAlt}
            className="card-image"
            loading="lazy"
            decoding="async"
            itemProp="image"
          />
        ) : (
          fallback
        )}
      </a>

      <div className="card-info">
        <div className="card-badge-type">{displayEyebrow}</div>
        <h3 className="card-name text-black">
          <a
            href={detailHref}
            onClick={handleView}
            style={{ color: 'inherit', textDecoration: 'none' }}
          >
            {item.name}
          </a>
        </h3>

        <div className="card-specs">
          {specs && specs.length > 0 ? (
            specs.map((spec) => (
              <div key={spec.label} className="spec-row">
                <span className="spec-label">{spec.label}:</span> <span className="spec-value">{spec.value}</span>
              </div>
            ))
          ) : (
            <>
              <div className="spec-row">
                <span className="spec-label">Op. Weight:</span> <span className="spec-value">{item.weight || 'See details'}</span>
              </div>
              <div className="spec-row">
                <span className="spec-label">Engine:</span> <span className="spec-value">{item.engine || 'See details'}</span>
              </div>
              <div className="spec-row">
                <span className="spec-label">Price:</span> <span className="spec-value">{item.price || (isQuoteProduct ? 'Request Quote for Pricing' : 'See details')}</span>
              </div>
            </>
          )}
        </div>

        <div className="card-footer">
          <button
            type="button"
            className="card-btn-viewdetails"
            onClick={handleView}
          >
            {hasBuyOption ? 'View & Buy' : 'Request a Quote'}
          </button>
          <button
            type="button"
            className="card-btn-cart"
            onClick={() => onAddToCart(item)}
            aria-label="Add to cart"
            title="Add to Cart"
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="9" cy="21" r="1"/>
              <circle cx="20" cy="21" r="1"/>
              <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
