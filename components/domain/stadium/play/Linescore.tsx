type LinescoreCell = { runs: number | null };

type LinescoreData = {
  away: LinescoreCell[];
  home: LinescoreCell[];
  currentInning: number;
  currentHalf: "top" | "bottom";
  totalInnings: number;
};

const TEAM_CELL_STYLE = {
  width: 116,
  minWidth: 116,
  maxWidth: 116
} as const;

const TEAM_LABEL_STYLE = {
  display: "block",
  maxWidth: "100%",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap"
} as const;

const SCORE_CELL_STYLE = {
  width: 22,
  minWidth: 0,
  paddingLeft: 1,
  paddingRight: 1
} as const;

const TOTAL_CELL_STYLE = {
  width: 24,
  minWidth: 0,
  paddingLeft: 2,
  paddingRight: 2
} as const;

export function Linescore({
  linescore,
  awayLabel,
  homeLabel,
  totalAway,
  totalHome
}: {
  linescore: LinescoreData;
  awayLabel: string;
  homeLabel: string;
  totalAway: number;
  totalHome: number;
}) {
  return (
    <div className="stadium-linescore" style={{ overflowX: "hidden" }}>
      <table style={{ tableLayout: "fixed" }}>
        <thead>
          <tr>
            <th className="team-head" style={TEAM_CELL_STYLE}>TEAM</th>
            {Array.from({ length: linescore.totalInnings }, (_, i) => (
              <th
                key={i + 1}
                className={i + 1 === linescore.currentInning ? "is-current" : ""}
                style={SCORE_CELL_STYLE}
              >
                {i + 1}
              </th>
            ))}
            <th className="rh" style={TOTAL_CELL_STYLE}>R</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className="team-cell" style={TEAM_CELL_STYLE}>
              <span style={TEAM_LABEL_STYLE} title={awayLabel}>{awayLabel}</span>
            </td>
            {linescore.away.map((cell, i) => (
              <td
                key={`a${i}`}
                className={i + 1 === linescore.currentInning && linescore.currentHalf === "top" ? "is-current" : ""}
                style={SCORE_CELL_STYLE}
              >
                {cell.runs === null ? "-" : cell.runs}
              </td>
            ))}
            <td className="rh" style={TOTAL_CELL_STYLE}><strong>{totalAway}</strong></td>
          </tr>
          <tr>
            <td className="team-cell" style={TEAM_CELL_STYLE}>
              <span style={TEAM_LABEL_STYLE} title={homeLabel}>{homeLabel}</span>
            </td>
            {linescore.home.map((cell, i) => (
              <td
                key={`h${i}`}
                className={i + 1 === linescore.currentInning && linescore.currentHalf === "bottom" ? "is-current" : ""}
                style={SCORE_CELL_STYLE}
              >
                {cell.runs === null ? "-" : cell.runs}
              </td>
            ))}
            <td className="rh" style={TOTAL_CELL_STYLE}><strong>{totalHome}</strong></td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
