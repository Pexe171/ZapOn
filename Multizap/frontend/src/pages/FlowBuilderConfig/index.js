import React, {
  useState,
  useEffect,
  useReducer,
  useContext,
  useCallback,
} from "react";
import { SiOpenai } from "react-icons/si";
import typebotIcon from "../../assets/typebot-ico.png";
import { HiOutlinePuzzle } from "react-icons/hi";

import { toast } from "react-toastify";
import { useHistory } from "react-router-dom";

// ✅ Importação do hook useTheme
import { makeStyles, useTheme } from "@material-ui/core/styles";
import Paper from "@material-ui/core/Paper";
import Button from "@material-ui/core/Button";

import audioNode from "./nodes/audioNode";
import typebotNode from "./nodes/typebotNode";
import openaiNode from "./nodes/openaiNode";
import messageNode from "./nodes/messageNode.js";
import startNode from "./nodes/startNode";
import menuNode from "./nodes/menuNode";
import intervalNode from "./nodes/intervalNode";
import imgNode from "./nodes/imgNode";
import randomizerNode from "./nodes/randomizerNode";
import videoNode from "./nodes/videoNode";
import questionNode from "./nodes/questionNode";
import fileNode from "./nodes/fileNode";

import api from "../../services/api";

import MainHeader from "../../components/MainHeader";
import Title from "../../components/Title";
import MainHeaderButtonsWrapper from "../../components/MainHeaderButtonsWrapper";
import MainContainer from "../../components/MainContainer";
import toastError from "../../errors/toastError";
import { AuthContext } from "../../context/Auth/AuthContext";
import { Stack, Typography } from "@mui/material";
import { useParams } from "react-router-dom/cjs/react-router-dom.min";
import { Box, CircularProgress } from "@material-ui/core";
import BallotIcon from "@mui/icons-material/Ballot";

import "reactflow/dist/style.css";

import ReactFlow, {
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
  onElementsRemove,
  useReactFlow,
} from "react-flow-renderer";
import FlowBuilderAddTextModal from "../../components/FlowBuilderAddTextModal";
import FlowBuilderIntervalModal from "../../components/FlowBuilderIntervalModal";
import FlowBuilderConditionModal from "../../components/FlowBuilderConditionModal";
import FlowBuilderMenuModal from "../../components/FlowBuilderMenuModal";
import {
  AccessTime,
  CallSplit,
  DynamicFeed,
  Image,
  ImportExport,
  LibraryBooks,
  Message,
  MicNone,
  RocketLaunch,
  Videocam,
} from "@mui/icons-material";
import RemoveEdge from "./nodes/removeEdge";
import FlowBuilderAddImgModal from "../../components/FlowBuilderAddImgModal";
import FlowBuilderTicketModal from "../../components/FlowBuilderAddTicketModal";
import FlowBuilderAddAudioModal from "../../components/FlowBuilderAddAudioModal";
import FlowBuilderAddFileModal from "../../components/FlowBuilderAddFileModal";

import { useNodeStorage } from "../../stores/useNodeStorage";
import FlowBuilderRandomizerModal from "../../components/FlowBuilderRandomizerModal";
import FlowBuilderAddVideoModal from "../../components/FlowBuilderAddVideoModal";
import FlowBuilderSingleBlockModal from "../../components/FlowBuilderSingleBlockModal";
import singleBlockNode from "./nodes/singleBlockNode";
import { colorPrimary } from "../../styles/styles";
import ticketNode from "./nodes/ticketNode";
import { ConfirmationNumber } from "@material-ui/icons";
import FlowBuilderTypebotModal from "../../components/FlowBuilderAddTypebotModal";
import FlowBuilderOpenAIModal from "../../components/FlowBuilderAddOpenAIModal";
import FlowBuilderAddQuestionModal from "../../components/FlowBuilderAddQuestionModal";
import SaveIcon from "@mui/icons-material/Save";

