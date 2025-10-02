0) Executive summary (what you’re building)

One-page web app (React+TypeScript+three.js) that:

Loads a GLB/OBJ, infers units, shows mesh

Detects markings (from texture/vertex colors) → overlays editable curves/areas

Lets user edit markings with simple tools (draw, erase, select, rename, presets)

Generates socket via slice→2D offset→loft→cap, applying marking-based relief

Validates manifoldness & thickness, and exports socket.glb + report.json

All CPU/geometry work runs in Web Workers for a smooth UI.

Design emphasizes simplicity, repeatable steps, and small tests so you don’t get stuck.

1) Non-goals (MVP guardrails)

No cloud storage or accounts.

No non-rigid physics/tissue simulation.

No mobile support (desktop only, for clinics/laptops).

No multi-case project management—single case in memory.

2) Personas & core journey

Primary user: prosthetist/clinic staff.

Journey: Drag in limb file → auto markings → quick tweak → one-click socket → export.

Success = they can do the whole demo in under 3 minutes without reading docs.

3) Technology & versions (pin these)

Language: TypeScript 5.x

App: React 18 + Vite 5

3D: three.js r1xx, GLTFLoader, DRACOLoader (optional), OrbitControls

Geometry helpers:

three-mesh-bvh (fast raycast & slicing)

three-bvh-csg (optional; for capping/cleanup booleans)

js-angusj-clipper (robust 2D polygon offset for slice shelling)

State: Zustand

Schema/validation: Zod

Workers: Web Workers + Comlink

Testing: Vitest (unit), Playwright (E2E), @testing-library/react

Lint/format: ESLint + Prettier

Docs: TypeDoc

CI: GitHub Actions

Deploy: Static hosting (Vercel/Netlify/GitHub Pages)

4) Repository layout
akro-socket-web/
  apps/web/
    src/
      app/
        App.tsx
        routes.ts
      components/
        Canvas3D.tsx
        Toolbar.tsx
        PanelImport.tsx
        PanelDetect.tsx
        PanelEdit.tsx
        PanelGenerate.tsx
        PanelExport.tsx
        Toast.tsx
      hooks/
        useCaseStore.ts           # Zustand state
      workers/
        detect.worker.ts          # HSV segmentation & back-project
        slice.worker.ts           # BVH slicing → contours
        loft.worker.ts            # offset/loft/cap/smooth/QC
      geom/
        axis.ts                   # PCA axis
        bvh.ts                    # BVH setup and helpers
        clipper.ts                # 2D offset helpers
        qc.ts                     # manifold/wall checks
        export.ts                 # GLB export (with optional Draco)
      styles/
        theme.css
      utils/
        units.ts
        gltf.ts
        undo.ts
        id.ts
        logging.ts
      tests/                      # unit tests colocated by domain
    index.html
    vite.config.ts
    tsconfig.json
    package.json
  packages/fixtures/
    meshes/
      synthetic-cylinder.glb
      sample-limb.glb
    textures/
      markings.png
  .github/workflows/ci.yml
  README.md
  CONTRIBUTING.md
  CODE_OF_CONDUCT.md

5) UI/UX specification (exact behavior)
5.1 Layout

Top bar: app name + Import button + Help (opens quick tips)

Left panel (wizard): 5 tabs in order

Import & Scale

Auto-Detect Markings

Edit Markings

Generate Socket

Export & QC

Center: WebGL canvas (three.js)

Right panel: Contextual controls for active tab and live numeric readouts.

Bottom: Status line (units, tri count, FPS, last operation time).

5.2 Buttons and controls (each tab)
(1) Import & Scale

Drag & drop area (accept .glb, .gltf, .obj + .mtl + textures).

Units: dropdown (mm/cm/m) default = detect from glTF asset or ask.

Scale input: numeric; updates bounding box readout.

Downsample checkbox: target ≤ 200k tris.

Next (disabled until mesh loaded).

