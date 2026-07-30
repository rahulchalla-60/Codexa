// sample.ts
function calculateBlastRadius(depth: number) {
    console.log("Calculating...");
    return depth * 2;
}

function main() {
    const radius = calculateBlastRadius(4);
    console.log("Blast Radius:", radius);
}

main();
