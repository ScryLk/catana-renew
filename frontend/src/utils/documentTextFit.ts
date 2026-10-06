export function fitDocumentText(text: string, family: string, size: number, width: number, height: number, weight = 400) {
  const canvas = typeof window !== 'undefined' ? window.document.createElement('canvas') : null;
  const context = canvas?.getContext('2d');
  if (!context) return {size, overflow: true};
  const fits = (candidate: number) => {
    context.font = `${weight} ${candidate}px ${family}`;
    let lines = 0;
    for (const paragraph of text.split('\n')) {
      let current = '';
      lines += 1;
      for (const word of paragraph.split(/(\s+)/)) {
        if (context.measureText(word).width > width) return false;
        if (current && context.measureText(current + word).width > width) {lines += 1; current = word.trimStart();}
        else current += word;
      }
    }
    return lines * candidate <= height;
  };
  const minimum = Math.min(size, Math.max(6, size * .5));
  let candidate = size;
  while (candidate > minimum && !fits(candidate)) candidate = Math.max(minimum, candidate - .5);
  return {size: candidate, overflow: !fits(candidate)};
}

