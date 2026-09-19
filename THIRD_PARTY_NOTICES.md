# Third-Party Notices

## Three.js

The 3D nebula and bookshelf use Three.js. Runtime modules needed by the
bookshelf are vendored under `public/nebula-scene/vendor/` and
`public/books/vendor/three/` so the public experience does not depend on a
third-party CDN.

- Source: https://github.com/mrdoob/three.js
- Version: 0.165.0
- License: MIT
- Copyright: 2010-2024 Three.js Authors

## ThreeUI Structure Flow

The Structure Flow component and shared styles in `src/shaders/` come from
ThreeUI:

- Source: https://threeui.com/source-code/structure-flow.json
- Source revision: `SHA-256 40eb5bac81e3`
- Package: `@designcodeio/threeui`
- License: MIT
- Copyright: 2026 Meng To

The registered source files retain their published contents. Local adapters
connect the collection's other variants to the official package exports.

## ThreeUI Particle Wordmark

The Particle Wordmark component, canonical HTML, and shared styles in
`src/shaders/` come from ThreeUI:

- Source: https://threeui.com/source-code/particle-wordmark.json
- Source revision: `5a736cd3c1f6f19802f61ebb10e1701b9f7aa26e`
- Package: `@designcodeio/threeui`
- License: MIT
- Copyright: 2026 Meng To

The registered files retain their published contents and checksums. A Vite
transform changes the generated SVG wordmark to `Soular`, scales it for the
shorter name, and matches its frame background to the landing page without
editing the registered source.

## Its Hover Icons

The inline SVG paths for the sparkles, refresh, message-circle, users, and close
icons in `public/nebula-scene/index.html` are adapted from Its Hover:

- Source: https://github.com/itshover/itshover
- License: Apache License 2.0
- License text: https://www.apache.org/licenses/LICENSE-2.0

The original Motion-based interactions were reimplemented with CSS so the
static Three.js scene does not require an additional runtime dependency.

## Childlike Sketch Transformation

The visual method used for `docs/images/soular-cover-childlike.svg` and its
PNG export is adapted from Childlike Sketch Transformation by ZS:

- Source: https://github.com/Zuo1204/childlike-sketch-skill
- License: CC BY-NC 4.0
- License text: https://creativecommons.org/licenses/by-nc/4.0/legalcode

The original product-sketch method was modified into a single connected
persona-and-nebula subject for the Soular project cover.
