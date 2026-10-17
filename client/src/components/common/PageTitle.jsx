import { useDocumentTitle } from '../../hooks';

export function PageTitle({ title, subtitle, actions, docTitle }) {
  useDocumentTitle(docTitle || title);
  return (
    <div className="page-title">
      <div>
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {actions && <div className="row">{actions}</div>}
    </div>
  );
}
