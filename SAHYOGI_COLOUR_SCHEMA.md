🎨 SahYogi InfraCare — Colour Palette & UI/UX Design System
Website: SahYogi InfraCare — Staffing · Hospitality · Operations Source: 
index.css
 · 
App.tsx

🟢 Core Brand Colours
The design system uses 6 semantic colour tokens defined as Tailwind CSS custom theme variables.

Token	Hex Code	Swatch	Role	Usage
Sand	#F9F9F9	🟫	Background (Primary)	Page background, form inputs, mobile menu
Sage	#666666	⬜	Text (Secondary)	Body copy, descriptions, labels, nav links
Moss	#0B5B31	🟩	Brand Green (Primary)	Headings, process steps, CTA outlines, nav bar, footer
Clay	#D32F2F	🟥	Brand Red (Accent)	CTA buttons, highlights, subtitles, hover states
Slate	#3C3C3B	⬛	Text (Primary)	Main headings (h1, h2), body text colour
Cream	#FFFFFF	⬜	White / Surface	Cards, hero section background, stat cards
CSS Variable Definitions
css

@theme {
  --color-sand:  #f9f9f9;
  --color-sage:  #666666;
  --color-moss:  #0b5b31;
  --color-clay:  #ed1c24;
  --color-slate: #3c3c3b;
  --color-cream: #ffffff;
}
🎯 Colour Roles & Application Map
Primary Backgrounds
Context	Colour	Token / Class
Page body	#F9F9F9	bg-sand
Hero section	#FFFFFF	bg-white
Cards & forms	#FFFFFF	bg-white / bg-cream
Header (sticky)	rgba(255,255,255,0.9)	bg-white/90 + backdrop-blur-md
Footer	#0B5B31	bg-moss
Industries bar	#0B5B31	bg-moss
"Why Clients Stay" section	#0B5B31	bg-moss
Process section	#FFFFFF	bg-white
About section	rgba(255,255,255,0.5)	bg-cream/50
Form inputs	#F9F9F9	bg-sand
Accent / Feature Blocks
Context	Colour	Token / Class
Stat card (green)	#0B5B31	bg-moss
Stat card (red)	#D32F2F	bg-clay
Award badge circle	#D32F2F	bg-clay
Process step circles	#0B5B31	bg-moss
Hospitality advantage box	#0B5B31	bg-moss
"Ready to Scale" card	#0B5B31	bg-moss
✍️ Typography Colours
Element	Colour	Hex	Class
Main headings (h1, h2)	Dark charcoal	#3C3C3B	text-slate
Heading accents / emphasis	Brand red	#D32F2F	text-clay
Sub-headings (h3, h4)	Deep green	#0B5B31	text-moss
Body text	Medium grey	#666666	text-sage
Text on dark (moss) backgrounds	Near-white	#F9F9F9	text-sand
Text on red/green cards	Near-white	#F9F9F9	text-sand
Nav brand name	Deep green	#0B5B31	text-moss
Nav tagline	Brand red	#D32F2F	text-clay
Footer section headings	Brand red	#D32F2F	text-clay
🔘 Button & CTA Colours
Button Type	Background	Text	Border	Hover / Shadow
Primary CTA ("Enquire Now", "Submit")	#D32F2F	#FFFFFF	—	bg-clay/90, shadow-clay/20
Secondary CTA ("Our Credentials")	Transparent	#0B5B31	#0B5B31 at 20%	bg-moss/5
CTA on dark bg ("Connect with us")	#D32F2F	#FFFFFF	—	rounded-full, shadow-clay/20
Disabled state	#D32F2F at 70%	#FFFFFF	—	opacity-70, cursor-not-allowed
🖼️ Decorative & Subtle Colours
Element	Colour / Opacity	Purpose
Hero diagonal SVG lines	#666666 at 5% opacity	Subtle background texture
Hero green glow	#0B5B31 at 5% opacity, blur-150px	Ambient radial gradient
Hero red glow	#D32F2F at 5% opacity, blur-150px	Ambient radial gradient
About section red glow	#D32F2F at 20% opacity, blur-100px	Decorative orb behind CTA card
Card borders	#0B5B31 at 5%	Very subtle separation
Header border	#0B5B31 at 10%	Thin bottom separator
Footer divider	#F9F9F9 at 10%	Section separator
Selection highlight	#D32F2F at 20%	selection:bg-clay/20
Text shadow (hero)	rgba(0,0,0,0.1)	Subtle depth on large text
Left accent border (card)	#D32F2F solid 8px	Feature card highlight
Input focus border	#D32F2F	focus:border-clay
✅ Status / Feedback Colours
Used for form submission feedback messages:

