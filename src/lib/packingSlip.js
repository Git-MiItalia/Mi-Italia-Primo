import { apiFetch } from './api'

const API = import.meta.env.VITE_API_URL

/**
 * Generate and open a packing slip for a given order.
 * Fetches order detail + boutique profile, builds a print-ready HTML page.
 * User can print to paper or save as PDF via the browser print dialog.
 */
export async function generatePackingSlip(orderId) {
  if (!orderId) return

  const [orderRes, profileRes] = await Promise.all([
    apiFetch(`${API}/boutique/orders/${orderId}`).then(r => r.json()),
    apiFetch(`${API}/boutique/profile`).then(r => r.json()),
  ])

  if (!orderRes.success) throw new Error(orderRes.message || 'Failed to load order')

  const order = orderRes.data
  const profile = profileRes.success ? profileRes.data : {}

  const addr = order.shipping_address_snapshot || {}
  const items = order.items || []
  const orderDate = new Date(order.created_at).toLocaleDateString('en-GB', { day:'numeric', month:'long', year:'numeric' })
  const orderNum = order.id.split('-')[0].toUpperCase()
  const channelLabel = order.channel === 'ship' ? 'Shipping' : order.channel === 'pickup' ? 'Pickup' : order.channel === 'pos' ? 'POS' : order.channel
  const statusLabel = (order.status || '').charAt(0).toUpperCase() + (order.status || '').slice(1)
  const countryMap = { IT:'Italy', FR:'France', DE:'Germany', ES:'Spain', GB:'United Kingdom', US:'United States', PT:'Portugal', CH:'Switzerland', AT:'Austria', NL:'Netherlands' }
  const countryName = countryMap[addr.country_code] || addr.country_code || ''

  const itemsHtml = items.map((item, i) => `
    <tr>
      <td style="padding:10px 12px;border-bottom:1px solid #E8E4DC;font-size:12px;color:#5A4E42;text-align:center">${i + 1}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #E8E4DC">
        <div style="display:flex;align-items:center;gap:10px">
          ${item.product_photo
            ? `<img src="${item.product_photo}" style="width:40px;height:40px;object-fit:cover;border:1px solid #E8E4DC" />`
            : `<div style="width:40px;height:40px;background:#F5F0EB;display:flex;align-items:center;justify-content:center;font-size:18px;color:#8C7B6B">📦</div>`
          }
          <div>
            <div style="font-size:12px;font-weight:600;color:#1A1209">${item.product_name_snapshot}</div>
            ${item.sku_snapshot ? `<div style="font-size:10px;color:#8C7B6B;margin-top:2px">SKU: ${item.sku_snapshot}</div>` : ''}
          </div>
        </div>
      </td>
      <td style="padding:10px 12px;border-bottom:1px solid #E8E4DC;font-size:11px;color:#5A4E42;text-align:center">${item.variant_size_snapshot || '—'}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #E8E4DC;font-size:11px;color:#5A4E42;text-align:center">${item.variant_colour_snapshot || '—'}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #E8E4DC;font-size:11px;color:#5A4E42;text-align:center">${item.qty}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #E8E4DC;font-size:12px;font-weight:600;color:#1A1209;text-align:right">€${parseFloat(item.unit_price).toFixed(2)}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #E8E4DC;font-size:12px;font-weight:600;color:#1A1209;text-align:right">€${parseFloat(item.line_total).toFixed(2)}</td>
    </tr>
  `).join('')

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Packing Slip — ${orderNum}</title>
  <style>
    * { box-sizing:border-box; margin:0; padding:0; }
    body { font-family:'Jost',system-ui,sans-serif; color:#1A1209; background:white; }
    @page { size:A4; margin:18mm 16mm; }
    @media print {
      body { -webkit-print-color-adjust:exact; print-color-adjust:exact; }
      .no-print { display:none !important; }
    }
    .page { max-width:780px; margin:0 auto; padding:40px 32px; }
  </style>
</head>
<body>
  <!-- Print bar -->
  <div class="no-print" style="background:#1A1209;padding:12px 24px;display:flex;align-items:center;justify-content:space-between;position:sticky;top:0;z-index:10">
    <div style="font-family:'Bodoni Moda',Georgia,serif;font-size:16px;color:#B8955A;letter-spacing:2px">PACKING SLIP</div>
    <div style="display:flex;gap:10px">
      <button onclick="window.print()" style="background:#B8955A;color:#1A1209;border:none;padding:8px 20px;font-family:'Jost',sans-serif;font-size:12px;font-weight:600;cursor:pointer;letter-spacing:1px">PRINT</button>
      <button onclick="window.close()" style="background:transparent;color:#8C7B6B;border:1px solid #5A4E42;padding:8px 20px;font-family:'Jost',sans-serif;font-size:12px;font-weight:600;cursor:pointer;letter-spacing:1px">CLOSE</button>
    </div>
  </div>

  <div class="page">
    <!-- Header -->
    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:28px;padding-bottom:18px;border-bottom:2px solid #1A1209">
      <div>
        <div style="font-family:'Bodoni Moda',Georgia,serif;font-size:28px;font-weight:400;letter-spacing:4px;text-transform:uppercase;color:#1A1209">${profile.name || 'Boutique'}</div>
        ${profile.city ? `<div style="font-size:11px;color:#8C7B6B;margin-top:4px;letter-spacing:1px">${profile.address_line1 || ''}${profile.city ? ' · ' + profile.city : ''}${profile.postcode ? ' ' + profile.postcode : ''}</div>` : ''}
        ${profile.phone ? `<div style="font-size:10px;color:#8C7B6B;margin-top:2px">${profile.phone}${profile.email ? ' · ' + profile.email : ''}</div>` : ''}
        ${profile.vat_number ? `<div style="font-size:10px;color:#8C7B6B;margin-top:2px">VAT: ${profile.vat_number}</div>` : ''}
      </div>
      <div style="text-align:right">
        <div style="font-size:10px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#8C7B6B;margin-bottom:4px">Packing Slip</div>
        <div style="font-family:'Bodoni Moda',Georgia,serif;font-size:22px;color:#1A1209">#${orderNum}</div>
        <div style="font-size:10px;color:#8C7B6B;margin-top:4px">${orderDate}</div>
        <div style="display:inline-block;margin-top:6px;padding:3px 10px;font-size:9px;font-weight:700;letter-spacing:1px;text-transform:uppercase;background:${order.status === 'delivered' ? 'rgba(0,108,53,0.1)' : order.status === 'shipped' ? 'rgba(99,91,255,0.08)' : 'rgba(184,149,90,0.1)'};color:${order.status === 'delivered' ? '#006C35' : order.status === 'shipped' ? '#635BFF' : '#8A6A30'}">${statusLabel} · ${channelLabel}</div>
      </div>
    </div>

    <!-- Ship To / Bill To -->
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:24px;margin-bottom:28px">
      <div>
        <div style="font-size:9px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#8C7B6B;margin-bottom:8px">Ship To</div>
        <div style="font-size:13px;font-weight:600;color:#1A1209;margin-bottom:3px">${addr.name || order.name || '—'}</div>
        <div style="font-size:11px;color:#5A4E42;line-height:1.7">
          ${addr.address_line1 || ''}${addr.address_line2 ? '<br>' + addr.address_line2 : ''}<br>
          ${addr.postal_code || ''} ${addr.city || ''}<br>
          ${countryName}
        </div>
        ${addr.phone ? `<div style="font-size:10px;color:#8C7B6B;margin-top:4px">${addr.phone}</div>` : ''}
        ${addr.email ? `<div style="font-size:10px;color:#8C7B6B">${addr.email}</div>` : ''}
      </div>
      <div>
        <div style="font-size:9px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#8C7B6B;margin-bottom:8px">Order Details</div>
        <div style="font-size:11px;color:#5A4E42;line-height:1.9">
          <strong style="color:#1A1209">Order:</strong> ${order.id}<br>
          <strong style="color:#1A1209">Date:</strong> ${orderDate}<br>
          <strong style="color:#1A1209">Channel:</strong> ${channelLabel}<br>
          <strong style="color:#1A1209">Payment:</strong> ${order.payment_method === 'stripe' ? 'Card (Stripe)' : order.payment_method === 'cash' ? 'Cash' : order.payment_method}<br>
          ${order.dhl_tracking_number ? `<strong style="color:#1A1209">Tracking:</strong> ${order.dhl_tracking_number}<br>` : ''}
          ${order.shipping_method ? `<strong style="color:#1A1209">Service:</strong> ${order.shipping_method === 'I' ? 'DHL International' : order.shipping_method === 'D' ? 'DHL Domestic' : order.shipping_method}` : ''}
        </div>
      </div>
    </div>

    <!-- Items table -->
    <table style="width:100%;border-collapse:collapse;margin-bottom:24px">
      <thead>
        <tr style="background:#F5F0EB">
          <th style="padding:8px 12px;font-size:9px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:#8C7B6B;text-align:center;width:40px">#</th>
          <th style="padding:8px 12px;font-size:9px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:#8C7B6B;text-align:left">Product</th>
          <th style="padding:8px 12px;font-size:9px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:#8C7B6B;text-align:center;width:60px">Size</th>
          <th style="padding:8px 12px;font-size:9px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:#8C7B6B;text-align:center;width:70px">Colour</th>
          <th style="padding:8px 12px;font-size:9px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:#8C7B6B;text-align:center;width:40px">Qty</th>
          <th style="padding:8px 12px;font-size:9px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:#8C7B6B;text-align:right;width:80px">Price</th>
          <th style="padding:8px 12px;font-size:9px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:#8C7B6B;text-align:right;width:80px">Total</th>
        </tr>
      </thead>
      <tbody>
        ${itemsHtml}
      </tbody>
    </table>

    <!-- Totals -->
    <div style="display:flex;justify-content:flex-end;margin-bottom:28px">
      <div style="width:280px">
        <div style="display:flex;justify-content:space-between;padding:6px 0;font-size:11px;color:#5A4E42">
          <span>Subtotal</span><span style="font-weight:600;color:#1A1209">€${parseFloat(order.subtotal).toFixed(2)}</span>
        </div>
        <div style="display:flex;justify-content:space-between;padding:6px 0;font-size:11px;color:#5A4E42">
          <span>VAT (${(parseFloat(order.vat_rate) * 100).toFixed(0)}%)</span><span style="font-weight:600;color:#1A1209">€${parseFloat(order.vat_amount).toFixed(2)}</span>
        </div>
        ${parseFloat(order.shipping_price) > 0 ? `
        <div style="display:flex;justify-content:space-between;padding:6px 0;font-size:11px;color:#5A4E42">
          <span>Shipping</span><span style="font-weight:600;color:#1A1209">€${parseFloat(order.shipping_price).toFixed(2)}</span>
        </div>` : ''}
        ${parseFloat(order.promo_discount) > 0 ? `
        <div style="display:flex;justify-content:space-between;padding:6px 0;font-size:11px;color:#006C35">
          <span>Discount${order.promo_code ? ' (' + order.promo_code + ')' : ''}</span><span style="font-weight:600">−€${parseFloat(order.promo_discount).toFixed(2)}</span>
        </div>` : ''}
        <div style="display:flex;justify-content:space-between;padding:10px 0 0;margin-top:6px;border-top:2px solid #1A1209;font-size:14px;font-weight:700;color:#1A1209">
          <span>Total</span><span style="font-family:'Bodoni Moda',Georgia,serif;font-size:18px;font-weight:400">€${parseFloat(order.gross_amount).toFixed(2)}</span>
        </div>
      </div>
    </div>

    <!-- Packing checklist -->
    <div style="border:1.5px dashed #D4CCBE;padding:16px 18px;margin-bottom:24px">
      <div style="font-size:9px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#8C7B6B;margin-bottom:10px">Packing Checklist</div>
      ${items.map(item => `
        <div style="display:flex;align-items:center;gap:8px;padding:5px 0;font-size:11px;color:#5A4E42">
          <div style="width:14px;height:14px;border:1.5px solid #8C7B6B;flex-shrink:0"></div>
          <span>${item.product_name_snapshot}${item.variant_size_snapshot ? ' — ' + item.variant_size_snapshot : ''}${item.variant_colour_snapshot ? ' / ' + item.variant_colour_snapshot : ''} × ${item.qty}</span>
        </div>
      `).join('')}
      <div style="display:flex;align-items:center;gap:8px;padding:5px 0;font-size:11px;color:#8C7B6B;margin-top:4px">
        <div style="width:14px;height:14px;border:1.5px solid #D4CCBE;flex-shrink:0"></div>
        <span>Tissue paper / branded wrap</span>
      </div>
      <div style="display:flex;align-items:center;gap:8px;padding:5px 0;font-size:11px;color:#8C7B6B">
        <div style="width:14px;height:14px;border:1.5px solid #D4CCBE;flex-shrink:0"></div>
        <span>Thank-you card</span>
      </div>
      <div style="display:flex;align-items:center;gap:8px;padding:5px 0;font-size:11px;color:#8C7B6B">
        <div style="width:14px;height:14px;border:1.5px solid #D4CCBE;flex-shrink:0"></div>
        <span>Return label / instructions</span>
      </div>
    </div>

    <!-- Footer -->
    <div style="text-align:center;padding-top:18px;border-top:1px solid #E8E4DC">
      <div style="font-family:'Bodoni Moda',Georgia,serif;font-size:14px;letter-spacing:3px;text-transform:uppercase;color:#8C7B6B">${profile.name || ''}</div>
      <div style="font-size:9px;color:#B5A99A;margin-top:4px">${profile.website_url || ''}</div>
      <div style="font-size:8px;color:#B5A99A;margin-top:8px">This packing slip was generated by Mi Italia · Primo Portal</div>
    </div>
  </div>
</body>
</html>`

  const pw = window.open('', '_blank', 'width=900,height=700')
  pw.document.write(html)
  pw.document.close()
}