# Snapr Marketing Site

**Stack:** Nuxt 4 · Tailwind CSS 4 · Nuxt SEO · @nuxt/image · nuxt-gtag · Nuxt Fonts

A minimal, editorial marketing page for the Snapr Chrome extension. Matches the extension's warm parchment design language exactly — same tokens, same fonts, same voice.

---

## Stack & Module Setup

### Dependencies

```bash
npx nuxi@latest init snapr-site
cd snapr-site

# Core
npm install -D tailwindcss @tailwindcss/vite

# Nuxt modules
npx nuxi module add @nuxtjs/seo      # nuxt-seo (site map, robots, og, schema.org)
npx nuxi module add @nuxt/image      # NuxtImg with automatic optimization
npx nuxi module add nuxt-gtag        # Google Analytics / G-tag
npx nuxi module add @nuxt/fonts      # Self-hosted font loading
```

### `nuxt.config.ts`

```ts
export default defineNuxtConfig({
	compatibilityDate: '2025-01-01',

	future: {
		compatibilityVersion: 4,
	},

	modules: ['@nuxtjs/seo', '@nuxt/image', 'nuxt-gtag', '@nuxt/fonts'],

	// ── Tailwind 4 via Vite plugin ──────────────────────────────
	vite: {
		plugins: [tailwindcss()],
	},

	css: ['~/assets/css/main.css'],

	// ── Nuxt SEO (site-wide defaults) ──────────────────────────
	site: {
		url: 'https://usesnapr.com',
		name: 'Snapr',
		description:
			'Clean website screenshots in one click. Viewport, full page, or element capture. PNG, JPG, WebP. No account needed.',
		defaultLocale: 'en',
	},

	// ── OG / Twitter defaults ───────────────────────────────────
	ogImage: {
		enabled: true,
	},

	// ── Robots ──────────────────────────────────────────────────
	robots: {
		enabled: true,
	},

	// ── Sitemap ─────────────────────────────────────────────────
	sitemap: {
		enabled: true,
	},

	// ── Schema.org ──────────────────────────────────────────────
	schemaOrg: {
		enabled: true,
	},

	// ── Google Analytics ────────────────────────────────────────
	gtag: {
		id: 'G-XXXXXXXXXX', // replace with real measurement ID
		initMode: 'manual', // only fires after cookie consent (if needed)
	},

	// ── @nuxt/image ─────────────────────────────────────────────
	image: {
		quality: 85,
		format: ['avif', 'webp'],
		screens: {
			sm: 640,
			md: 768,
			lg: 1024,
			xl: 1280,
			'2xl': 1536,
		},
	},

	// ── @nuxt/fonts ─────────────────────────────────────────────
	fonts: {
		families: [
			{
				name: 'Instrument Serif',
				provider: 'local',
				weights: [400],
				styles: ['normal', 'italic'],
			},
			{
				name: 'Geist Mono',
				provider: 'local',
				weights: ['100 900'],
				styles: ['normal'],
			},
		],
	},

	// ── App head fallback ───────────────────────────────────────
	app: {
		head: {
			htmlAttrs: { lang: 'en' },
			link: [
				{ rel: 'icon', type: 'image/png', href: '/icon-32.png' },
				{
					rel: 'icon',
					type: 'image/png',
					sizes: '192x192',
					href: '/icon-192.png',
				},
			],
		},
	},
});
```

---

## Design System

All values mirror the extension's CSS custom properties exactly.

### `assets/css/main.css`

