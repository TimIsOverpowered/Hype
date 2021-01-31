import React from "react";

class Tooltip extends React.PureComponent {
  getList = (payload) => {
    let payloadArray = Object.keys(payload);
    let list = [];
    for (let i = 0; i < payloadArray.length; i++) {
      let key = Object.keys(payload)[i];
      if (key === "duration") continue;
      list.push(
        <li key={i} className="recharts-tooltip-item">
          <span className="recharts-tooltip-item-name">{key}</span>
          <span className="recharts-tooltip-item-separator">{` : `}</span>
          <span className="recharts-tooltip-item-value">{payload[key]}</span>
          <span className="recharts-tooltip-item-unit"></span>
        </li>
      );
    }
    return list;
  };

  render() {
    const { active } = this.props;

    if (active) {
      const { payload, label } = this.props;
      if (!payload) return null;
      if (payload.length === 0) return null;
      return (
        <div
          className="recharts-default-tooltip"
          style={{
            margin: "0px",
            padding: "10px",
            whiteSpace: "nowrap",
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
            {this.getList(payload[0].payload)}
          </ul>
        </div>
      );
    }

    return null;
  }
}

export default Tooltip;
