import { Link } from 'react-router-dom';
import {
  BarChart3, BookOpen, Briefcase, Building2, Check, Clock, Cloud, Code2, Cog, Compass, Cpu, ExternalLink, FileText, IndianRupee,
  Landmark, Layers, Megaphone, PenLine, PenTool, PlayCircle, ShieldCheck, Smartphone, Sparkles, Target, Users, BrainCircuit, Wrench,
  Trophy, Library, Globe,
} from 'lucide-react';
import { Badge, ProgressBar } from '../ui';

const ICONS = {
  Code2, BrainCircuit, BarChart3, Cloud, ShieldCheck, Smartphone, PenTool, Target, Megaphone, Users, IndianRupee, Briefcase, Cog,
  Building2, Cpu, PenLine, Landmark, Layers, Sparkles, Compass,
};
export const roadmapIcon = (name) => ICONS[name] || Compass;

const RESOURCE_ICONS = { course: BookOpen, doc: FileText, video: PlayCircle, practice: Trophy, book: Library, community: Users, tool: Wrench };

export function RoadmapCard({ roadmap, to, progress, footer }) {
  const Icon = roadmapIcon(roadmap.icon);
  return (
    <Link to={to} className="card card-hover card-link" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div className="row" style={{ alignItems: 'flex-start' }}>
        <span className="feature-icon" style={{ marginBottom: 0 }}>
          <Icon aria-hidden="true" />
        </span>
        <div className="flex-1">
          <h3 style={{ margin: 0, fontSize: '1rem' }}>{roadmap.title}</h3>
          <div className="row xs muted" style={{ '--gap': '8px', marginTop: 2 }}>
            <span>{roadmap.category}</span>
            {roadmap.duration && (
              <span className="row" style={{ '--gap': '4px' }}>
                <Clock size={12} aria-hidden="true" /> {roadmap.duration}
              </span>
            )}
          </div>
        </div>
        {roadmap.source === 'ai' && <Badge tone="accent" icon={Sparkles}>AI</Badge>}
      </div>
      {roadmap.summary && <p className="small muted mb-0" style={{ flex: 1 }}>{roadmap.summary}</p>}
      {roadmap.roles?.length > 0 && (
        <div className="chips">
          {roadmap.roles.slice(0, 3).map((r) => (
            <span key={r} className="badge">{r}</span>
          ))}
        </div>
      )}
      {typeof progress === 'number' && (
        <div className="stack" style={{ '--gap': '4px' }}>
          <div className="row-between xs muted">
            <span>Progress</span>
            <span>{progress}%</span>
          </div>
          <ProgressBar value={progress} small label={`${roadmap.title} progress`} />
        </div>
      )}
      {footer}
    </Link>
  );
}

/**
 * Phase/step timeline. When `onToggle` is provided, steps become checkable.
 * `completed` is a Set of step keys.
 */
export function RoadmapTimeline({ roadmap, completed = new Set(), onToggle, pendingKey }) {
  return (
    <ol className="list-plain">
      {roadmap.phases.map((phase, pi) => {
        const doneCount = phase.steps.filter((s) => completed.has(s.key)).length;
        const phaseDone = doneCount === phase.steps.length && phase.steps.length > 0;
        return (
          <li key={pi} className="phase">
            <span className={`phase-dot ${phaseDone ? 'done' : ''}`} aria-hidden="true">
              {phaseDone && <Check />}
            </span>
            <div className="row-between mb-1">
              <h3 style={{ margin: 0 }}>
                <span className="subtle small" style={{ fontWeight: 600 }}>Phase {pi + 1} · </span>
                {phase.title}
              </h3>
              <span className="xs muted">
                {phase.duration && `${phase.duration} · `}
                {onToggle ? `${doneCount}/${phase.steps.length} done` : `${phase.steps.length} steps`}
              </span>
            </div>
            <div style={{ marginBottom: 20 }}>
              {phase.steps.map((step) => {
                const done = completed.has(step.key);
                const id = `step-${step.key}`;
                return (
                  <div key={step.key} className={`step-item ${done ? 'done' : ''}`}>
                    {onToggle && (
                      <input
                        id={id}
                        type="checkbox"
                        className="step-check"
                        checked={done}
                        disabled={pendingKey === step.key}
                        onChange={(e) => onToggle(step.key, e.target.checked)}
                      />
                    )}
                    <div className="flex-1">
                      <div className="row" style={{ '--gap': '8px' }}>
                        <label htmlFor={onToggle ? id : undefined} className="step-title bold" style={{ cursor: onToggle ? 'pointer' : 'default' }}>
                          {step.title}
                        </label>
                        {step.isProject && <Badge tone="warning">Project</Badge>}
                      </div>
                      {step.description && <p className="small muted" style={{ margin: '4px 0 8px' }}>{step.description}</p>}
                      {step.resources?.length > 0 && (
                        <div className="chips">
                          {step.resources.map((r) => {
                            const RIcon = RESOURCE_ICONS[r.type] || Globe;
                            return (
                              <a key={r.url + r.title} className="resource-link" href={r.url} target="_blank" rel="noopener noreferrer">
                                <RIcon aria-hidden="true" />
                                {r.title}
                                <ExternalLink aria-hidden="true" />
                                <span className="sr-only">(opens in a new tab)</span>
                              </a>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

export function RoadmapMeta({ roadmap }) {
  return (
    <div className="grid-2">
      {roadmap.roles?.length > 0 && (
        <div className="card">
          <h3 className="row" style={{ '--gap': '8px' }}>
            <Briefcase size={17} aria-hidden="true" /> Entry-level roles
          </h3>
          <div className="chips">
            {roadmap.roles.map((r) => (
              <span key={r} className="badge">{r}</span>
            ))}
          </div>
        </div>
      )}
      {roadmap.skills?.length > 0 && (
        <div className="card">
          <h3 className="row" style={{ '--gap': '8px' }}>
            <Target size={17} aria-hidden="true" /> Skills you'll build
          </h3>
          <div className="chips">
            {roadmap.skills.map((s) => (
              <span key={s} className="badge badge-primary">{s}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