Keyboard

Ctrl+O: open file dialog.

R: reset view (fit to object).

Tooltips

Units tooltip explains physical size and why it matters.

(2) Auto-Detect Markings

Button: “Detect from texture” (runs in worker).

Color presets: Red/Blue/Green (range sliders H/S/V).

Result layers: checkboxes for line vs area classes.

Re-run button appears after changes.

Next enabled if at least one marking exists (or user skips).

(3) Edit Markings

Tools: Select, Draw (polyline), Paint (area), Erase, Smooth, Split/Join

Snap to surface: toggle (always on by default).

Classes (radio): trimline, relief_tender, pad_load, landmark

Label field (autocomplete common terms)

Strength: 0..1 slider (weights relief)

Presets: PTB / TSB (sets default classes & strengths)

Undo/Redo: buttons, Ctrl+Z / Ctrl+Shift+Z

Next when at least trimline OR user chooses “No trimline (auto)” toggle.

(4) Generate Socket

Params:

Thickness (mm) default 4.0

Slice step (mm) default 5.0

Smoothing (mm) default 2.0

Relief depths: per class, % of thickness (e.g., tender 120%, pad 60%)

Run: “Generate socket”

Progress list (each step shows ✓ or error):

Axis/PCA

Slicing

Offsetting (with relief)

Lofting

Trim/cap

Smoothing

QC

Preview: toggles “Show limb”, “Show socket”, “Clip plane” slider.

(5) Export & QC

QC badges:

Manifold: pass/fail

Min wall: pass/fail (threshold shown)

Self-intersections: 0 / N faces involved

Export buttons:

Download socket.glb

Download report.json

Download evidence.glb (limb+curves+trim surface)

New case: reset app.

Accessibility

All controls keyboard reachable; labels associated; high-contrast theme option.

6) Application state (Zustand)
type Units = "mm" | "cm" | "m";

type MarkClass = "trimline" | "relief_tender" | "pad_load" | "landmark";
type Geometry3D = { kind: "polyline" | "polygon"; points: [number,number,number][] };

interface CaseMeta {
  name: string;
  units: Units;
  triCount: number;
  bbox: { min: [number,number,number]; max: [number,number,number] };
}

interface Marking {
  id: string;
  label: string;
  cls: MarkClass;
  geom: Geometry3D;
  strength: number;   // 0..1, default 0.5
  color: string;      // UI only
}

interface SocketParams {
  thicknessMM: number;
  sliceStepMM: number;
  smoothingMM: number;
  reliefPct: Record<MarkClass, number>; // e.g., { relief_tender: 120, pad_load: 60, ... }
  trimlineId: string | null;            // null → auto-suggest
}

interface QCReport {
  manifold: boolean;
  minWallOK: boolean;
  minWallMM: number;
  selfIntersections: number;
  notes: string[];
}

interface CaseState {
  meta: CaseMeta | null;
  limb: THREE.Mesh | null;
  markings: Marking[];
  socketParams: SocketParams;
  qc: QCReport | null;
  evidenceScene: THREE.Scene | null;
}


Undo/redo stores diffs of markings and socketParams.

Persist last used parameters in localStorage.

7) Core algorithms (step-by-step)
7.1 Load & scale

Accept file(s) → if OBJ, also require MTL & textures (resolve relative paths).

If GLB → read asset (metersPerUnit) to infer units; else ask user.

Compute bounding box, tri count; if tri count > 200k, decimate (three’s SimplifyModifier or meshopt simplifier).

Build BVH (MeshBVH) for the limb mesh for fast raycast & slicing.

Checks

Abort if: no geometry, non-finite vertices, zero-area triangles > threshold.

Show “Fit” camera and default lights.

7.2 Auto-detect markings (texture HSV)

Runs in detect.worker.ts:

Inputs: mesh UVs, texture image (ImageBitmap), HSV thresholds per color.
Process:

Draw texture to OffscreenCanvas; convert sRGB→linear; compute HSV for downsampled 2K texture.

For each color range, make a binary mask; morph open/close; connected components filter by area/elongation.

UV→3D back-projection:

For each marked pixel center (u,v), find triangle via precomputed UV triangle map (build once by rasterizing triangles to UV grid).

Barycentric interpolate to get 3D point; store component id.

For each component:

If elongated (principal axis AR > threshold) → polyline:

Build geodesic path: start at one end (extreme along major axis), iteratively walk nearest neighbors constrained to the triangle adjacency graph; then smooth (Chaikin or Laplacian).

Else → polygon:

Project 3D points onto local tangent frame (per-component average normal & axes), compute 2D alpha shape or concave hull; back to 3D by snapping points to surface.

Classify default cls: thin = trimline or landmark (depending on length); blob = relief_tender.

Emit Marking[] with colors and default strength = 0.5.

Edge cases

No texture → check for vertex colors; if none → skip to manual tools.

Multiple UV islands → handled by component segmentation.

7.3 Editing tools

All tools snap to surface using BVH raycasting; polylines are stored as 3D points on the surface.

Select: Click on nearest marking (distance in 3D), highlight, show label/class.

Draw:

Polyline: on pointer move, raycast to surface → add point if distance > ε (e.g., 1 mm); smooth every N points.

Polygon: same, but closed loop (auto close on double-click or proximity).

Erase: hit-test curve segments and remove within radius.

Smooth: localized Laplacian smoothing along the curve.

Split/Join: cut at nearest vertex; join endpoints if within tolerance.

Class/Strength: updates selected markings’ metadata.

Presets: PTB/TSB apply:

Default strength per class,

Add common landmarks if missing (labels prefilled).

Undo/Redo

Capture atomic operations (add/remove points, change class/label/strength).

Keyboard: Ctrl+Z, Ctrl+Shift+Z.

7.4 Socket generation (worker)

Runs in loft.worker.ts; the main thread sends:

Limb mesh (positions, indices) + BVH structure or a lightweight lookup proxy (rebuild BVH in worker if needed),

Markings, Params, Units.

Steps

Axis/PCA

Compute centroid; covariance of vertex positions; principal axis (largest eigenvalue) = limb axis.

Ensure axis points from distal to proximal by heuristic (longest dimension upwards; user can flip via toggle).

Slicing

Planes orthogonal to axis at sliceStepMM increments between bbox min..max.

For each plane, intersect mesh with BVH to obtain intersection segments; stitch to ordered loops (close tolerance).

Discard tiny/noisy loops; keep largest loop per Z (assuming single limb).

Relief field per slice

For each marking, compute influence radius and relief depth:

For polylines: distance from slice points to polyline (projected to plane) → Gaussian falloff.

For polygons: inside test + falloff to boundary.

Relief depth (mm) = thickness * (reliefPct[class]/100) scaled by falloff.

Offsetting

For each slice loop (2D in slice plane), compute inward offset = thickness + reliefDepth(local).

Use Clipper: polygon → scaled integers; offset with round/miter join; CleanPolygons; choose the largest resulting polygon as inner wall for that slice.

Lofting

Triangulate each slice (earcut); generate quads/triangles between consecutive slices by nearest-neighbor ring mapping (same winding).

Construct inner surface from offset loops.

For outer surface:

Option A (simpler): duplicate inner rings and shift outward by local wall vector (per slice plane normal) using original limb normal hints; or

Option B (robust): recompute outward offset loops (thickness only) and loft separately; then bridge inner and outer rims at top/bottom.

Cap distal end (bottom) with triangulation.

Trimline

If user provided trimline: fit a smooth 3D curve; convert to a scalar height function along axis; remove faces above it.

Cap trim edge with triangulated rim (or subtract extruded trim body via CSG).

Smoothing

Taubin/Laplacian smoothing on socket surfaces, small iterations; preserve min wall (skip if it violates).