```css
@import 'tailwindcss';

/* ── Self-hosted fonts ──────────────────────────────────────── */

@font-face {
	font-family: 'Geist Mono';
	font-style: normal;
	font-weight: 100 900;
	font-display: swap;
	src: url('/fonts/GeistMono-Regular.woff2') format('woff2');
}

@font-face {
	font-family: 'Instrument Serif';
	font-style: normal;
	font-weight: 400;
	font-display: swap;
	src: url('/fonts/InstrumentSerif-Regular.woff2') format('woff2');
}

@font-face {
	font-family: 'Instrument Serif';
	font-style: italic;
	font-weight: 400;
	font-display: swap;
	src: url('/fonts/InstrumentSerif-Italic.woff2') format('woff2');
}

/* ── CSS custom properties (match extension tokens exactly) ── */

:root {
	--bg: #faf8f4;
	--bg-secondary: #f2efe9;
	--bg-tertiary: #e8e2d8;
	--border: #ddd6ca;
	--border-subtle: #eae5dc;

	--text-primary: #1c1810;
	--text-secondary: #5c5044;
	--text-tertiary: #9c8e82;
	--text-disabled: #c8bbae;

	--accent: #2c4a35;
	--accent-hover: #1e3526;
	--accent-muted: rgba(44, 74, 53, 0.08);
	--accent-text: #faf8f4;

	--success: #3a6b46;
	--error: #8b3a2a;

	--shadow-sm:
		0 1px 3px rgba(28, 24, 16, 0.07), 0 1px 2px rgba(28, 24, 16, 0.04);
	--shadow-md:
		0 4px 16px rgba(28, 24, 16, 0.1), 0 2px 6px rgba(28, 24, 16, 0.06);
	--shadow-lg:
		0 12px 40px rgba(28, 24, 16, 0.12), 0 4px 12px rgba(28, 24, 16, 0.07);

	--font-mono: 'Geist Mono', 'Fira Code', monospace;
	--font-serif: 'Instrument Serif', Georgia, serif;
}

@media (prefers-color-scheme: dark) {
	:root {
		--bg: #1a1712;
		--bg-secondary: #221e18;
		--bg-tertiary: #2e2820;
		--border: #3a322a;
		--border-subtle: #2a2420;
		--text-primary: #f0eae0;
		--text-secondary: #c4b09a;
		--text-tertiary: #908070;
		--text-disabled: #5a4e44;
		--accent: #7aaf88;
		--accent-hover: #95c4a2;
		--accent-muted: rgba(122, 175, 136, 0.1);
		--accent-text: #0e1a12;
		--success: #7aaf88;
		--error: #c47060;
		--shadow-sm: 0 1px 3px rgba(0, 0, 0, 0.35);
		--shadow-md: 0 4px 16px rgba(0, 0, 0, 0.45), 0 2px 6px rgba(0, 0, 0, 0.25);
		--shadow-lg: 0 12px 40px rgba(0, 0, 0, 0.55), 0 4px 12px rgba(0, 0, 0, 0.3);
	}
}

/* ── Base ───────────────────────────────────────────────────── */

body {
	font-family: var(--font-mono);
	background: var(--bg);
	color: var(--text-primary);
	-webkit-font-smoothing: antialiased;
	text-rendering: optimizeLegibility;
}

/* ── Tailwind 4 theme extension ─────────────────────────────── */

@theme {
	--font-mono: var(--font-mono);
	--font-serif: var(--font-serif);

	--color-bg: var(--bg);
	--color-bg-secondary: var(--bg-secondary);
	--color-bg-tertiary: var(--bg-tertiary);
	--color-border: var(--border);
	--color-accent: var(--accent);
	--color-accent-hover: var(--accent-hover);
	--color-accent-text: var(--accent-text);
	--color-ink: var(--text-primary);
	--color-ink-secondary: var(--text-secondary);
	--color-ink-tertiary: var(--text-tertiary);
}
```

---

## Project Structure

```
snapr-site/
├── app/
│   ├── assets/
│   │   └── css/
│   │       └── main.css
│   ├── components/
│   │   ├── site/
│   │   │   ├── SiteHeader.vue
│   │   │   └── SiteFooter.vue
│   │   ├── home/
│   │   │   ├── HeroSection.vue
│   │   │   ├── FeatureGrid.vue
│   │   │   ├── HowItWorks.vue
│   │   │   ├── CompareTable.vue
│   │   │   ├── ScreenshotShowcase.vue
│   │   │   └── InstallCta.vue
│   │   └── ui/
│   │       ├── SnaprWordmark.vue
│   │       └── FeatureTag.vue
│   ├── pages/
│   │   └── index.vue
│   └── app.vue
├── public/
│   ├── fonts/
│   │   ├── GeistMono-Regular.woff2
│   │   ├── InstrumentSerif-Regular.woff2
│   │   └── InstrumentSerif-Italic.woff2
│   ├── screenshots/
│   │   ├── popup-light.png        (1280×800 retina, from Chrome Web Store)
│   │   ├── popup-dark.png
│   │   ├── fullpage-example.png
│   │   └── element-picker.png
│   ├── og-image.png               (1200×630)
│   ├── icon-32.png
│   └── icon-192.png
└── nuxt.config.ts
```