const useStyles = makeStyles((theme) => ({
  mainPaper: {
    flex: 1,
    padding: 0,
    position: "relative",
    backgroundColor: "#fafbfc",
    overflowY: "scroll",
    ...theme.scrollbarStyles,
    border: "none",
    borderRadius: "12px",
    boxShadow: "0 2px 12px rgba(0, 0, 0, 0.04)",
  },
  sidebar: {
    width: "280px",
    backgroundColor: "#ffffff",
    height: "100%",
    position: "absolute",
    left: 0,
    top: 0,
    zIndex: 1111,
    padding: "24px 16px",
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-start",
    borderRight: "1px solid #e5e7eb",
    borderRadius: "12px 0 0 12px",
    boxShadow: "4px 0 24px rgba(0, 0, 0, 0.04)",
  },
  sidebarCollapsed: {
    width: "64px",
    padding: "16px 8px",
    alignItems: "center",
  },
  sidebarTitle: {
    fontSize: "18px",
    fontWeight: "700",
    color: "#111827",
    marginBottom: "24px",
    paddingLeft: "8px",
    fontFamily: "'Inter', sans-serif",
  },
  buttonGroup: {
    width: "100%",
    marginBottom: "16px",
  },
  groupLabel: {
    fontSize: "12px",
    fontWeight: "600",
    color: "#6b7280",
    textTransform: "uppercase",
    letterSpacing: "0.05em",
    marginBottom: "8px",
    paddingLeft: "8px",
  },
  button: {
    backgroundColor: "#ffffff",
    color: "#374151",
    marginBottom: "6px",
    width: "100%",
    height: "48px",
    minWidth: "auto",
    borderRadius: "10px",
    display: "flex",
    justifyContent: "flex-start",
    alignItems: "center",
    padding: "12px 16px",
    fontSize: "14px",
    fontWeight: "500",
    border: "1px solid #e5e7eb",
    textTransform: "none",
    transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
    "&:hover": {
      backgroundColor: "#f9fafb",
      borderColor: "#d1d5db",
      transform: "translateY(-1px)",
      boxShadow: "0 4px 12px rgba(0, 0, 0, 0.08)",
    },
    "&:active": {
      transform: "translateY(0px)",
      boxShadow: "0 2px 4px rgba(0, 0, 0, 0.06)",
    },
  },
  buttonCollapsed: {
    justifyContent: "center",
    padding: "12px",
  },
  buttonIcon: {
    marginRight: "12px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: "24px",
    height: "24px",
  },
  buttonIconCollapsed: {
    marginRight: 0,
  },
  saveButton: {
    backgroundColor: (props) => `${props.primaryColor} !important`,
    color: "#ffffff !important",
    borderRadius: "10px",
    padding: "12px 24px",
    fontSize: "14px",
    fontWeight: "600",
    textTransform: "none",
    boxShadow: (props) => `0 4px 12px ${props.primaryColor}40`,
    border: "none",
    transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
    "&:hover": {
      backgroundColor: (props) => `${props.primaryColor} !important`,
      filter: "brightness(90%)",
      transform: "translateY(-1px)",
      boxShadow: (props) => `0 6px 16px ${props.primaryColor}50`,
    },
    "&:active": {
      transform: "translateY(0px)",
      boxShadow: (props) => `0 2px 8px ${props.primaryColor}40`,
    },
  },

  headerNotice: {
    backgroundColor: "#f0f9ff",
    border: "1px solid #bfdbfe",
    borderRadius: "8px",
    padding: "12px 16px",
    marginBottom: "20px",
    color: "#1e40af",
    fontSize: "14px",
    fontWeight: "500",
    textAlign: "center",
    position: "relative",
    zIndex: 10,
  },
  flowContainer: {
    width: "100%",
    height: "90%",
    position: "relative",
    display: "flex",
    borderRadius: "0 12px 12px 0",
    overflow: "hidden",
  },
  animatedEdge: {
    animation: "$dash 1.5s linear infinite",
  },
  "@keyframes dash": {
    from: {
      strokeDashoffset: 24,
    },
    to: {
      strokeDashoffset: 0,
    },
  },
  loadingContainer: {
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    alignItems: "center",
    height: "70vh",
    gap: "16px",
  },
  loadingText: {
    color: "#6b7280",
    fontSize: "16px",
    fontWeight: "500",
  },
}));

