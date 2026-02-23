import React, { useState, useEffect, useRef } from "react";
import { toast } from "react-toastify";
import { makeStyles } from "@material-ui/core/styles";
import { green } from "@material-ui/core/colors";
import {
  Button,
  TextField,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  CircularProgress,
  Box,
  Divider
} from "@material-ui/core";
import {
  AccessTime,
  Delete,
  Image,
  Message,
  MicNone,
  Videocam,
  Description,
  DragIndicator,
} from "@mui/icons-material";
import { Stack, Typography, Checkbox } from "@mui/material";
import Compressor from "compressorjs";
import api from "../../services/api";
import { i18n } from "../../translate/i18n";
import toastError from "../../errors/toastError";

const useStyles = makeStyles((theme) => ({
  btnAction: {
    textTransform: "none",
    fontSize: "12px",
    padding: "4px 8px",
    minWidth: "auto",
  },
  sortableItem: {
    display: "flex",
    alignItems: "flex-start",
    gap: "8px",
    marginBottom: "12px",
  },
  dragHandle: {
    cursor: "grab",
    paddingTop: "10px",
    opacity: 0.7,
    userSelect: "none",
  },
  itemContent: {
    flex: 1,
  },
  btnWrapper: {
    position: "relative",
  },
  buttonProgress: {
    color: green[500],
    position: "absolute",
    top: "50%",
    left: "50%",
    marginTop: -12,
    marginLeft: -12,
  },
}));