---

## Pages

### `/` — Home (single-page marketing)

All content lives on the index route. No separate feature pages in v1.

**Section order:**

1. **Header** — wordmark + CTA link
2. **Hero** — headline, subhead, primary CTA, popup screenshot
3. **Feature grid** — three modes, format control, presets, history
4. **How it works** — three steps
5. **Compare** — Snapr vs alternatives table
6. **Screenshot showcase** — real captures as social proof
7. **Install CTA** — Chrome Web Store button, keyboard shortcut callout
8. **Footer** — links, GitHub

---

## Components

### `app/app.vue`

```vue
<template>
	<NuxtRouteAnnouncer />
	<NuxtPage />
</template>
```

---

### `app/pages/index.vue`

```vue
<script setup lang="ts">
useSeoMeta({
	title: 'Snapr — Clean Screenshots for Everyone',
	description:
		'Clean website screenshots in one click. Viewport, full page, or element capture. PNG, JPG, WebP. No account needed.',
	ogTitle: 'Snapr — Clean Screenshots for Everyone',
	ogDescription:
		'The developer screenshot tool. Minimal UI, minimal permissions, zero accounts.',
	ogImage: '/og-image.png',
	ogType: 'website',
	twitterCard: 'summary_large_image',
	twitterTitle: 'Snapr — Clean Screenshots for Developers',
	twitterDescription:
		'Viewport, full page, or element capture. PNG, JPG, WebP. No account needed.',
	twitterImage: '/og-image.png',
});

useSchemaOrg([
	defineSoftwareApplication({
		name: 'Snapr',
		operatingSystem: 'Chrome, Edge, Brave, Arc',
		applicationCategory: 'DeveloperApplication',
		offers: {
			'@type': 'Offer',
			price: '0',
			priceCurrency: 'USD',
		},
		description:
			'Clean website screenshots in one click for developers, technical writers, and designers.',
	}),
]);
</script>

<template>
	<div class="min-h-screen" style="background: var(--bg);">
		<SiteHeader />
		<main>
			<HeroSection />
			<FeatureGrid />
			<HowItWorks />
			<ScreenshotShowcase />
			<CompareTable />
			<InstallCta />
		</main>
		<SiteFooter />
	</div>
</template>
```

---

### `app/components/site/SiteHeader.vue`

```vue
<template>
	<header
		class="sticky top-0 z-50 border-b"
		style="background: var(--bg); border-color: var(--border-subtle);"
	>
		<div class="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
			<!-- Wordmark -->
			<a href="/" class="no-underline">
				<span
					class="text-xl leading-none"
					style="font-family: var(--font-serif); font-style: italic; color: var(--text-primary);"
				>
					Snapr
				</span>
			</a>

			<!-- Nav -->
			<nav class="hidden md:flex items-center gap-6">
				<a
					href="#features"
					class="text-xs tracking-widest uppercase transition-colors"
					style="font-family: var(--font-mono); color: var(--text-tertiary);"
				>
					Features
				</a>
				<a
					href="#how-it-works"
					class="text-xs tracking-widest uppercase transition-colors"
					style="font-family: var(--font-mono); color: var(--text-tertiary);"
				>
					How it works
				</a>
				<a
					href="https://github.com/idrewlong/snapr"
					target="_blank"
					rel="noopener"
					class="text-xs tracking-widest uppercase transition-colors"
					style="font-family: var(--font-mono); color: var(--text-tertiary);"
				>
					GitHub
				</a>
			</nav>

			<!-- CTA -->
			<a
				href="https://chrome.google.com/webstore/detail/snapr"
				target="_blank"
				rel="noopener"
				class="inline-flex items-center gap-2 px-4 py-2 rounded text-xs font-medium tracking-wide transition-colors"
				style="
          font-family: var(--font-mono);
          background: var(--accent);
          color: var(--accent-text);
        "
			>
				Add to Chrome
			</a>
		</div>
	</header>
</template>
```

---

### `app/components/home/HeroSection.vue`

