import React, { useCallback } from "react";
import {
  getBezierPath,
  getEdgeCenter,
  getMarkerEnd,
  useReactFlow
} from "react-flow-renderer";

import "./css/buttonedge.css";
import { Delete } from "@mui/icons-material";

export default function RemoveEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  data,
  arrowHeadType,
  markerEndId
}) {
  const { setEdges } = useReactFlow();

  const onEdgeClick = useCallback(
    (evt, edgeId) => {
      evt.preventDefault();
      evt.stopPropagation();

      setEdges(eds => eds.filter(e => e.id !== edgeId));
    },
    [setEdges]
  );

  const edgePath = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition
  });

  const markerEnd = getMarkerEnd(arrowHeadType, markerEndId);

  const [edgeCenterX, edgeCenterY] = getEdgeCenter({
    sourceX,
    sourceY,
    targetX,
    targetY
  });

  const foreignObjectSize = 40;

  return (
    <>
      <path
        id={id}
        style={style}
        className="react-flow__edge-path"
        d={edgePath}
        markerEnd={markerEnd}
      />

      <foreignObject
        width={foreignObjectSize}
        height={foreignObjectSize}
        x={edgeCenterX - foreignObjectSize / 2}
        y={edgeCenterY - foreignObjectSize / 2}
        className="edgebutton-foreignobject"
        requiredExtensions="http://www.w3.org/1999/xhtml"
      >
        <body xmlns="http://www.w3.org/1999/xhtml">
          <button
            className="edgebutton"
            onClick={event => onEdgeClick(event, id)}
            title="Excluir linha"
          >
            <Delete sx={{ width: "14px", height: "14px", color: "#ef4444" }} />
          </button>
        </body>
      </foreignObject>
    </>
  );
}
