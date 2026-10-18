import type { ChangeEvent } from "@/lib/types";

function when(iso: string) {
  return new Date(iso).toLocaleString("es-UY", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

/** Lista de cambios detectados, con lo agregado en verde y lo quitado en rojo. */
export function ChangeList({ changes }: { changes: ChangeEvent[] }) {
  return (
    <>
      {changes.map((change, i) => (
        <section key={i} className="card">
          <div className="row">
            <strong>
              {change.competitor} · {change.pageLabel}
            </strong>
            <span className="spacer" />
            <span className="muted small">{when(change.at)}</span>
          </div>
          <a className="small" href={change.url} target="_blank" rel="noreferrer">
            {change.url}
          </a>
          <ul className="diff">
            {change.items.slice(0, 12).map((item, j) =>
              item.type === "changed" ? (
                <li key={j}>
                  <del>{item.before}</del>
                  <ins>{item.after}</ins>
                </li>
              ) : item.type === "added" ? (
                <li key={j}>
                  <ins>{item.text}</ins>
                </li>
              ) : (
                <li key={j}>
                  <del>{item.text}</del>
                </li>
              ),
            )}
            {change.items.length > 12 && <li className="muted small">…y {change.items.length - 12} cambios más</li>}
          </ul>
        </section>
      ))}
    </>
  );
}
