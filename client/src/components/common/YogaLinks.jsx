import { ExternalLink, PlayCircle } from 'lucide-react';

const yt = (q) => `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`;

const LINKS = [
  { title: 'Morning yoga for beginners', note: '10–15 minutes to start the day', url: yt('10 minute morning yoga for beginners') },
  { title: 'Yoga for stress & anxiety', note: 'Calm the mind before exams or interviews', url: yt('yoga for stress and anxiety relief for students') },
  { title: 'Desk yoga for students', note: 'Quick stretches between study sessions', url: yt('desk yoga stretches for students') },
  { title: 'Pranayama & breathing', note: 'Anulom vilom, bhramari and focus breathing', url: yt('pranayama breathing exercises for focus') },
  { title: 'Yoga Nidra for better sleep', note: 'Guided relaxation for deep rest', url: yt('yoga nidra for deep sleep') },
  { title: 'Surya Namaskar step by step', note: 'Full-body warm-up routine', url: yt('surya namaskar step by step for beginners') },
  { title: 'Yoga for concentration', note: 'Build focus for long study hours', url: yt('yoga for concentration and memory') },
  { title: 'Yoga With Adriene', note: 'Free full-length yoga channel', url: 'https://www.youtube.com/@yogawithadriene' },
];

/** Free yoga & wellness video links (open YouTube in a new tab). */
export function YogaLinks() {
  return (
    <section className="card mt-2" aria-labelledby="yoga-h">
      <div className="card-header">
        <h2 id="yoga-h" className="row" style={{ '--gap': '8px' }}>
          <PlayCircle size={17} aria-hidden="true" /> Yoga & relaxation videos
        </h2>
      </div>
      <p className="small muted">Free guided sessions on YouTube. Move gently, stop if anything hurts, and check with a doctor if you have a health condition.</p>
      <div className="grid-4">
        {LINKS.map((l) => (
          <a key={l.title} href={l.url} target="_blank" rel="noopener noreferrer" className="card card-hover card-link" style={{ padding: 14 }}>
            <div className="small bold row" style={{ '--gap': '6px', flexWrap: 'nowrap', justifyContent: 'space-between' }}>
              <span>{l.title}</span>
              <ExternalLink size={14} aria-hidden="true" style={{ flexShrink: 0 }} />
            </div>
            <div className="xs muted">{l.note}</div>
            <span className="sr-only">(opens YouTube in a new tab)</span>
          </a>
        ))}
      </div>
    </section>
  );
}
