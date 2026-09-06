import { useEffect, useState } from 'react';
import { WikiArt } from './artwork';
import { parseSourceGuide, type SourceGuide } from './sourceGuide';

export function SourceGuideReader({ questId, file, runId }: { questId: string; file: string; runId: string }) {
  const [guide, setGuide] = useState<SourceGuide | null>(null);
  const [error, setError] = useState('');
  const [sectionId, setSectionId] = useState('');
  const [saveMessage, setSaveMessage] = useState('');
  useEffect(() => {
    const abort = new AbortController();
    setGuide(null); setError(''); setSectionId(''); setSaveMessage('');
    if (!/^[a-z0-9-]+\.json$/.test(file)) { setError('This walkthrough could not be loaded.'); return; }
    fetch(`${import.meta.env.BASE_URL}runeproof/source-guides/${file}`, { signal: abort.signal })
      .then(async response => {
        if (!response.ok) throw new Error('unavailable');
        const parsed = parseSourceGuide(await response.json(), questId);
        if (!parsed) throw new Error('invalid guide');
        if (abort.signal.aborted) return;
        setGuide(parsed);
        try {
          const saved = JSON.parse(localStorage.getItem(`FATE_RUNEPROOF_SOURCE:${encodeURIComponent(runId)}:${encodeURIComponent(questId)}`) ?? 'null');
          setSectionId(saved?.revision === parsed.revision && parsed.sections.some(s => s.id === saved.sectionId) ? saved.sectionId : parsed.sections[0].id);
        } catch { setSectionId(parsed.sections[0].id); }
      })
      .catch(() => { if (!abort.signal.aborted) setError('This walkthrough could not be loaded. Reopen it to try again.'); });
    return () => abort.abort();
  }, [questId, file, runId]);
  const select = (id: string) => {
    if (!guide?.sections.some(section => section.id === id)) return;
    setSectionId(id);
    try {
      localStorage.setItem(`FATE_RUNEPROOF_SOURCE:${encodeURIComponent(runId)}:${encodeURIComponent(questId)}`, JSON.stringify({ revision: guide.revision, sectionId: id }));
      setSaveMessage('Place saved to this run.');
    } catch { setSaveMessage('Your place could not be saved. You can keep reading.'); }
  };
  if (error) return <p role="alert">{error}</p>;
  if (!guide) return <p role="status">Loading walkthrough…</p>;
  const section = guide.sections.find(section => section.id === sectionId) ?? guide.sections[0];
  const index = guide.sections.indexOf(section);
  const paths = [...new Set(section.steps.map(step => step.sourcePath))];
  const main = section.steps.filter(step => step.role !== 'related');
  const related = section.steps.filter(step => step.role === 'related');
  const renderInstruction = (step: SourceGuide['sections'][number]['steps'][number]) => {
    const children = step.role !== 'related' ? related.filter(child => child.parentId === step.id) : [];
    return <li key={step.id}>{step.externalDependency && <p className="rp-notice">{step.note ?? 'This instruction needs Quest Helper’s in-game overlay or the original puzzle guide.'}</p>}{step.text.map((text, i) => <p key={i}>{text}</p>)}{step.dialogue.length > 0 && <details><summary>Dialogue choices</summary><ul>{step.dialogue.map((line, i) => <li key={i}>{line}</li>)}</ul></details>}{children.length > 0 && <details><summary>Related route instructions</summary><p>Use the directions that match your current position and quest state.</p><ul className="rp-source-steps">{children.map(renderInstruction)}</ul></details>}</li>;
  };
  const sectionRelated = related.filter(step => !main.some(parent => parent.id === step.parentId));
  return <section aria-label={`${questId} source walkthrough`} className="rp-source-reader">
    <div className="rp-guide-scope"><WikiArt id="quest" size={18} /><p>Source walkthrough · These instructions include alternative routes. Read the route that matches your quest. Automatic step permissions and supply tracking are not available for this walkthrough yet.</p></div>
    <label className="rp-source-section-picker">Quest section<select aria-label="Quest section" value={section.id} onChange={event => select(event.target.value)}>{guide.sections.map((entry, i) => <option key={entry.id} value={entry.id}>{i + 1}. {entry.title}</option>)}</select></label>
    <article className="rp-instruction"><span className="rp-eyebrow">SECTION {index + 1} OF {guide.sections.length}</span><h3>{section.title}</h3>
      <ol className="rp-source-steps">{main.map(renderInstruction)}</ol>
      {sectionRelated.length > 0 && <details className="rp-source-related" open={!main.length}><summary>Related route instructions</summary><p>These are conditional directions and alternatives. Use the ones that match your current position and quest state; they are not an ordered checklist.</p><ul className="rp-source-steps">{sectionRelated.map(renderInstruction)}</ul></details>}
    </article>
    <div className="rp-instruction-actions"><button className="rp-text-button" disabled={index === 0} onClick={() => select(guide.sections[index - 1].id)}>‹ Previous section</button><button className="rp-primary" disabled={index === guide.sections.length - 1} onClick={() => select(guide.sections[index + 1].id)}>Next section ›</button></div>
    <p className="rp-save-note" role="status">{saveMessage || 'Reading does not change your quest progress.'}</p>
    <details className="rp-route"><summary>About this walkthrough</summary><p>In-game conditions, puzzles and optional routes may require the original guide alongside these notes. Reading the final section does not mark the quest complete.</p>{guide.diagnostics.length > 0 && <p>Some source logic has not been translated. Follow the in-game quest state when choosing a route.</p>}{paths.map(path => {
      const helper = /^src\/main\/java\/[a-zA-Z0-9/]+\.java$/.test(path) && /^[a-f0-9]{40}$/.test(guide.revision);
      const wiki = /^https:\/\/oldschool\.runescape\.wiki\//.test(path);
      return helper || wiki ? <p key={path}><a target="_blank" rel="noreferrer" href={helper ? `https://github.com/Zoinkwiz/quest-helper/blob/${guide.revision}/${path}` : path}>{helper ? 'Quest Helper source · BSD-2-Clause' : 'OSRS Wiki source · CC BY-NC-SA 3.0'} ↗</a></p> : null;
    })}<p><a href={`${import.meta.env.BASE_URL}runeproof/quest-helper-notices.txt`} target="_blank" rel="noreferrer">Quest Helper copyright and licence notices ↗</a></p></details>
  </section>;
}
