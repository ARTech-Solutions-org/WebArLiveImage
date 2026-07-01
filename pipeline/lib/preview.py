from __future__ import annotations

import webbrowser
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


def _load_font(size: int) -> ImageFont.ImageFont:
    for name in ("arial.ttf", "Arial.ttf", "segoeui.ttf"):
        try:
            return ImageFont.truetype(name, size=size)
        except OSError:
            continue
    return ImageFont.load_default()


def render_preview_sheet(
    *,
    source_image: Path,
    ar_url: str,
    output_image: Path,
    title: str = "Scan with your phone",
    subtitle: str = "Point your camera at this photo, then open the link or scan the QR.",
) -> Path:
    import qrcode

    photo = Image.open(source_image).convert("RGB")
    photo.thumbnail((900, 1200), Image.Resampling.LANCZOS)

    qr = qrcode.QRCode(border=2, box_size=8)
    qr.add_data(ar_url)
    qr.make(fit=True)
    qr_image = qr.make_image(fill_color="black", back_color="white").convert("RGB")
    qr_image = qr_image.resize((320, 320), Image.Resampling.NEAREST)

    margin = 48
    header_h = 120
    footer_h = 420
    canvas = Image.new(
        "RGB",
        (max(photo.width, qr_image.width) + margin * 2, photo.height + header_h + footer_h + margin * 2),
        (248, 246, 242),
    )
    draw = ImageDraw.Draw(canvas)
    title_font = _load_font(34)
    body_font = _load_font(22)
    small_font = _load_font(18)

    draw.text((margin, margin), title, fill=(20, 20, 20), font=title_font)
    draw.text((margin, margin + 48), subtitle, fill=(70, 70, 70), font=body_font)

    photo_x = (canvas.width - photo.width) // 2
    photo_y = margin + header_h
    canvas.paste(photo, (photo_x, photo_y))

    qr_x = (canvas.width - qr_image.width) // 2
    qr_y = photo_y + photo.height + 36
    canvas.paste(qr_image, (qr_x, qr_y))

    draw.text((margin, qr_y + qr_image.height + 24), ar_url, fill=(20, 20, 20), font=small_font)

    output_image.parent.mkdir(parents=True, exist_ok=True)
    canvas.save(output_image, format="JPEG", quality=92)
    return output_image


def write_preview_html(
    *,
    output_html: Path,
    preview_image: Path,
    ar_url: str,
    target_id: str,
) -> Path:
    image_name = preview_image.name
    html = f"""<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Kiosk preview — {target_id}</title>
    <style>
      body {{
        margin: 0;
        font-family: system-ui, sans-serif;
        background: #111;
        color: #f5f5f5;
      }}
      main {{
        max-width: 960px;
        margin: 0 auto;
        padding: 24px;
      }}
      img {{
        width: 100%;
        height: auto;
        border-radius: 12px;
        background: #fff;
      }}
      .actions {{
        display: flex;
        gap: 12px;
        flex-wrap: wrap;
        margin: 20px 0;
      }}
      a.button {{
        display: inline-block;
        padding: 12px 18px;
        border-radius: 999px;
        background: #fff;
        color: #111;
        text-decoration: none;
        font-weight: 600;
      }}
      code {{
        word-break: break-all;
      }}
    </style>
  </head>
  <body>
    <main>
      <h1>Kiosk preview ready</h1>
      <p>Target: <code>{target_id}</code></p>
      <div class="actions">
        <a class="button" href="{ar_url}" target="_blank" rel="noopener">Open AR experience</a>
      </div>
      <p>AR URL:<br /><code>{ar_url}</code></p>
      <img src="{image_name}" alt="Kiosk preview sheet" />
      <p>Show this screen to the guest, or use the preview image as your booth display.</p>
    </main>
  </body>
</html>
"""
    output_html.write_text(html, encoding="utf-8")
    return output_html


def open_preview_in_browser(html_path: Path) -> None:
    webbrowser.open(html_path.resolve().as_uri())
