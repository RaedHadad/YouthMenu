# Customer receipts and printing

After successful order creation, the Arabic RTL ticket replaces the menu. It shows
server-provided snapshot details, total in agorot formatted as shekels, order number,
status, preparation estimate, visible pickup code and cash-at-pickup wording.
Refreshing restores the same receipt through the protected status endpoint.

The 180px black-on-white `QRCodeCanvas` encodes only the secure pickup token.
It uses medium error correction and a four-module quiet zone, with no external QR
service or credential-bearing image URL. The visible code and customer access
token are not QR payloads. Pickup validation/redemption remains Phase 11.

“طباعة البون” invokes the browser's print dialog. Print CSS removes unrelated
content from layout, retains the receipt header, hides controls and uses a
black-and-white ticket up to 80mm wide. Details wrap, and the QR/pickup block stays
together across page breaks. Long receipts may span pages without clipping.

Use the printer's paper size in its dialog. Browser-added headers and footers
(URL/date/page number) are controlled by the browser: disable them there for a
clean ticket. A physical 80mm printer may need smaller margins or scaling to fit
its printable area. PDF checks do not replace testing the intended printer and
phone camera before deployment.

Browser coverage decodes the actual canvas pixels, checks the same credential
after refresh and under print styles, verifies historical prices after menu edits,
and exercises 320/768/1440px widths with an 80-character Arabic name. Screenshots
and A4 PDFs are written to ignored `test-results/` using disposable test orders.
Treat screenshots/PDFs of real orders as private because they contain pickup QR
credentials.