```vue
<template>
	<section class="pt-24 pb-20 px-6">
		<div class="max-w-5xl mx-auto">
			<!-- Eyebrow -->
			<p
				class="text-xs tracking-widest uppercase mb-6"
				style="font-family: var(--font-mono); color: var(--text-tertiary);"
			>
				Chrome Extension · Free · No account
			</p>

			<!-- Headline -->
			<h1
				class="text-5xl md:text-7xl leading-none tracking-tight mb-6 max-w-3xl"
				style="font-family: var(--font-serif); font-style: italic; color: var(--text-primary);"
			>
				Clean screenshots.<br />
				<em class="not-italic" style="color: var(--accent);">One click.</em>
			</h1>

			<!-- Subhead -->
			<p
				class="text-sm leading-relaxed mb-10 max-w-xl"
				style="font-family: var(--font-mono); color: var(--text-secondary);"
			>
				Viewport, full page, or element capture — saved as PNG, JPG, or WebP. No
				annotation clutter. No cloud sync. No account creation. Just open,
				click, save.
			</p>

			<!-- CTAs -->
			<div class="flex flex-wrap items-center gap-4 mb-16">
				<a
					href="https://chrome.google.com/webstore/detail/snapr"
					target="_blank"
					rel="noopener"
					class="inline-flex items-center gap-2 px-6 py-3 rounded-lg text-sm font-medium tracking-wide transition-colors"
					style="
            font-family: var(--font-mono);
            background: var(--accent);
            color: var(--accent-text);
            box-shadow: var(--shadow-md);
          "
				>
					<!-- Chrome icon -->
					<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
						<path
							d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm0 4a8 8 0 0 1 6.928 4H12a4 4 0 0 0-4 4 4 4 0 0 0 .263 1.438L4.931 9.13A7.966 7.966 0 0 1 12 4zm0 16a8 8 0 0 1-7.938-7H12a4 4 0 0 0 4-4 4 4 0 0 0-.584-2.074l3.353-5.806A7.963 7.963 0 0 1 20 12a8 8 0 0 1-8 8z"
						/>
					</svg>
					Add to Chrome — it's free
				</a>

				<a
					href="https://github.com/idrewlong/snapr"
					target="_blank"
					rel="noopener"
					class="inline-flex items-center gap-2 px-6 py-3 rounded-lg text-sm transition-colors"
					style="
            font-family: var(--font-mono);
            color: var(--text-secondary);
            border: 1px solid var(--border);
          "
				>
					View source
				</a>
			</div>

			<!-- Popup screenshot -->
			<div class="relative max-w-sm">
				<!-- Subtle background glow -->
				<div
					class="absolute inset-0 -m-8 rounded-3xl opacity-40"
					style="background: radial-gradient(ellipse at center, rgba(44,74,53,0.12) 0%, transparent 70%);"
				/>

				<div
					class="relative rounded-xl overflow-hidden"
					style="box-shadow: var(--shadow-lg); border: 1px solid var(--border);"
				>
					<NuxtImg
						src="/screenshots/popup-light.png"
						alt="Snapr popup showing viewport capture mode with a live preview thumbnail"
						width="380"
						height="540"
						format="avif"
						quality="90"
						loading="eager"
						fetchpriority="high"
					/>
				</div>

				<!-- Keyboard shortcut callout -->
				<div class="absolute -right-4 top-1/3 hidden lg:block">
					<div
						class="px-3 py-2 rounded-lg text-xs"
						style="
              font-family: var(--font-mono);
              background: var(--bg-secondary);
              border: 1px solid var(--border);
              box-shadow: var(--shadow-sm);
              color: var(--text-secondary);
              white-space: nowrap;
            "
					>
						<span style="color: var(--text-tertiary);">or press</span>
						<kbd
							class="ml-2 px-1.5 py-0.5 rounded text-xs"
							style="
                background: var(--bg-tertiary);
                border: 1px solid var(--border);
                font-family: var(--font-mono);
                color: var(--accent);
              "
						>
							Alt+Shift+S
						</kbd>
					</div>
				</div>
			</div>
		</div>
	</section>
</template>
```

---

### `app/components/home/FeatureGrid.vue`