QC

Manifold: boundary edge count == 0; Euler characteristic check per connected component.

Self-intersection: triangle-triangle intersection using BVH acceleration.

Min wall thickness: sample multiple rays from inner to outer surface along local normals; compute min distance; compare ≥ (thickness - tolerance).

Export prep

Build THREE.BufferGeometry for socket; attach metadata (params).

Construct report.json (see §8) + evidence.glb (limb, curves as line sets, optional trim surface).

Numerical tolerances

Epsilon distances proportional to model size (e.g., bbox diagonal * 1e-5).

Clipper scaling: multiply mm by 1000 and round to integers for stability.

8) Output formats
8.1 socket.glb

Single mesh, watertight, with material name “Socket”.

extras.akro:

{
  "units": "mm",
  "thicknessMM": 4.0,
  "sliceStepMM": 5.0,
  "smoothingMM": 2.0,
  "reliefPct": { "relief_tender": 120, "pad_load": 60, "trimline": 0, "landmark": 0 }
}

8.2 report.json
{
  "case": "untitled",
  "mesh": { "triangles": 152340, "bboxMM": [x,y,z] },
  "params": { ...as above... },
  "qc": {
    "manifold": true,
    "selfIntersections": 0,
    "minWallMM": 3.8,
    "minWallOK": true
  },
  "counters": {
    "slices": 74,
    "offsetFailures": 0,
    "capHolesClosed": 1
  },
  "timingsMs": {
    "slice": 420,
    "offset": 310,
    "loft": 220,
    "capping": 45,
    "smoothing": 30,
    "qc": 120
  },
  "notes": []
}

8.3 evidence.glb

Scene graph:

LimbMesh

Markings/… (each polyline/polygon as LineSegments/Mesh)

TrimSurface (optional)

SocketPreview (optional)

9) Coding standards & documentation

ESLint with @typescript-eslint/recommended, eslint-plugin-react, eslint-plugin-import.

Prettier enforced via pre-commit hook (Husky + lint-staged).

TypeDoc comments for exported functions with examples.

Function headers format:

/**
 * Compute principal axis of a triangle mesh using PCA.
 * @param positions Float32Array length 3N
 * @returns unit axis (x,y,z) pointing to +Z-ish; flips if needed.
 * @throws if covariance is not positive semi-definite
 * @example
 * const axis = pcaAxis(positions);
 */
export function pcaAxis(positions: Float32Array): [number, number, number] { ... }


Comment style: Describe why (rationale) above complex blocks; inline what is obvious from code sparingly.

Public APIs: Zod-validated inputs/outputs in geom/ modules.

10) Testing strategy (tight feedback, catch issues early)
10.1 Unit tests (Vitest)

Units scaling: conversions roundtrip.

HSV segmentation: synthetic texture with colored lines → expect N components within pixel tolerance.

Polyline smoothing: idempotence on straight lines; length reduction bounded.

Slicer: synthetic cylinder sliced at 10 mm → equal circumference loops count & order.

Clipper offset: pathological star/figure-8 loops → inner offset exists and is simple.

Lofting: two circles different radii → loft produces no self-intersections.

QC: handcrafted non-manifold mesh gets flagged.

10.2 Property tests

Random noisy loops passed to offset/clean → result is simple polygon with no zero-length edges.

10.3 Integration tests

Full pipeline on synthetic limb (textured cylinder with painted bands):

Detect → Edit (programmatic drawing) → Generate → QC pass → Export.

Snapshot GLB byte size within tolerance; parse back and verify triangle counts.

10.4 E2E (Playwright)

Launch app, drag sample-limb.glb fixture, click detect, accept defaults, run generate, export; assert downloaded files exist and JSON validates against schema.

10.5 Performance guard

Benchmark each worker stage (Vitest “bench”): keep under set ms budget on CI runners, else fail.

11) Performance & robustness