const FlowBuilderSingleBlockModal = ({ open, onSave, onUpdate, data, close }) => {
  const classes = useStyles();
  const [activeModal, setActiveModal] = useState(false);
  const [medias, setMedias] = useState([]); // [{file, id(seqId), type, number}]
  const [elementsSeq, setElementsSeq] = useState([]);
  const [elementsSeqEdit, setElementsSeqEdit] = useState([]);
  const [elementsEdit, setElementsEdit] = useState([]);
  const [loading, setLoading] = useState(false);
  const [variables, setVariables] = useState([]);

  const [counts, setCounts] = useState({
    message: 0,
    interval: 0,
    img: 0,
    audio: 0,
    video: 0,
    document: 0
  });

  const [previewImg, setPreviewImg] = useState([]);
  const [previewAudios, setPreviewAudios] = useState([]);
  const [previewVideos, setPreviewVideos] = useState([]);
  const [previewDocuments, setPreviewDocuments] = useState([]);

  const [labels, setLabels] = useState({
    title: "Adicionar conteúdo ao fluxo",
    btn: "Adicionar",
  });

  const dragItem = useRef();
  const dragOverItem = useRef();

  useEffect(() => {
    const localVariables = localStorage.getItem("variables");
    if (localVariables) setVariables(JSON.parse(localVariables));

    if (open === "edit" && data) {
      setLabels({ title: "Editar conteúdo", btn: "Salvar" });
      setElementsSeq(data.data.seq || []);
      setElementsSeqEdit(data.data.seq || []);
      setElementsEdit(data.data.elements || []);

      const newCounts = { message: 0, interval: 0, img: 0, audio: 0, video: 0, document: 0 };
      (data.data.seq || []).forEach(s => {
        const type = s.replace(/[0-9]/g, '');
        const num = parseInt(s.replace(type, ''), 10);
        if (!Number.isNaN(num) && newCounts[type] !== undefined) {
          if (num >= newCounts[type]) newCounts[type] = num + 1;
        }
      });
      setCounts(newCounts);
    }

    if (open === "create") {
      setLabels({ title: "Adicionar conteúdo ao fluxo", btn: "Adicionar" });
    }

    setActiveModal(!!open);
  }, [open, data]);

  const deleteElement = (seqId) => {
    setElementsSeq(old => old.filter(item => item !== seqId));
    setElementsSeqEdit(old => old.filter(item => item !== seqId));

    const type = seqId.replace(/[0-9]/g, '');
    const id = parseInt(seqId.replace(type, ''), 10);

    // remove preview
    if (type === "img") setPreviewImg(old => old.filter(item => item.number !== id));
    if (type === "audio") setPreviewAudios(old => old.filter(item => item.number !== id));
    if (type === "video") setPreviewVideos(old => old.filter(item => item.number !== id));
    if (type === "document") setPreviewDocuments(old => old.filter(item => item.number !== id));

    // remove media selecionada (se existia)
    setMedias(old => old.filter(m => m.id !== seqId));

    toast.success("Bloco removido!");
  };

  const handleFileChange = (e, id, type) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];

    const maxSizes = {
      img: 2000000,
      audio: 5000000,
      video: 20000000,
      document: 15000000
    };

    if (file.size > maxSizes[type]) {
      toast.error(`Arquivo é muito grande! ${maxSizes[type] / 1000000}MB máximo`);
      return;
    }

    const seqId = `${type}${id}`;

    // remove anterior do mesmo bloco
    setMedias(old => old.filter(m => m.id !== seqId));

    setMedias(old => [...old, { file, id: seqId, type, number: id }]);

    const blob = URL.createObjectURL(file);

    if (type === "img") {
      setPreviewImg(old => [...old.filter(p => p.number !== id), { number: id, url: blob, name: file.name }]);
    }
    if (type === "audio") {
      setPreviewAudios(old => [...old.filter(p => p.number !== id), { number: id, url: blob, name: file.name }]);
    }
    if (type === "video") {
      setPreviewVideos(old => [...old.filter(p => p.number !== id), { number: id, url: blob, name: file.name }]);
    }
    if (type === "document") {
      setPreviewDocuments(old => [...old.filter(p => p.number !== id), { number: id, name: file.name }]);
    }

    // marcou como “alterado”, então não é mais “edit antigo”
    setElementsSeqEdit(old => old.filter(item => item !== seqId));

    toast.success(`Arquivo ${file.name} selecionado!`);
  };

  const renderLayout = (seqId) => {
    const type = seqId.replace(/[0-9]/g, '');
    const id = parseInt(seqId.replace(type, ''), 10);

    const itemEdit = elementsEdit.find(e => e.number === seqId);
    const defaultValue = itemEdit ? itemEdit.value : "";
    const recordDefault = itemEdit ? (itemEdit.record ? "" : "ok") : "";

    const containerStyle = {
      border: "1px solid #0000FF",
      borderRadius: "7px",
      padding: "6px",
      position: "relative",
      minHeight: "120px"
    };

    const deleteBtn = (
      <IconButton
        size="small"
        onClick={() => deleteElement(seqId)}
        style={{ position: "absolute", top: "6px", right: "6px", zIndex: 10 }}
      >
        <Delete fontSize="small" />
      </IconButton>
    );

    const getPreview = () => {
      if (type === "img") return previewImg.find(p => p.number === id)?.url || null;
      if (type === "audio") return previewAudios.find(p => p.number === id)?.url || null;
      if (type === "video") return previewVideos.find(p => p.number === id)?.url || null;
      if (type === "document") return previewDocuments.find(p => p.number === id)?.name || null;
      return null;
    };

    const preview = getPreview();
    const hasEditValue = !!(defaultValue && defaultValue.length > 0);

    switch (type) {
      case "message":
        return (
          <Stack sx={containerStyle}>
            {deleteBtn}
            <Typography variant="caption" align="center">Texto</Typography>
            <TextField
              fullWidth
              multiline
              rows={4}
              variant="outlined"
              margin="dense"
              className={seqId}
              defaultValue={defaultValue}
            />
          </Stack>
        );

      case "interval":
        return (
          <Stack sx={containerStyle}>
            {deleteBtn}
            <Typography variant="caption" align="center">Intervalo (Segundos)</Typography>
            <TextField
              fullWidth
              type="number"
              variant="outlined"
              margin="dense"
              className={seqId}
              defaultValue={defaultValue || 1}
              InputProps={{ inputProps: { min: 0, max: 120 } }}
            />
          </Stack>
        );

      case "img":
        return (
          <Stack sx={containerStyle}>
            {deleteBtn}
            <Typography variant="caption" align="center">Imagem</Typography>
            <Stack alignItems="center" my={1}>
              <img
                className={`img${id}`}
                style={{
                  maxWidth: "100%",
                  height: "100px",
                  objectFit: "contain",
                  border: "1px solid #ddd",
                  borderRadius: "4px"
                }}
                src={preview || (hasEditValue ? `${process.env.REACT_APP_BACKEND_URL}/public/${defaultValue}` : "")}
                alt="Pré-visualização"
                draggable={false}
              />
            </Stack>
            <Button variant="contained" component="label" size="small" fullWidth className={`btnImg${id}`}>
              {preview || hasEditValue ? "Alterar Imagem" : "Enviar Imagem"}
              <input
                type="file"
                hidden
                accept="image/png, image/jpg, image/jpeg"
                onChange={(e) => handleFileChange(e, id, "img")}
              />
            </Button>
          </Stack>
        );

      case "audio":
        return (
          <Stack sx={containerStyle}>
            {deleteBtn}
            <Typography variant="caption" align="center">Audio</Typography>
            <div className={`audio${id}`} style={{ display: "flex", justifyContent: "center", margin: "8px 0" }}>
              {(preview || hasEditValue) && (
                <audio controls style={{ width: "100%" }} draggable={false}>
                  <source src={preview || `${process.env.REACT_APP_BACKEND_URL}/public/${defaultValue}`} />
                  seu navegador não suporta HTML5
                </audio>
              )}
            </div>
            <Button variant="contained" component="label" size="small" fullWidth className={`btnAudio${id}`}>
              {preview || hasEditValue ? "Alterar Audio" : "Enviar Audio"}
              <input
                type="file"
                hidden
                accept="audio/ogg, audio/mp3, audio/opus, audio/mpeg"
                onChange={(e) => handleFileChange(e, id, "audio")}
              />
            </Button>
            <Stack direction="row" alignItems="center" justifyContent="center" spacing={1} mt={1}>
              <Checkbox
                className={`checkaudio${id}`}
                defaultChecked={recordDefault === "ok" ? false : true}
                size="small"
              />
              <Typography variant="caption">Enviar como audio gravado na hora</Typography>
            </Stack>
          </Stack>
        );

      case "video":
        return (
          <Stack sx={containerStyle}>
            {deleteBtn}
            <Typography variant="caption" align="center">Video</Typography>
            <div className={`video${id}`} style={{ display: "flex", justifyContent: "center", margin: "8px 0" }}>
              {(preview || hasEditValue) && (
                <video controls style={{ width: "100%", maxHeight: "200px" }} draggable={false}>
                  <source src={preview || `${process.env.REACT_APP_BACKEND_URL}/public/${defaultValue}`} />
                  seu navegador não suporta HTML5
                </video>
              )}
            </div>
            <Button variant="contained" component="label" size="small" fullWidth className={`btnVideo${id}`}>
              {preview || hasEditValue ? "Alterar Video" : "Enviar Video"}
              <input
                type="file"
                hidden
                accept="video/mp4, video/avi"
                onChange={(e) => handleFileChange(e, id, "video")}
              />
            </Button>
          </Stack>
        );

      case "document":
        return (
          <Stack sx={containerStyle}>
            {deleteBtn}
            <Typography variant="caption" align="center">Documento</Typography>
            <Stack direction="row" justifyContent="center" alignItems="center" spacing={1} my={2}>
              <Description />
              <Typography variant="body2" className={`document${id}`}>
                {preview || (hasEditValue ? (itemEdit?.original || defaultValue) : "Nenhum arquivo selecionado")}
              </Typography>
            </Stack>
            <Button variant="contained" component="label" size="small" fullWidth className={`btnDocument${id}`}>
              {preview || hasEditValue ? "Alterar Documento" : "Enviar Documento"}
              <input
                type="file"
                hidden
                accept=".pdf,.doc,.docx,.xls,.xlsx,.txt,.csv"
                onChange={(e) => handleFileChange(e, id, "document")}
              />
            </Button>
          </Stack>
        );

      default:
        return null;
    }
  };

  const addElement = (type) => {
    const newId = `${type}${counts[type]}`;
    setElementsSeq(old => [...old, newId]);
    setCounts(old => ({ ...old, [type]: old[type] + 1 }));
  };

  // ✅ monta elements usando um MAP seqId -> filename retornado pelo backend
  const handleElements = (uploadedMap) => {
    let elementsSequence = [];

    const newArrMessage = elementsSeq.filter((item) => item.includes("message"));
    const newArrInterval = elementsSeq.filter((item) => item.includes("interval"));
    const newArrImg = elementsSeq.filter((item) => item.includes("img"));
    const newArrAudio = elementsSeq.filter((item) => item.includes("audio"));
    const newArrVideo = elementsSeq.filter((item) => item.includes("video"));
    const newArrDocument = elementsSeq.filter((item) => item.includes("document"));

    // message
    for (let i = 0; i < newArrMessage.length; i++) {
      const value = document
        .querySelector(`.${newArrMessage[i]}`)
        ?.querySelector(".MuiInputBase-input")?.value;

      if (!value) {
        toast.error("Campos de mensagem vazio!");
        throw new Error("Mensagem vazia");
      }
      elementsSequence.push({
        type: "message",
        value,
        number: newArrMessage[i],
      });
    }

    // interval
    for (let i = 0; i < newArrInterval.length; i++) {
      const value = document
        .querySelector(`.${newArrInterval[i]}`)
        ?.querySelector(".MuiInputBase-input")?.value;

      if (parseInt(value, 10) === 0 || parseInt(value, 10) > 120) {
        toast.error("Intervalo não pode ser 0 ou maior que 120!");
        throw new Error("Intervalo inválido");
      }
      elementsSequence.push({
        type: "interval",
        value,
        number: newArrInterval[i],
      });
    }

    // helpers
    const pushFromEditOrMap = (seqId, type) => {
      if (elementsSeqEdit.includes(seqId)) {
        const itemSelectedEdit = elementsEdit.find((item) => item.number === seqId);
        if (itemSelectedEdit) return itemSelectedEdit;
        return null;
      }

      const savedFileName = uploadedMap ? uploadedMap[seqId] : null;
      const mediaFile = medias.find(m => m.id === seqId);

      if (!savedFileName && !mediaFile) return null;

      if (!savedFileName) return null; // aqui é o ponto: sem nome retornado, não salva

      // para documentos: manter original visível, value é o nome salvo
      return {
        type,
        value: savedFileName,
        original: mediaFile?.file?.name || "",
        number: seqId,
      };
    };

    // img
    for (let i = 0; i < newArrImg.length; i++) {
      const item = pushFromEditOrMap(newArrImg[i], "img");
      if (item) elementsSequence.push(item);
    }

    // audio
    for (let i = 0; i < newArrAudio.length; i++) {
      const seqId = newArrAudio[i];

      if (elementsSeqEdit.includes(seqId)) {
        const itemSelectedEdit = elementsEdit.find((item) => item.number === seqId);
        if (itemSelectedEdit) {
          elementsSequence.push({
            type: "audio",
            value: itemSelectedEdit.value,
            original: itemSelectedEdit.original,
            number: itemSelectedEdit.number,
            record:
              document
                .querySelector(`.checkaudio${seqId.replace("audio", "")}`)
                ?.querySelector(".PrivateSwitchBase-input")?.checked || false,
          });
        }
      } else {
        const savedFileName = uploadedMap ? uploadedMap[seqId] : null;
        const mediaFile = medias.find(m => m.id === seqId);

        if (savedFileName) {
          elementsSequence.push({
            type: "audio",
            value: savedFileName,
            original: mediaFile?.file?.name || "",
            number: seqId,
            record:
              document
                .querySelector(`.checkaudio${seqId.replace("audio", "")}`)
                ?.querySelector(".PrivateSwitchBase-input")?.checked || false,
          });
        }
      }
    }

    // video
    for (let i = 0; i < newArrVideo.length; i++) {
      const item = pushFromEditOrMap(newArrVideo[i], "video");
      if (item) elementsSequence.push(item);
    }

    // document
    for (let i = 0; i < newArrDocument.length; i++) {
      const item = pushFromEditOrMap(newArrDocument[i], "document");
      if (item) elementsSequence.push(item);
    }

    return elementsSequence;
  };

  // ✅ valida se tem bloco de mídia sem arquivo (quando não é edit antigo)
  const verifyButtonsUpload = () => {
    const mediaSeq = elementsSeq.filter(seqId => {
      const t = seqId.replace(/[0-9]/g, "");
      return ["img", "audio", "video", "document"].includes(t);
    });

    for (const seqId of mediaSeq) {
      // se é “edit antigo”, tudo bem
      if (elementsSeqEdit.includes(seqId)) continue;

      // se não é antigo, precisa existir media selecionada
      const hasMedia = medias.some(m => m.id === seqId);
      if (!hasMedia) return true;
    }

    return false;
  };

  // ✅ compressor “await” para manter ordem do upload igual ao retorno
  const compressImage = (file) =>
    new Promise((resolve) => {
      new Compressor(file, {
        quality: 0.7,
        success(result) {
          resolve(result);
        },
        error() {
          resolve(file);
        },
      });
    });

  const handleSave = async () => {
    if (elementsSeq.length === 0) {
      toast.error("Adicione pelo menos um conteúdo!");
      return;
    }

    setLoading(true);

    // Se existir bloco de mídia novo sem arquivo selecionado
    if (verifyButtonsUpload()) {
      setLoading(false);
      toast.error("Existem arquivos pendentes. Envie todos os arquivos ou remova os blocos vazios.");
      return;
    }

    // ✅ monta a ordem determinística: na ordem dos blocos do modal
    const orderedUploads = elementsSeq
      .filter(seqId => {
        const t = seqId.replace(/[0-9]/g, "");
        return ["img", "audio", "video", "document"].includes(t);
      })
      .map(seqId => medias.find(m => m.id === seqId))
      .filter(Boolean);

    // Se não tem mídia (ou nenhuma mídia nova), salva só JSON
    if (orderedUploads.length === 0) {
      try {
        const mountData = { seq: elementsSeq, elements: handleElements(null) };
        if (open === "edit") {
          onUpdate({ ...data, data: mountData });
          toast.success("Conteúdo atualizado com sucesso!");
        } else {
          onSave({ ...mountData });
          toast.success("Conteúdo adicionado com sucesso!");
        }
        handleClose();
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
      return;
    }

    // ✅ envia em ordem e cria map seqId -> filename retornado
    const formData = new FormData();

    for (const media of orderedUploads) {
      if (media.type === "img") {
        const compressed = await compressImage(media.file);
        formData.append("medias", compressed, media.file.name);
        formData.append("body", media.file.name);
      } else {
        formData.append("medias", media.file, media.file.name);
        formData.append("body", media.file.name);
      }
    }

    try {
      const response = await api.post("/flowbuilder/content", formData);

      // Backend normalmente retorna array de filenames na ordem do upload
      const returned = Array.isArray(response.data) ? response.data : [];

      const uploadedMap = {};
      orderedUploads.forEach((m, idx) => {
        uploadedMap[m.id] = returned[idx];
      });

      const mountData = { seq: elementsSeq, elements: handleElements(uploadedMap) };

      if (open === "edit") {
        onUpdate({ ...data, data: mountData });
        toast.success("Conteúdo atualizado com sucesso!");
      } else {
        onSave({ ...mountData });
        toast.success("Conteúdo adicionado com sucesso!");
      }

      handleClose();
    } catch (error) {
      console.error("Erro ao salvar:", error);
      toastError(error);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = async () => {
    close(null);
    setActiveModal(false);

    setTimeout(() => {
      setMedias([]);
      setPreviewImg([]);
      setPreviewAudios([]);
      setPreviewVideos([]);
      setElementsSeq([]);
      setElementsSeqEdit([]);
      setElementsEdit([]);
      setPreviewDocuments([]);
      setCounts({
        message: 0,
        interval: 0,
        img: 0,
        audio: 0,
        video: 0,
        document: 0
      });
    }, 300);
  };

  const variableFormatter = (item) => "{{" + item + "}}";

  return (
    <Dialog open={activeModal} fullWidth maxWidth="md" onClose={handleClose}>
      <DialogTitle>{open === "edit" ? "Editar Conteúdo" : "Adicionar Conteúdo"}</DialogTitle>

      <DialogContent dividers>
        <Stack spacing={2} sx={{ height: "60vh", overflowY: "auto", pr: 1 }} className="body-card">
          {elementsSeq.map((seqId, index) => (
            <div
              key={seqId}
              className={classes.sortableItem}
              draggable
              onDragStart={() => (dragItem.current = index)}
              onDragEnter={() => (dragOverItem.current = index)}
              onDragEnd={() => {
                if (dragItem.current !== undefined && dragOverItem.current !== undefined) {
                  const newSeq = [...elementsSeq];
                  const draggedItemContent = newSeq.splice(dragItem.current, 1)[0];
                  newSeq.splice(dragOverItem.current, 0, draggedItemContent);
                  setElementsSeq(newSeq);
                  toast.success("Bloco reordenado!");
                }
                dragItem.current = undefined;
                dragOverItem.current = undefined;
              }}
              onDragOver={(e) => e.preventDefault()}
            >
              <div className={classes.dragHandle}>
                <DragIndicator draggable={false} />
              </div>
              <div className={classes.itemContent}>{renderLayout(seqId)}</div>
            </div>
          ))}

          {elementsSeq.length === 0 && (
            <Box sx={{ textAlign: "center", py: 4 }}>
              <Typography color="text.secondary">
                Nenhum conteúdo adicionado. Use os botões abaixo para adicionar.
              </Typography>
            </Box>
          )}
        </Stack>

        {variables && variables.length > 0 && (
          <Box sx={{ mt: 2, mb: 2 }}>
            <Typography variant="subtitle2" gutterBottom>Variáveis disponíveis</Typography>
            <Stack direction="row" spacing={1} flexWrap="wrap">
              {variables.map((item) => (
                <Box
                  key={item}
                  sx={{
                    p: 0.5,
                    bgcolor: "#e3f2fd",
                    borderRadius: 0.5,
                    border: "1px dashed #90caf9",
                    cursor: "pointer",
                    "&:hover": { bgcolor: "#bbdefb" }
                  }}
                  onClick={() => {
                    const textarea = document.querySelector('.messageInput textarea');
                    if (textarea) {
                      const start = textarea.selectionStart;
                      const end = textarea.selectionEnd;
                      const text = textarea.value;
                      const newText = text.substring(0, start) + variableFormatter(item) + text.substring(end);
                      textarea.value = newText;
                      toast.info(`Variável ${variableFormatter(item)} adicionada!`);
                    }
                  }}
                >
                  <Typography variant="caption">{variableFormatter(item)}</Typography>
                </Box>
              ))}
            </Stack>
          </Box>
        )}

        <Stack direction="row" spacing={1} justifyContent="center" sx={{ mt: 2, flexWrap: "wrap" }}>
          <Button className={classes.btnAction} variant="contained" color="primary" onClick={() => addElement('message')} startIcon={<Message />}>Texto</Button>
          <Button className={classes.btnAction} variant="contained" color="primary" onClick={() => addElement('interval')} startIcon={<AccessTime />}>Intervalo</Button>
          <Button className={classes.btnAction} variant="contained" color="primary" onClick={() => addElement('img')} startIcon={<Image />}>Imagem</Button>
          <Button className={classes.btnAction} variant="contained" color="primary" onClick={() => addElement('audio')} startIcon={<MicNone />}>Audio</Button>
          <Button className={classes.btnAction} variant="contained" color="primary" onClick={() => addElement('video')} startIcon={<Videocam />}>Video</Button>
          <Button className={classes.btnAction} variant="contained" color="primary" onClick={() => addElement('document')} startIcon={<Description />}>Doc</Button>
        </Stack>
      </DialogContent>

      <DialogActions>
        <Button onClick={handleClose} color="secondary" disabled={loading}>
          Cancelar
        </Button>
        <Button
          onClick={handleSave}
          color="primary"
          variant="contained"
          disabled={loading || elementsSeq.length === 0}
          className={classes.btnWrapper}
        >
          {loading && <CircularProgress size={24} className={classes.buttonProgress} />}
          {labels.btn}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default FlowBuilderSingleBlockModal;