State	Background	Text	Border
Success	green-50	green-800	green-200
Error	red-50	red-800	red-200
NOTE

These use Tailwind's built-in green/red palette, not the custom theme tokens.

🔤 Typography System
Property	Value
Primary Font	Inter, system-ui, sans-serif
Font Variable (serif)	--font-serif: "Inter"
Font Variable (sans)	--font-sans: "Inter"
Type Hierarchy
Element	Size	Weight	Style	Tracking
Hero h1	text-5xl → text-8xl	font-black	Normal	tracking-tighter
Section h2	text-4xl → text-7xl	font-bold	Normal	tracking-tighter
Card h3	text-2xl	font-bold	Normal	—
Section labels	text-[10px] – text-[11px]	font-bold	italic	tracking-[0.3em] – tracking-[0.4em]
Nav links	text-[11px]	font-bold	italic	tracking-widest
Body / descriptions	text-sm – text-lg	Normal	italic	—
Button text	text-xs	font-bold	Normal	tracking-widest
Footer fine print	text-[10px]	Normal	Normal	tracking-widest
📐 Spacing & Layout Tokens
Token	Value	Usage
Section padding (vertical)	py-24 (6rem)	Main content sections
Section padding (horizontal)	px-6 / md:px-16	Responsive side padding
Max content width	max-w-7xl	Content container
Card padding	p-8 – p-10 / md:p-12 – md:p-20	Internal card spacing
Card border radius	rounded-2xl – rounded-3xl / rounded-[3rem]	Soft, modern curves
Header height	h-20 (5rem)	Fixed sticky header
Gap between grid items	gap-8 – gap-20	Section layout
🌊 Motion & Effects
Effect	Value	Context
Scroll behaviour	scroll-behavior: smooth	Entire page
Header blur	backdrop-blur-md	Sticky nav glassmorphism
Card hover lift	whileHover={{ y: -5 }}	Staffing tier cards
Section entry	opacity: 0 → 1, x: -30 → 0	Fade + slide from left
Scale entry	scale: 0.95 → 1	Hero stat grid
Card hover shadow	hover:shadow-xl / hover:shadow-2xl	Interactive depth
Industries marquee	translateX(0) → translateX(-50%), 60s linear infinite	Auto-scrolling bar
Decorative blur orbs	blur-[100px] – blur-[150px]	Ambient glows
🧩 Visual Design Summary
Mermaid diagram
🎨 Quick Copy Reference

Primary Green (Moss):   #0B5B31  ·  rgb(11, 91, 49)
Primary Red (Clay):     #D32F2F  ·  rgb(237, 28, 36)
Dark Text (Slate):      #3C3C3B  ·  rgb(60, 60, 59)
Medium Text (Sage):     #666666  ·  rgb(102, 102, 102)
Background (Sand):      #F9F9F9  ·  rgb(249, 249, 249)
White (Cream):          #FFFFFF  ·  rgb(255, 255, 255)
SVG Stroke:             #666666  ·  (used at 5% opacity)
TIP

The colour palette uses a minimal, high-contrast duo-tone approach — pairing deep forest green (Moss) with bold red (Clay) against neutral whites and greys. This creates a professional, trustworthy aesthetic appropriate for B2B staffing and hospitality services.