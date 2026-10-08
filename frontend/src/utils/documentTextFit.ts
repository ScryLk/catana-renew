export function fitDocumentText(text: string, family: string, size: number, width: number, height: number, weight = 400) {
  const canvas = typeof window !== 'undefined' ? window.document.createElement('canvas') : null;
  const context = canvas?.getContext('2d');
  if (!context) return {size, overflow: true};
  const fits = (candidate: number) => {
    context.font = `${weight} ${candidate}px ${family}`;
    const lines: string[] = [];
    for (const paragraph of text.split('\n')) {
      let current = '';
      for (const word of paragraph.split(/(\s+)/)) {
        if (context.measureText(word).width > width) return false;
        if (current && context.measureText(current + word).width > width) {lines.push(current); current = word.trimStart();}
        else current += word;
      }
      lines.push(current);
    }
    if (lines.length * candidate > height) return false;
    // CSS line-height:1 uses the font baseline, while scrollHeight includes
    // unused ascenders/descenders. Check the ink actually painted by each line
    // so visible glyphs cannot exceed the box or be hidden by clipping.
    return lines.every((line, index) => {
      const metrics = context.measureText(line);
      const bounds = [metrics.fontBoundingBoxAscent, metrics.fontBoundingBoxDescent,
        metrics.actualBoundingBoxAscent, metrics.actualBoundingBoxDescent];
      if (!line || !bounds.every(Number.isFinite)) return true;
      const baseline = (candidate + metrics.fontBoundingBoxAscent - metrics.fontBoundingBoxDescent) / 2;
      return index * candidate + baseline - metrics.actualBoundingBoxAscent >= -.01
        && index * candidate + baseline + metrics.actualBoundingBoxDescent <= height + .01;
    });
  };
  const minimum = Math.min(size, Math.max(6, size * .5));
  let candidate = size;
  while (candidate > minimum && !fits(candidate)) candidate = Math.max(minimum, candidate - .5);
  return {size: candidate, overflow: !fits(candidate)};
}

