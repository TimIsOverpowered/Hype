export default function CustomTooltip(props) {
  const { active, payload, label } = props;

  if (!active || !payload || payload?.length === 0) return null;

  const getList = (p) => {
    const list = [];
    for (const [key, value] of Object.entries(p)) {
      if (key === "duration") continue;
      list.push(
        <li key={key} className="recharts-tooltip-item">
          <span className="recharts-tooltip-item-name">{key}</span>
          <span className="recharts-tooltip-item-separator">{` : `}</span>
          <span className="recharts-tooltip-item-value">{value}</span>
          <span className="recharts-tooltip-item-unit"></span>
        </li>
      );
    }
    return list;
  };

  return (
    <div
      className="recharts-default-tooltip"
      style={{
        margin: "0px",
        padding: "10px",
        whiteSpace: "nowrap",
        background: "#000",
      }}
    >
      <p className="recharts-tooltip-label" style={{ margin: "0px" }}>
        {label}
      </p>
      <ul
        className="recharts-tooltip-item-list"
        style={{
          display: "block",
          paddingTop: "4px",
          paddingBottom: "4px",
          color: "#fff",
        }}
      >
        {getList(payload[0].payload)}
      </ul>
    </div>
  );
}