```vue
<template>
	<section
		id="features"
		class="py-20 px-6"
		style="background: var(--bg-secondary); border-top: 1px solid var(--border-subtle);"
	>
		<div class="max-w-5xl mx-auto">
			<!-- Section label -->
			<p
				class="text-xs tracking-widest uppercase mb-12"
				style="font-family: var(--font-mono); color: var(--text-tertiary);"
			>
				Everything you need. Nothing you don't.
			</p>

			<div
				class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-px"
				style="border: 1px solid var(--border); border-radius: 12px; overflow: hidden; box-shadow: var(--shadow-sm);"
			>
				<FeatureCard
					v-for="feature in features"
					:key="feature.title"
					v-bind="feature"
				/>
			</div>
		</div>
	</section>
</template>

<script setup lang="ts">
const features = [
	{
		icon: '◻',
		title: 'Viewport capture',
		body: "One-click screenshot of exactly what's visible. No setup, no configuration.",
	},
	{
		icon: '⬛',
		title: 'Full-page capture',
		body: 'Scroll-and-stitch the entire page into a single image. Fixed headers handled automatically.',
	},
	{
		icon: '◈',
		title: 'Element capture',
		body: 'Hover over any DOM element and capture its exact bounding box. No cropping required.',
	},
	{
		icon: '⊡',
		title: 'Viewport presets',
		body: 'Capture at Desktop HD, Laptop, Tablet, or Mobile dimensions without resizing your window.',
	},
	{
		icon: '◫',
		title: 'PNG · JPG · WebP',
		body: 'Lossless or compressed output with adjustable quality. Retina-ready at 2× pixel density.',
	},
	{
		icon: '⊞',
		title: 'Capture history',
		body: 'Last 20 captures with thumbnails. Re-capture in one click when your site updates.',
	},
];
</script>
```

**`app/components/ui/FeatureCard.vue`** (used by FeatureGrid):

```vue
<script setup lang="ts">
defineProps<{
	icon: string;
	title: string;
	body: string;
}>();
</script>

<template>
	<div
		class="p-7 transition-colors"
		style="background: var(--bg); border-color: var(--border-subtle);"
	>
		<div class="text-2xl mb-4 leading-none" style="color: var(--accent);">
			{{ icon }}
		</div>
		<h3
			class="text-sm font-medium mb-2"
			style="font-family: var(--font-mono); color: var(--text-primary);"
		>
			{{ title }}
		</h3>
		<p
			class="text-xs leading-relaxed"
			style="font-family: var(--font-mono); color: var(--text-secondary);"
		>
			{{ body }}
		</p>
	</div>
</template>
```

---

### `app/components/home/HowItWorks.vue`

```vue
<template>
	<section id="how-it-works" class="py-24 px-6">
		<div class="max-w-5xl mx-auto">
			<p
				class="text-xs tracking-widest uppercase mb-12"
				style="font-family: var(--font-mono); color: var(--text-tertiary);"
			>
				How it works
			</p>

			<div class="grid grid-cols-1 md:grid-cols-3 gap-12">
				<div v-for="(step, i) in steps" :key="step.title" class="relative">
					<!-- Step number -->
					<div
						class="text-6xl leading-none mb-6"
						style="font-family: var(--font-serif); font-style: italic; color: var(--bg-tertiary);"
					>
						{{ i + 1 }}
					</div>
					<h3
						class="text-sm font-medium mb-2"
						style="font-family: var(--font-mono); color: var(--text-primary);"
					>
						{{ step.title }}
					</h3>
					<p
						class="text-xs leading-relaxed"
						style="font-family: var(--font-mono); color: var(--text-secondary);"
					>
						{{ step.body }}
					</p>
				</div>
			</div>
		</div>
	</section>
</template>

<script setup lang="ts">
const steps = [
	{
		title: 'Click the toolbar icon',
		body: 'The Snapr popup opens instantly. A live preview of the current tab loads in the thumbnail.',
	},
	{
		title: 'Choose your shot',
		body: 'Select viewport, full page, or element mode. Pick a size preset and output format.',
	},
	{
		title: 'Save',
		body: 'Hit Capture. The file downloads immediately. No upload, no cloud, no account required.',
	},
];
</script>
```

---

### `app/components/home/ScreenshotShowcase.vue`

