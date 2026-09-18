# Third-Party Notices

## FiftySounds Vienna

The opening soundtrack is an edited 8.4-second excerpt of “Vienna” by
FiftySounds:

- Source: https://www.fiftysounds.com/royalty-free-music/vienna.html
- License: https://www.fiftysounds.com/music-license.html
- Required attribution: https://www.fiftysounds.com

The local copy is trimmed, loudness-normalized, and faded to match the opening
animation. The source and attribution link remain visible in the opening footer.

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
