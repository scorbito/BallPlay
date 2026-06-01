type LinescoreCell = { runs: number | null };

type LinescoreData = {
  away: LinescoreCell[];
  home: LinescoreCell[];
  currentInning: number;
  currentHalf: "top" | "bottom";
  totalInnings: number;
};

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
    <div className="stadium-linescore">
      <table>
        <thead>
          <tr>
            <th className="team-head">TEAM</th>
            {Array.from({ length: linescore.totalInnings }, (_, i) => (
              <th key={i + 1} className={i + 1 === linescore.currentInning ? "is-current" : ""}>{i + 1}</th>
            ))}
            <th className="rh">R</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className="team-cell"><span>{awayLabel}</span></td>
            {linescore.away.map((cell, i) => (
              <td key={`a${i}`} className={i + 1 === linescore.currentInning && linescore.currentHalf === "top" ? "is-current" : ""}>
                {cell.runs === null ? "-" : cell.runs}
              </td>
            ))}
            <td className="rh"><strong>{totalAway}</strong></td>
          </tr>
          <tr>
            <td className="team-cell"><span>{homeLabel}</span></td>
            {linescore.home.map((cell, i) => (
              <td key={`h${i}`} className={i + 1 === linescore.currentInning && linescore.currentHalf === "bottom" ? "is-current" : ""}>
                {cell.runs === null ? "-" : cell.runs}
              </td>
            ))}
            <td className="rh"><strong>{totalHome}</strong></td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
