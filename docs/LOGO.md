# CLIProxyAPI Lite — Logo Design Specification

## Concept

The logo embodies three ideas simultaneously:

1. **Shrimp / 虾** — Our mascot, representing "Lite" (small, lightweight, agile), inspired by our parent AI's name 皮皮虾
2. **Lightning Bolt** — Speed, edge computing, instant response at Cloudflare's global network edge
3. **Cloud** — The Cloudflare platform, edge infrastructure, cloud-native architecture

Together: a tiny but lightning-fast shrimp riding a cloud — the essence of a lightweight, globally fast AI gateway.

---

## Color Palette

| Name | Hex | Usage |
|------|-----|-------|
| **Coral** (Primary) | `#FF6B35` | Shrimp body, CLI brand color |
| **Coral Dark** | `#E85A24` | Shrimp tail, shadows |
| **Teal** (Secondary) | `#4ECDC4` | Cloud shape, "Lite" text, edge symbol |
| **Teal Dark** | `#3DBDB5` | Teal shadows |
| **Yellow** (Accent) | `#FFE66D` | Lightning bolt |
| **Yellow Dark** | `#F5C518` | Lightning bolt shadow/stroke |
| **Navy** (Dark Text) | `#2C2C54` | Eye, stable tech feel |
| **Light Gray** | `#F7F7F7` | Background |

---

## Logo Files

| File | Dimensions | Use Case |
|------|-----------|----------|
| `pages/public/logo.svg` | 280×80 | Full logo with wordmark, primary |
| `pages/public/logo-icon.svg` | 32×32 | Favicon, app icon, compact display |

---

## Design Rules

### Do ✅
- Keep the shrimp shape recognizable even at small sizes (≥16px)
- Use the coral/teal/yellow tricolor as brand recognition
- Lightning bolt should overlap shrimp or cloud naturally

### Don't ❌
- Don't modify color hex codes
- Don't stretch or distort the aspect ratio
- Don't remove the lightning bolt or cloud elements
- Don't add extra text to the icon version

---

## Typography

- **"CLI"** — `Courier New`, Bold, Coral `#FF6B35`
- **"ProxyAPI"** — `Courier New`, Bold, Navy `#2C2C54`
- **"Lite"** — `Arial`, Semibold, Teal `#4ECDC4`
- **Tagline** — `Arial`, Italic, Gray `#999999`

---

## Logo Variants

### Full Logo (logo.svg)
- Full wordmark + mascot + cloud + lightning
- Used in: README, website header, docs, login page

### Icon Only (logo-icon.svg)
- Mascot + lightning + subtle cloud base
- Used in: Browser favicon, mobile app icon, small UI contexts
- Background: transparent

---

## SVG Best Practices Applied

- All gradients defined in `<defs>` for reuse
- `viewBox` based sizing (scale-independent)
- `role="img"` + `<title>` + `<desc>` for accessibility
- Minimal paths, no embedded rasters
- Optimized for file size (no unnecessary precision)
