const fs = require('fs');
const path = 'src/app/components/AI/AIChatPanel.tsx';
let s = fs.readFileSync(path, 'utf8');
const start = s.indexOf('  const respondToFixOffer = useCallback');
const end = s.indexOf('  const handleSend = async');
if (start < 0 || end < 0) throw new Error(`markers not found ${start} ${end}`);
s = s.slice(0, start) + s.slice(end);
s = s.replace(
  /const handleSend = async \(text\?: string\): Promise<string \| undefined> => \{[\s\S]*?if \(!isChatConnected\) \{/,
  `const handleSend = async (text?: string): Promise<string | undefined> => {
    const content = (text ?? input).trim();
    if (!content && photos.length === 0) return undefined;

    if (!isChatConnected) {`,
);
s = s.replace(/\s*\{m\.fixOffer && !m\.fixOffer\.resolved && \([\s\S]*?\)\}\n\s*\{m\.fixOffer\?\.resolved && \([\s\S]*?\)\}/, '');
s = s.replace(/\s*\{m\.mergeAction && !m\.mergeAction\.resolved && \([\s\S]*?\)\}\n\s*\{m\.mergeAction\?\.resolved && \([\s\S]*?\)\}/, '');
s = s.replace(/\s*\{m\.statusAction && !m\.mergeAction\?\.prUrl && \([\s\S]*?\)\}/, '');
fs.writeFileSync(path, s);
console.log('ok', s.includes('respondToFixOffer'), s.includes('fixOffer &&'));