```vue
<template>
	<section
		class="py-20 px-6"
		style="background: var(--bg-secondary); border-top: 1px solid var(--border-subtle); border-bottom: 1px solid var(--border-subtle);"
	>
		<div class="max-w-5xl mx-auto">
			<p
				class="text-xs tracking-widest uppercase mb-12"
				style="font-family: var(--font-mono); color: var(--text-tertiary);"
			>
				See it in action
			</p>

			<div class="grid grid-cols-1 md:grid-cols-2 gap-6">
				<div
					class="rounded-xl overflow-hidden"
					style="border: 1px solid var(--border); box-shadow: var(--shadow-md);"
				>
					<NuxtImg
						src="/screenshots/fullpage-example.png"
						alt="Full-page capture stitching a long landing page into a single image"
						width="620"
						height="420"
						format="avif"
						quality="85"
					/>
					<div
						class="px-5 py-4"
						style="border-top: 1px solid var(--border-subtle); background: var(--bg);"
					>
						<p
							class="text-xs"
							style="font-family: var(--font-mono); color: var(--text-tertiary);"
						>
							Full-page capture · Fixed headers removed automatically
						</p>
					</div>
				</div>

				<div
					class="rounded-xl overflow-hidden"
					style="border: 1px solid var(--border); box-shadow: var(--shadow-md);"
				>
					<NuxtImg
						src="/screenshots/element-picker.png"
						alt="Element picker overlay highlighting a hero component with bounding box"
						width="620"
						height="420"
						format="avif"
						quality="85"
					/>
					<div
						class="px-5 py-4"
						style="border-top: 1px solid var(--border-subtle); background: var(--bg);"
					>
						<p
							class="text-xs"
							style="font-family: var(--font-mono); color: var(--text-tertiary);"
						>
							Element capture · Hover to select any DOM element
						</p>
					</div>
				</div>
			</div>
		</div>
	</section>
</template>
```

---

### `app/components/home/CompareTable.vue`

```vue
<template>
	<section class="py-20 px-6">
		<div class="max-w-5xl mx-auto overflow-x-auto">
			<p
				class="text-xs tracking-widest uppercase mb-12"
				style="font-family: var(--font-mono); color: var(--text-tertiary);"
			>
				vs. the alternatives
			</p>

			<table
				class="w-full min-w-max text-xs"
				style="font-family: var(--font-mono); border-collapse: collapse;"
			>
				<thead>
					<tr style="border-bottom: 1px solid var(--border);">
						<th
							class="text-left py-3 pr-8 font-normal"
							style="color: var(--text-tertiary); letter-spacing: 0.06em; text-transform: uppercase;"
						>
							Tool
						</th>
						<th
							v-for="col in columns"
							:key="col"
							class="py-3 px-4 font-normal text-center"
							:class="col === 'Snapr' ? 'text-sm' : ''"
							:style="
								col === 'Snapr'
									? 'color: var(--accent); font-style: italic; font-family: var(--font-serif);'
									: 'color: var(--text-tertiary); letter-spacing: 0.06em; text-transform: uppercase;'
							"
						>
							{{ col }}
						</th>
					</tr>
				</thead>
				<tbody>
					<tr
						v-for="row in rows"
						:key="row.feature"
						class="transition-colors"
						style="border-bottom: 1px solid var(--border-subtle);"
					>
						<td class="py-3 pr-8" style="color: var(--text-secondary);">
							{{ row.feature }}
						</td>
						<td v-for="col in columns" :key="col" class="py-3 px-4 text-center">
							<span v-if="row[col] === true" style="color: var(--success);"
								>✓</span
							>
							<span
								v-else-if="row[col] === false"
								style="color: var(--text-disabled);"
								>—</span
							>
							<span v-else style="color: var(--text-secondary);">{{
								row[col]
							}}</span>
						</td>
					</tr>
				</tbody>
			</table>
		</div>
	</section>
</template>

<script setup lang="ts">
const columns = [
	'Snapr',
	'GoFullPage',
	'Awesome Screenshot',
	'Chrome DevTools',
];

const rows = [
	{
		feature: 'Viewport capture',
		Snapr: true,
		GoFullPage: false,
		'Awesome Screenshot': true,
		'Chrome DevTools': true,
	},
	{
		feature: 'Full-page capture',
		Snapr: true,
		GoFullPage: true,
		'Awesome Screenshot': true,
		'Chrome DevTools': false,
	},
	{
		feature: 'Element capture',
		Snapr: true,
		GoFullPage: false,
		'Awesome Screenshot': false,
		'Chrome DevTools': false,
	},
	{
		feature: 'Viewport presets',
		Snapr: true,
		GoFullPage: false,
		'Awesome Screenshot': false,
		'Chrome DevTools': true,
	},
	{
		feature: 'PNG / JPG / WebP',
		Snapr: true,
		GoFullPage: false,
		'Awesome Screenshot': true,
		'Chrome DevTools': false,
	},
	{
		feature: 'No account required',
		Snapr: true,
		GoFullPage: true,
		'Awesome Screenshot': false,
		'Chrome DevTools': true,
	},
	{
		feature: 'No cloud storage',
		Snapr: true,
		GoFullPage: true,
		'Awesome Screenshot': false,
		'Chrome DevTools': true,
	},
	{
		feature: 'Capture history',
		Snapr: true,
		GoFullPage: false,
		'Awesome Screenshot': true,
		'Chrome DevTools': false,
	},
	{
		feature: 'Keyboard shortcut',
		Snapr: true,
		GoFullPage: false,
		'Awesome Screenshot': false,
		'Chrome DevTools': false,
	},
];
</script>
```

