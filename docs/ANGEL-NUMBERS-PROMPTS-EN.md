# Angel Numbers English - Image Generation Prompts

## 🎨 Master Prompt Template

```
Hyper-realistic 3D golden number {{NUM}} floating in a cosmic nebula, 
sacred geometry halo, golden light particles forming angel wings, 
deep violet to electric-blue gradient, divine rays, cinematic lens flare 
--ar 4:5 --stylize 1000 --v 6
```

## 📸 Chapter-Specific Prompts

### Chapter 01 - Introduction
```
Ethereal cosmic clock with multiple number sequences glowing in golden light,
spiral galaxy background, sacred geometry overlays, divine rays penetrating
from above, mystical fog, hyper-realistic, octane render, 8k quality
--ar 4:5 --stylize 1000 --v 6
```

### Triple Numbers (111-999)
```
Hyper-realistic 3D golden number {{NUM}} floating in cosmic void,
surrounded by sacred geometry mandala, thousands of golden light
particles forming angel wings, deep purple to electric blue gradient nebula,
divine light rays penetrating from above, mystical fog, hyperrealistic,
octane render, 8k quality, transcendent atmosphere, slight lens flare
--ar 4:5 --style raw --stylize 1000 --v 6
```

### Master Numbers (11, 22, 33, etc.)
```
Crystalline 3D number {{NUM}} made of pure light energy, floating above
ancient pyramid with Tesla coil electricity, sacred geometry blueprints
in background, golden ratio spirals, cosmic purple nebula, divine white
light beam from cosmos, photorealistic, unreal engine, 8k
--ar 4:5 --stylize 1000 --v 6
```

### Four-Digit Numbers (1010-4040)
```
Holographic 3D number {{NUM}} composed of stardust particles, binary
code matrix background transforming into sacred geometry, golden phoenix
wings spreading behind, violet-blue plasma energy field, divine portal
opening above, cinematic lighting, volumetric fog, 8k octane render
--ar 4:5 --stylize 1000 --v 6
```

### Special Chapters
- **Power Combinations**: Multiple numbers orbiting central divine light source
- **Angel Diary**: Ancient tome with glowing numbers floating off pages
- **Community**: Circle of light beings connected by golden threads
- **FAQ**: Cosmic question marks transforming into angel numbers
- **Resources**: Treasure chest overflowing with glowing number crystals

## 🔥 Conversion-Optimized Elements

Always include:
1. **Golden/white divine light** - triggers hope/divinity
2. **Purple/blue gradients** - mystical authority
3. **Sacred geometry** - ancient wisdom
4. **Light particles/wings** - angelic presence
5. **Cinematic quality** - premium value perception

## 💡 Quick Generation Commands

```bash
# Single image
make generate-images CHAP=02 PROMPT="Hyper-realistic 3D golden number 111..."

# Batch triple numbers
for i in {02..10}; do
  num=$(sed -n "${i}p" chapters/chapter-*.md | grep -o '[0-9]\+' | head -1)
  make generate-images CHAP=$i NUMBER=$num
done

# All images with default prompts
make generate-images-all
```

## 🎯 A/B Testing Variants

### Variant A - Pure Light
- Emphasis on white/golden divine light
- Minimal background, focus on number
- Clean, minimalist sacred geometry

### Variant B - Cosmic Drama
- Rich nebula backgrounds
- Multiple light sources
- Complex sacred geometry patterns

### Variant C - Ancient Mystery
- Stone tablets/pyramids
- Hieroglyphic elements
- Earth tones mixed with divine light

Track which variants get more engagement!