Workers for detect/slice/loft/QC to keep UI at 60 fps.

OffscreenCanvas for texture processing in worker.

BVH built once per mesh; reuse in slicing and hit tests.

Memory: limit triangles to ≤ 200k; decimate on import if needed.

Cancellation: each worker job supports abort via AbortController (e.g., user changes params mid-run).

12) Accessibility, i18n, theming

All buttons labeled with aria-label.

Keyboard shortcuts documented in Help.

Theme switch (light/dark/high-contrast).

Strings stored in i18n/en.json (future localization).

13) Security & privacy

Runs locally; no uploads.

Drag-dropped files stay in memory; export requires explicit user click.

No PII stored; only localStorage for last parameters.

14) CI/CD & DevOps

GitHub Actions workflow:

install → typecheck → lint → unit tests → build → e2e → artifact

On main, deploy preview to Vercel/Netlify; on tagged release, produce downloadable ZIP of dist/.

Conventional Commits (feat:, fix:) + changesets for versioning.

.github/workflows/ci.yml (essentials):

name: ci
on: [push, pull_request]
jobs:
  build-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20 }
      - run: npm ci
      - run: npm run typecheck
      - run: npm run lint
      - run: npm run test -- --run
      - run: npm run build
      - run: npx playwright install --with-deps
      - run: npm run e2e

15) Developer onboarding checklist

Install Node 20; npm ci.

npm run dev → open http://localhost:5173.

Load packages/fixtures/sample-limb.glb.

Click Detect, then Generate socket, then Export.

Run tests: npm test, npm run e2e.

16) Definition of Done (MVP)

Can import a typical limb GLB (≤200k tris), auto-detect several markings from texture, edit them, and generate a manifold socket that passes min wall checks, and export socket.glb + report.json.

“3-minute demo” runs smoothly on a mid-range laptop.

17) Implementation breadcrumbs (pseudocode for tricky parts)

Detect worker

onmessage = async ({ data }) => {
  const { imageBitmap, uvAttr, indexAttr, hsvRanges } = data;
  const hsvTex = toHSV(imageBitmap);                // OffscreenCanvas
  const masks = hsvSegment(hsvTex, hsvRanges);      // per color
  const comps = connectedComponents(masks);
  const uvTriMap = buildUVTriangleMap(uvAttr, indexAttr, hsvTex.width, hsvTex.height);
  const markings = comps.map(comp => classifyAndTrace3D(comp, uvTriMap, uvAttr, indexAttr));
  postMessage({ markings });
};


Slice worker

const planes = buildPlanes(axis, bbox, stepMM);
for (const p of planes) {
  const loops = intersectMeshWithPlaneBVH(meshBVH, positions, indices, p);
  const orderedLoops = buildClosedLoops(loops, eps);
  out.push(orderedLoops);
}
postMessage({ slices: out });


Loft worker (offset + loft)

for each slice i:
  const loop2D = toPlane2D(slice[i], plane[i]);
  const relief = reliefField(loop2D, markings2D[i], params);
  const inner = clipperOffset(loop2D, -(params.thicknessMM + relief));
  innerLoops[i] = cleanLargest(inner);

const innerSurf = loftLoops(innerLoops);
const capped   = capDistal(innerSurf);
const trimmed  = applyTrimline(capped, trimlineCurve3D, axis);
const smoothed = taubinSmooth(trimmed, params.smoothingMM);
const qc = runQC(smoothed);

postMessage({ socketGeometry: smoothed, qc });

18) Visual polish

Soft key light + fill + rim; grid floor toggled.

Turntable animation (subtle) when idle.

Colors: limb neutral gray; markings vivid per class; socket translucent before export, solid after.

Tooltip microcopy next to each control; short and clear.

19) Future-ready hooks (but not MVP)

Draco compression on export (toggle).

Auto-trimline suggestion from knee/patella landmarks.

Save/load *.akrocase.json (params + markings), separate from GLB.