---

### `app/components/home/InstallCta.vue`

```vue
<template>
	<section
		class="py-28 px-6"
		style="background: var(--bg-secondary); border-top: 1px solid var(--border-subtle);"
	>
		<div class="max-w-5xl mx-auto text-center">
			<h2
				class="text-4xl md:text-6xl leading-none mb-6"
				style="font-family: var(--font-serif); font-style: italic; color: var(--text-primary);"
			>
				Start capturing.
			</h2>

			<p
				class="text-sm mb-10 mx-auto max-w-sm"
				style="font-family: var(--font-mono); color: var(--text-secondary); line-height: 1.7;"
			>
				Free. No account. Works in Chrome, Edge, Brave, and Arc.
			</p>

			<div class="flex flex-col sm:flex-row items-center justify-center gap-4">
				<a
					href="https://chrome.google.com/webstore/detail/snapr"
					target="_blank"
					rel="noopener"
					class="inline-flex items-center gap-2 px-8 py-4 rounded-lg text-sm font-medium tracking-wide transition-colors"
					style="
            font-family: var(--font-mono);
            background: var(--accent);
            color: var(--accent-text);
            box-shadow: var(--shadow-md);
          "
				>
					Add to Chrome — it's free
				</a>
			</div>

			<!-- Keyboard shortcut note -->
			<p
				class="mt-8 text-xs"
				style="font-family: var(--font-mono); color: var(--text-tertiary);"
			>
				Or capture instantly with
				<kbd
					class="mx-1 px-1.5 py-0.5 rounded"
					style="
            background: var(--bg-tertiary);
            border: 1px solid var(--border);
            font-family: var(--font-mono);
            color: var(--accent);
            font-size: 11px;
          "
				>
					Alt+Shift+S
				</kbd>
				— no popup needed
			</p>
		</div>
	</section>
</template>
```

---

### `app/components/site/SiteFooter.vue`

```vue
<template>
	<footer
		class="py-10 px-6"
		style="border-top: 1px solid var(--border-subtle);"
	>
		<div
			class="max-w-5xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
		>
			<span
				style="font-family: var(--font-serif); font-style: italic; font-size: 18px; color: var(--text-tertiary);"
			>
				Snapr
			</span>

			<div class="flex flex-wrap gap-6">
				<a
					v-for="link in links"
					:key="link.label"
					:href="link.href"
					:target="link.external ? '_blank' : undefined"
					:rel="link.external ? 'noopener' : undefined"
					class="text-xs transition-colors"
					style="font-family: var(--font-mono); color: var(--text-tertiary);"
				>
					{{ link.label }}
				</a>
			</div>

			<p
				class="text-xs"
				style="font-family: var(--font-mono); color: var(--text-disabled);"
			>
				No tracking. No accounts. No cloud.
			</p>
		</div>
	</footer>
</template>

<script setup lang="ts">
const links = [
	{
		label: 'GitHub',
		href: 'https://github.com/idrewlong/snapr',
		external: true,
	},
	{
		label: 'Changelog',
		href: 'https://github.com/idrewlong/snapr/releases',
		external: true,
	},
	{ label: 'Privacy', href: '/privacy' },
];
</script>
```

---

## SEO Strategy

