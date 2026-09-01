import { DATASET_MANIFEST, SLICES, ROWS, ACCELERATORS } from './src/data/dataset';

console.log("=== MANIFEST COUNTS ===");
console.log("counts:", JSON.stringify(DATASET_MANIFEST.counts, null, 2));
console.log("");
console.log("=== SLICES ===");
console.log("Total slices:", SLICES.length);
console.log("Comparable slices:", SLICES.filter(s => s.comparable).length);
console.log("");
console.log("=== TOP SLICES (by result count) ===");
SLICES.slice(0, 5).forEach(s => {
  console.log(`  ${s.sliceId}: results=${s.resultCount} vendors=${s.vendorCount} families=${s.familyCount} comparable=${s.comparable}`);
});
console.log("");
console.log("=== ACCELERATORS ===");
console.log("Distinct accelerator slugs:", ACCELERATORS.length);
console.log("Names:", ACCELERATORS.map(a => a.name));
