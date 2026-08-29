import { readFileSync, writeFileSync } from 'node:fs';

const SMALL = new Set(['and', 'or', 'the', 'to', 'with', 'on', 'in', 'of', 'a', 'an', 'at', 'for']);

/** "3/4 sit-up" -> "3/4 Sit-Up"; kapitalisiert auch nach - und /. */
function titleCase(value) {
  return value
    .split(' ')
    .map((word, wordIndex) =>
      word.replace(/[^\s\-/]+/g, (part, offset) => {
        const first = wordIndex === 0 && offset === 0;
        if (!first && SMALL.has(part)) return part;
        return part.charAt(0).toUpperCase() + part.slice(1);
      }),
    )
    .join(' ');
}

const raw = JSON.parse(readFileSync('exercises.json', 'utf-8'));

const seed = raw
  .map((e) => {
    const muscles = [];
    for (const muscle of [e.target, ...e.secondary_muscles]) {
      const label = titleCase(muscle);
      if (!muscles.includes(label)) muscles.push(label);
    }
    return {
      datasetId: e.id,
      name: titleCase(e.name),
      muscleGroups: muscles,
      equipment: titleCase(e.equipment),
      // Schritt-Anleitung (nur en — der Datensatz führt kein Deutsch, siehe README).
      instructions: e.instruction_steps?.en ?? [],
      image: e.image.replace(/^images\//, ''),
      gif: e.gif_url.replace(/^videos\//, ''),
    };
  })
  .sort((a, b) => a.datasetId.localeCompare(b.datasetId));

writeFileSync('exercises.seed.json', JSON.stringify(seed));
console.log('entries', seed.length);
console.log('sample', JSON.stringify(seed[0]));
console.log('sample', JSON.stringify(seed.find((e) => e.name.includes('45'))));
console.log('bytes', JSON.stringify(seed).length);