### Nuxt SEO module coverage

| Concern                          | Module             | Notes                         |
| -------------------------------- | ------------------ | ----------------------------- |
| `<title>` + `<meta description>` | `useSeoMeta()`     | Set per-page via composable   |
| Open Graph / Twitter card        | `useSeoMeta()`     | `/og-image.png` at 1200×630   |
| JSON-LD structured data          | `useSchemaOrg()`   | `SoftwareApplication` type    |
| Canonical URL                    | `@nuxtjs/seo` auto | Based on `site.url` in config |
| `robots.txt`                     | `robots` module    | Allow all in production       |
| `sitemap.xml`                    | `sitemap` module   | Auto-generated from routes    |

### Target keywords

**Primary:** `chrome extension screenshot`, `website screenshot chrome`, `developer screenshot tool`

**Secondary:** `full page screenshot chrome`, `element screenshot extension`, `no account screenshot chrome`, `portfolio screenshot tool`

**Long-tail:** `screenshot chrome extension no cloud`, `webpage screenshot png webp chrome`, `viewport screenshot preset chrome extension`

### Keyword placement checklist

- [ ] H1 contains "screenshot" and "one click"
- [ ] `<title>` under 60 chars: `Snapr — Clean Screenshots for Developers`
- [ ] Meta description under 160 chars
- [ ] `alt` text on all `<NuxtImg>` tags describes the action, not just the image
- [ ] Canonical URL set via `site.url`
- [ ] Structured data (`SoftwareApplication`) with free price offer
- [ ] Open Graph image at 1200×630 with extension UI visible

### Google Analytics (`nuxt-gtag`)

```ts
// Track Chrome Web Store link clicks
useGtag().trackEvent('cta_click', {
	event_category: 'conversion',
	event_label: 'add_to_chrome',
	value: 1,
});
```

Add to the CTA `<a>` tags via `@click` handler in `HeroSection.vue` and `InstallCta.vue`.

---

## OG Image

Create `/public/og-image.png` at **1200×630** showing:

- Left half: extension popup screenshot on a warm parchment background
- Right half: headline `Clean screenshots. One click.` in Instrument Serif italic, subhead in Geist Mono, and the Snapr wordmark

Can be auto-generated with `@nuxtjs/og-image` module (Satori-based) instead of a static image:

```ts
// nuxt.config.ts addition
ogImage: {
  fonts: [
    'Instrument+Serif:400',
    'Geist+Mono:400',
  ],
}
```

```vue
<!-- pages/index.vue -->
defineOgImageComponent('SnaprOg', { headline: 'Clean screenshots. One click.',
sub: 'Viewport, full page, or element capture. No account.', })
```

---

## Privacy Page (`/privacy`)

Short static page. Key points:

- Snapr the extension: zero data collection, everything stays in the browser
- Snapr the website: Google Analytics (anonymized IP, no cross-site tracking)
- No cookies beyond analytics
- No accounts, no email collection

---

## Deployment

### Vercel (recommended)

```bash
# vercel.json — no special config needed for Nuxt 4 SSG
# nuxt.config.ts: add ssr: false for static export, or keep SSR for edge rendering
```

```ts
// Static site generation (no server required)
nitro: {
  preset: 'static',
},
```

```bash
vercel --prod
```

### Netlify

```toml
# netlify.toml
[build]
  command = "npm run generate"
  publish = ".output/public"
```

---

## Launch Checklist

- [ ] Real Chrome Web Store URL in all CTA `href` attributes
- [ ] Replace `G-XXXXXXXXXX` with real GA4 measurement ID
- [ ] `/public/screenshots/` populated with actual extension screenshots (1280×800 retina)
- [ ] `/public/og-image.png` created at 1200×630
- [ ] Font files copied from `src/fonts/` to `public/fonts/`
- [ ] Privacy page written
- [ ] DNS pointed at deployment
- [ ] Verify `sitemap.xml` at `usesnapr.com/sitemap.xml`
- [ ] Verify `robots.txt` at `usesnapr.com/robots.txt`
- [ ] Test Lighthouse score (target: 95+ Performance, 100 SEO, 100 Accessibility)
- [ ] Test OG image preview with [opengraph.xyz](https://www.opengraph.xyz)
- [ ] Verify structured data with Google Rich Results Test