function geraStringAleatoria(tamanho) {
  var stringAleatoria = "";
  var caracteres =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  for (var i = 0; i < tamanho; i++) {
    stringAleatoria += caracteres.charAt(
      Math.floor(Math.random() * caracteres.length)
    );
  }
  return stringAleatoria;
}

const nodeTypes = {
  message: messageNode,
  start: startNode,
  menu: menuNode,
  interval: intervalNode,
  img: imgNode,
  audio: audioNode,
  randomizer: randomizerNode,
  video: videoNode,
  singleBlock: singleBlockNode,
  ticket: ticketNode,
  typebot: typebotNode,
  openai: openaiNode,
  question: questionNode,
  file: fileNode,
};

const edgeTypes = {
  buttonedge: RemoveEdge,
};

const initialNodes = [
  {
    id: "1",
    position: { x: 250, y: 100 },
    data: { label: "Inicio do fluxo" },
    type: "start",
  },
];

const initialEdges = [];

export const FlowBuilderConfig = () => {
  const history = useHistory();
  const { id } = useParams();
  const storageItems = useNodeStorage();
  const { user } = useContext(AuthContext);

  // ✅ 1) Obtenção da cor diretamente do tema do Material UI
  const theme = useTheme();
  const primaryColor = theme.palette.primary.main;

  // ✅ 2) STATE DO SIDEBAR
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    const saved = localStorage.getItem("flowbuilder_sidebar_collapsed");
    return saved === "1";
  });

  useEffect(() => {
    localStorage.setItem(
      "flowbuilder_sidebar_collapsed",
      sidebarCollapsed ? "1" : "0"
    );
  }, [sidebarCollapsed]);

  // ✅ 3) Passe o primaryColor para o useStyles como props
  const classes = useStyles({ primaryColor });

  const [loading, setLoading] = useState(false);
  const [pageNumber, setPageNumber] = useState(1);
  const [dataNode, setDataNode] = useState(null);
  const [hasMore, setHasMore] = useState(false);
  const [modalAddText, setModalAddText] = useState(null);
  const [modalAddInterval, setModalAddInterval] = useState(false);
  const [modalAddMenu, setModalAddMenu] = useState(null);
  const [modalAddImg, setModalAddImg] = useState(null);
  const [modalAddAudio, setModalAddAudio] = useState(null);
  const [modalAddRandomizer, setModalAddRandomizer] = useState(null);
  const [modalAddVideo, setModalAddVideo] = useState(null);
  const [modalAddSingleBlock, setModalAddSingleBlock] = useState(null);
  const [modalAddTicket, setModalAddTicket] = useState(null);
  const [modalAddTypebot, setModalAddTypebot] = useState(null);
  const [modalAddOpenAI, setModalAddOpenAI] = useState(null);
  const [modalAddQuestion, setModalAddQuestion] = useState(null);
  const [modalAddFile, setModalAddFile] = useState(null);

  const connectionLineStyle = {
    stroke: primaryColor,
    strokeWidth: "3px",
    strokeDasharray: "5,5",
  };

  const addNode = (type, data) => {
    const posY = nodes[nodes.length - 1].position.y;
    const posX =
      nodes[nodes.length - 1].position.x + nodes[nodes.length - 1].width + 40;

    if (type === "file") {
      return setNodes((old) => {
        return [
          ...old,
          {
            id: geraStringAleatoria(30),
            position: { x: posX, y: posY },
            data: {
              label: data.label || "Enviar Arquivo",
              url: data.url,
            },
            type: "file",
          },
        ];
      });
    }

    if (type === "start") {
      return setNodes((old) => {
        return [
          {
            id: "1",
            position: { x: posX, y: posY },
            data: { label: "Inicio do fluxo" },
            type: "start",
          },
        ];
      });
    }
    if (type === "text") {
      return setNodes((old) => {
        return [
          ...old,
          {
            id: geraStringAleatoria(30),
            position: { x: posX, y: posY },
            data: { label: data.text },
            type: "message",
          },
        ];
      });
    }
    if (type === "interval") {
      return setNodes((old) => {
        return [
          ...old,
          {
            id: geraStringAleatoria(30),
            position: { x: posX, y: posY },
            data: { label: `Intervalo ${data.sec} seg.`, sec: data.sec },
            type: "interval",
          },
        ];
      });
    }
    if (type === "condition") {
      return setNodes((old) => {
        return [
          ...old,
          {
            id: geraStringAleatoria(30),
            position: { x: posX, y: posY },
            data: {
              key: data.key,
              condition: data.condition,
              value: data.value,
            },
            type: "condition",
          },
        ];
      });
    }
    if (type === "menu") {
      return setNodes((old) => {
        return [
          ...old,
          {
            id: geraStringAleatoria(30),
            position: { x: posX, y: posY },
            data: {
              message: data.message,
              arrayOption: data.arrayOption,
            },
            type: "menu",
          },
        ];
      });
    }
    if (type === "img") {
      return setNodes((old) => {
        return [
          ...old,
          {
            id: geraStringAleatoria(30),
            position: { x: posX, y: posY },
            data: { url: data.url },
            type: "img",
          },
        ];
      });
    }
    if (type === "audio") {
      return setNodes((old) => {
        return [
          ...old,
          {
            id: geraStringAleatoria(30),
            position: { x: posX, y: posY },
            data: { url: data.url, record: data.record },
            type: "audio",
          },
        ];
      });
    }
    if (type === "randomizer") {
      return setNodes((old) => {
        return [
          ...old,
          {
            id: geraStringAleatoria(30),
            position: { x: posX, y: posY },
            data: { percent: data.percent },
            type: "randomizer",
          },
        ];
      });
    }
    if (type === "video") {
      return setNodes((old) => {
        return [
          ...old,
          {
            id: geraStringAleatoria(30),
            position: { x: posX, y: posY },
            data: { url: data.url },
            type: "video",
          },
        ];
      });
    }
    if (type === "singleBlock") {
      return setNodes((old) => {
        return [
          ...old,
          {
            id: geraStringAleatoria(30),
            position: { x: posX, y: posY },
            data: { ...data },
            type: "singleBlock",
          },
        ];
      });
    }
    if (type === "ticket") {
      return setNodes((old) => {
        return [
          ...old,
          {
            id: geraStringAleatoria(30),
            position: { x: posX, y: posY },
            data: { ...data },
            type: "ticket",
          },
        ];
      });
    }
    if (type === "typebot") {
      return setNodes((old) => {
        return [
          ...old,
          {
            id: geraStringAleatoria(30),
            position: { x: posX, y: posY },
            data: { ...data },
            type: "typebot",
          },
        ];
      });
    }
    if (type === "openai") {
      return setNodes((old) => {
        return [
          ...old,
          {
            id: geraStringAleatoria(30),
            position: { x: posX, y: posY },
            data: { ...data },
            type: "openai",
          },
        ];
      });
    }
    if (type === "question") {
      return setNodes((old) => {
        return [
          ...old,
          {
            id: geraStringAleatoria(30),
            position: { x: posX, y: posY },
            data: { ...data },
            type: "question",
          },
        ];
      });
    }
  };

  const textAdd = (data) => {
    addNode("text", data);
  };
  const intervalAdd = (data) => {
    addNode("interval", data);
  };
  const conditionAdd = (data) => {
    addNode("condition", data);
  };
  const menuAdd = (data) => {
    addNode("menu", data);
  };
  const imgAdd = (data) => {
    addNode("img", data);
  };
  const audioAdd = (data) => {
    addNode("audio", data);
  };
  const randomizerAdd = (data) => {
    addNode("randomizer", data);
  };
  const videoAdd = (data) => {
    addNode("video", data);
  };
  const singleBlockAdd = (data) => {
    addNode("singleBlock", data);
  };
  const ticketAdd = (data) => {
    addNode("ticket", data);
  };
  const typebotAdd = (data) => {
    addNode("typebot", data);
  };
  const openaiAdd = (data) => {
    addNode("openai", data);
  };
  const questionAdd = (data) => {
    addNode("question", data);
  };
  const fileAdd = (data) => {
    addNode("file", data);
  };

  useEffect(() => {
    setLoading(true);
    const delayDebounceFn = setTimeout(() => {
      const fetchContacts = async () => {
        try {
          const { data } = await api.get(`/flowbuilder/flow/${id}`);

          if (data.flow.flow !== null) {
            const flowNodes = data.flow.flow.nodes;
            setNodes(flowNodes);
            const loadedEdges = (data.flow.flow.connections || []).map((e) => ({
              ...e,
              type: "buttonedge",
            }));

            setEdges(loadedEdges);

            const filterVariables = flowNodes.filter(
              (nd) => nd.type === "question"
            );
            const variables = filterVariables.map(
              (variable) => variable.data.typebotIntegration.answerKey
            );
            localStorage.setItem("variables", JSON.stringify(variables));
          }
          setLoading(false);
        } catch (err) {
          setLoading(false);
          toastError(err);
        }
      };
      fetchContacts();
    }, 500);
    return () => clearTimeout(delayDebounceFn);
  }, [id]);

  useEffect(() => {
    if (storageItems.action === "delete") {
      setNodes((old) => old.filter((item) => item.id !== storageItems.node));
      setEdges((old) => {
        const newData = old.filter((item) => item.source !== storageItems.node);
        const newClearTarget = newData.filter(
          (item) => item.target !== storageItems.node
        );
        return newClearTarget;
      });
      storageItems.setNodesStorage("");
      storageItems.setAct("idle");
    }
    if (storageItems.action === "duplicate") {
      const nodeDuplicate = nodes.filter(
        (item) => item.id === storageItems.node
      )[0];
      const maioresX = nodes.map((node) => node.position.x);
      const maiorX = Math.max(...maioresX);
      const finalY = nodes[nodes.length - 1].position.y;
      const nodeNew = {
        ...nodeDuplicate,
        id: geraStringAleatoria(30),
        position: {
          x: maiorX + 240,
          y: finalY,
        },
        selected: false,
        style: { backgroundColor: "#555555", padding: 0, borderRadius: 8 },
      };
      setNodes((old) => [...old, nodeNew]);
      storageItems.setNodesStorage("");
      storageItems.setAct("idle");
    }
  }, [storageItems.action]);

  const loadMore = () => {
    setPageNumber((prevState) => prevState + 1);
  };

  const handleScroll = (e) => {
    if (!hasMore || loading) return;
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    if (scrollHeight - (scrollTop + 100) < clientHeight) {
      loadMore();
    }
  };

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  const onConnect = useCallback(
    (params) =>
      setEdges((eds) =>
        addEdge(
          {
            ...params,
            type: "buttonedge",
          },
          eds
        )
      ),
    [setEdges]
  );

  const saveFlow = async () => {
    await api
      .post("/flowbuilder/flow", {
        idFlow: id,
        nodes: nodes,
        connections: edges,
      })
      .then((res) => {
        toast.success("Fluxo salvo com sucesso");
      });
  };

  const doubleClick = (event, node) => {
    setDataNode(node);
    if (node.type === "message") {
      setModalAddText("edit");
    }
    if (node.type === "interval") {
      setModalAddInterval("edit");
    }
    if (node.type === "menu") {
      setModalAddMenu("edit");
    }
    if (node.type === "img") {
      setModalAddImg("edit");
    }
    if (node.type === "audio") {
      setModalAddAudio("edit");
    }
    if (node.type === "randomizer") {
      setModalAddRandomizer("edit");
    }
    if (node.type === "singleBlock") {
      setModalAddSingleBlock("edit");
    }
    if (node.type === "ticket") {
      setModalAddTicket("edit");
    }
    if (node.type === "typebot") {
      setModalAddTypebot("edit");
    }
    if (node.type === "openai") {
      setModalAddOpenAI("edit");
    }
    if (node.type === "question") {
      setModalAddQuestion("edit");
    }
    if (node.type === "file") {
      setModalAddFile("edit");
    }
  };

  const clickNode = (event, node) => {
    setNodes((old) =>
      old.map((item) => {
        if (item.id === node.id) {
          return {
            ...item,
            style: {
              backgroundColor: primaryColor,
              padding: 1,
              borderRadius: 8,
              pointerEvents: "auto",
            },
          };
        }
        return {
          ...item,
          style: {
            backgroundColor: "#ffffff",
            padding: 0,
            borderRadius: 8,
            pointerEvents: "auto",
          },
        };
      })
    );
  };

  const clickEdge = (event, node) => {
    setNodes((old) =>
      old.map((item) => {
        return {
          ...item,
          style: {
            backgroundColor: "#ffffff",
            padding: 0,
            borderRadius: 8,
            pointerEvents: "auto",
          },
        };
      })
    );
  };

  const updateNode = (dataAlter) => {
    setNodes((old) =>
      old.map((itemNode) => {
        if (itemNode.id === dataAlter.id) {
          return dataAlter;
        }
        return itemNode;
      })
    );
    setModalAddText(null);
    setModalAddInterval(null);
    setModalAddMenu(null);
    setModalAddOpenAI(null);
    setModalAddTypebot(null);
    setModalAddFile(null);
  };

  const actionGroups = [
    {
      label: "Essenciais",
      actions: [
        {
          icon: <RocketLaunch sx={{ color: "#10b981" }} />,
          name: "Início",
          type: "start",
        },
        {
          icon: <LibraryBooks sx={{ color: primaryColor }} />,
          name: "Conteúdo",
          type: "content",
        },
        {
          icon: <DynamicFeed sx={{ color: "#8b5cf6" }} />,
          name: "Menu",
          type: "menu",
        },
      ],
    },
    {
      label: "Interações",
      actions: [
        {
          icon: <BallotIcon sx={{ color: "#f59e0b" }} />,
          name: "Pergunta",
          type: "question",
        },
        {
          icon: <ConfirmationNumber sx={{ color: "#ef4444" }} />,
          name: "Ticket",
          type: "ticket",
        },
        {
          icon: <CallSplit sx={{ color: "#06b6d4" }} />,
          name: "Randomizador",
          type: "random",
        },
        {
          icon: <AccessTime sx={{ color: "#f97316" }} />,
          name: "Intervalo",
          type: "interval",
        },
      ],
    },
    {
      label: "Integrações",
      actions: [
        {
          icon: (
            <Box
              component="img"
              sx={{ width: 20, height: 20 }}
              src={typebotIcon}
              alt="typebot"
            />
          ),
          name: "TypeBot",
          type: "typebot",
        },
        {
          icon: <SiOpenai size={20} color="#10b981" />,
          name: "OpenAI/Gemini",
          type: "openai",
        },
      ],
    },
  ];

  const clickActions = (type) => {
    switch (type) {
      case "start":
        addNode("start");
        break;
      case "menu":
        setModalAddMenu("create");
        break;
      case "content":
        setModalAddSingleBlock("create");
        break;
      case "random":
        setModalAddRandomizer("create");
        break;
      case "interval":
        setModalAddInterval("create");
        break;
      case "ticket":
        setModalAddTicket("create");
        break;
      case "typebot":
        setModalAddTypebot("create");
        break;
      case "openai":
        setModalAddOpenAI("create");
        break;
      case "question":
        setModalAddQuestion("create");
        break;
      case "file":
        setModalAddFile("create");
        break;
      default:
        break;
    }
  };

  return (
    <Stack sx={{ height: "100vh", backgroundColor: "#ffffff" }}>
      <FlowBuilderAddTextModal
        open={modalAddText}
        onSave={textAdd}
        data={dataNode}
        onUpdate={updateNode}
        close={() => setModalAddText(null)}
      />
      <FlowBuilderIntervalModal
        open={modalAddInterval}
        onSave={intervalAdd}
        data={dataNode}
        onUpdate={updateNode}
        close={() => setModalAddInterval(null)}
      />
      <FlowBuilderMenuModal
        open={modalAddMenu}
        onSave={menuAdd}
        data={dataNode}
        onUpdate={updateNode}
        close={() => setModalAddMenu(null)}
      />
      <FlowBuilderAddImgModal
        open={modalAddImg}
        onSave={imgAdd}
        data={dataNode}
        onUpdate={updateNode}
        close={() => setModalAddImg(null)}
      />
      <FlowBuilderAddAudioModal
        open={modalAddAudio}
        onSave={audioAdd}
        data={dataNode}
        onUpdate={updateNode}
        close={() => setModalAddAudio(null)}
      />
      <FlowBuilderRandomizerModal
        open={modalAddRandomizer}
        onSave={randomizerAdd}
        data={dataNode}
        onUpdate={updateNode}
        close={() => setModalAddRandomizer(null)}
      />
      <FlowBuilderAddVideoModal
        open={modalAddVideo}
        onSave={videoAdd}
        data={dataNode}
        onUpdate={updateNode}
        close={() => setModalAddVideo(null)}
      />
      <FlowBuilderSingleBlockModal
        open={modalAddSingleBlock}
        onSave={singleBlockAdd}
        data={dataNode}
        onUpdate={updateNode}
        close={() => setModalAddSingleBlock(null)}
      />
      <FlowBuilderTicketModal
        open={modalAddTicket}
        onSave={ticketAdd}
        data={dataNode}
        onUpdate={updateNode}
        close={() => setModalAddTicket(null)}
      />
      <FlowBuilderOpenAIModal
        open={modalAddOpenAI}
        onSave={openaiAdd}
        data={dataNode}
        onUpdate={updateNode}
        close={() => setModalAddOpenAI(null)}
      />
      <FlowBuilderTypebotModal
        open={modalAddTypebot}
        onSave={typebotAdd}
        data={dataNode}
        onUpdate={updateNode}
        close={() => setModalAddTypebot(null)}
      />
      <FlowBuilderAddQuestionModal
        open={modalAddQuestion}
        onSave={questionAdd}
        data={dataNode}
        onUpdate={updateNode}
        close={() => setModalAddQuestion(null)}
      />
      <FlowBuilderAddFileModal
        open={modalAddFile}
        onSave={fileAdd}
        data={dataNode}
        onUpdate={updateNode}
        close={() => setModalAddFile(null)}
      />

      <MainHeader>
        <Title>Construtor de Fluxo</Title>
      </MainHeader>

      {!loading && (
        <Paper
          className={classes.mainPaper}
          variant="outlined"
          onScroll={handleScroll}
        >
          <Stack
            className={`${classes.sidebar} ${sidebarCollapsed ? classes.sidebarCollapsed : ""
              }`}
            style={{
              width: sidebarCollapsed ? "64px" : "280px",
            }}
          >
            {/* Botão de recolher/expandir */}
            <Button
              onClick={() => setSidebarCollapsed(prev => !prev)}
              size="small"
              style={{
                alignSelf: sidebarCollapsed ? "center" : "flex-end",
                minWidth: "auto",
                marginBottom: "12px",
              }}
            >
              {sidebarCollapsed ? "»" : "«"}
            </Button>

            {/* Título "Componentes" */}
            {!sidebarCollapsed && (
              <Typography className={classes.sidebarTitle}>
                Componentes
              </Typography>
            )}

            {actionGroups.map((group) => (
              <div key={group.label} className={classes.buttonGroup}>
                {/* Label do grupo */}
                {!sidebarCollapsed && (
                  <Typography className={classes.groupLabel}>
                    {group.label}
                  </Typography>
                )}
                {group.actions.map((action) => (
                  <Button
                    key={action.name}
                    className={`${classes.button} ${sidebarCollapsed ? classes.buttonCollapsed : ""
                      }`}
                    onClick={() => clickActions(action.type)}
                    title={action.name}
                  >
                    <Box
                      className={
                        sidebarCollapsed
                          ? classes.buttonIconCollapsed
                          : classes.buttonIcon
                      }
                    >
                      {action.icon}
                    </Box>

                    {!sidebarCollapsed && (
                      <Typography variant="body2" sx={{ fontWeight: 500 }}>
                        {action.name}
                      </Typography>
                    )}
                  </Button>
                ))}
              </div>
            ))}
          </Stack>

          <Stack
            sx={{
              paddingLeft: sidebarCollapsed ? "84px" : "300px",
              paddingRight: "20px",
              paddingTop: "20px",
            }}
          >
            <div className={classes.headerNotice}>
              ⚠️ Lembre-se de salvar seu fluxo regularmente para não perder suas
              alterações!
            </div>
          </Stack>

          <Stack
            direction="row"
            justifyContent="end"
            spacing={1}
            sx={{
              position: "absolute",
              top: "20px",
              right: "20px",
              zIndex: 10,
            }}
          >
            {/* ✅ 4) Aplicação do className e style inline forçado para garantir a cor whitelabel */}
            <Button
              className={classes.saveButton}
              startIcon={<SaveIcon />}
              onClick={() => saveFlow()}
              variant="contained"
              disableElevation
              style={{
                backgroundColor: primaryColor,
                color: "#ffffff",
              }}
            >
              Salvar Fluxo
            </Button>
          </Stack>

          <Stack
            className={classes.flowContainer}
            sx={{ paddingLeft: sidebarCollapsed ? "64px" : "280px" }}
          >
            <ReactFlow
              nodes={nodes}
              edges={edges}
              deleteKeyCode={["Backspace", "Delete"]}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onNodeDoubleClick={doubleClick}
              onNodeClick={clickNode}
              onEdgeClick={clickEdge}
              onConnect={onConnect}
              nodeTypes={nodeTypes}
              edgeTypes={edgeTypes}
              fitView
              connectionLineStyle={connectionLineStyle}
              style={{
                backgroundColor: "#ffffff",
              }}
              defaultEdgeOptions={{
                style: {
                  stroke: primaryColor,
                  strokeWidth: "3px",
                },
                animated: true,
                className: classes.animatedEdge,
              }}
              nodesDraggable={true}
              nodesConnectable={true}
              elementsSelectable={true}
              selectNodesOnDrag={false}
              panOnDrag={true}
              zoomOnScroll={true}
              zoomOnDoubleClick={false}
              onlyRenderVisibleElements={false}
            >
              <Controls
                style={{
                  backgroundColor: "#ffffff",
                  border: "1px solid #e5e7eb",
                  borderRadius: "8px",
                  boxShadow: "0 4px 12px rgba(0, 0, 0, 0.08)",
                }}
              />
              <MiniMap
                style={{
                  backgroundColor: "#ffffff",
                  border: "1px solid #e5e7eb",
                  borderRadius: "8px",
                  boxShadow: "0 4px 12px rgba(0, 0, 0, 0.08)",
                }}
                maskColor="rgba(59, 130, 246, 0.1)"
                nodeColor={primaryColor}
              />
              <Background
                variant="dots"
                gap={18}
                size={1.2}
                color="#d1d5db"
              />
            </ReactFlow>
          </Stack>
        </Paper>
      )}

      {loading && (
        <Stack className={classes.loadingContainer}>
          <CircularProgress size={48} style={{ color: primaryColor }} />
          <Typography className={classes.loadingText}>
            Carregando construtor de fluxo...
          </Typography>
        </Stack>
      )}
    </Stack>
  );
};