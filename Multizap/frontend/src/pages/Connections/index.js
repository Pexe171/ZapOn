import React, { useState, useCallback, useContext, useEffect } from "react";
import { toast } from "react-toastify";
import { add, format, parseISO } from "date-fns";

import Menu from "@material-ui/core/Menu";
import MenuItem from "@material-ui/core/MenuItem";
import PopupState, { bindTrigger, bindMenu } from "material-ui-popup-state";
import { makeStyles } from "@material-ui/core/styles";
import { green } from "@material-ui/core/colors";
import {
  Button,
  TableBody,
  TableRow,
  TableCell,
  IconButton,
  Table,
  TableHead,
  Paper,
  Tooltip,
  Typography,
  CircularProgress,
  Box,
  Card,
  CardContent,
} from "@material-ui/core";
import {
  Edit,
  CheckCircle,
  SignalCellularConnectedNoInternet2Bar,
  SignalCellularConnectedNoInternet0Bar,
  SignalCellular4Bar,
  CropFree,
  DeleteOutline,
  Facebook,
  Instagram,
  WhatsApp,
} from "@material-ui/icons";

import FacebookLogin from "react-facebook-login/dist/facebook-login-render-props";

import MainContainer from "../../components/MainContainer";
import MainHeader from "../../components/MainHeader";
import MainHeaderButtonsWrapper from "../../components/MainHeaderButtonsWrapper";
import Title from "../../components/Title";
import TableRowSkeleton from "../../components/TableRowSkeleton";

import api from "../../services/api";
import WhatsAppModal from "../../components/WhatsAppModal";
import ConfirmationModal from "../../components/ConfirmationModal";
import QrcodeModal from "../../components/QrcodeModal";
import { i18n } from "../../translate/i18n";
import { WhatsAppsContext } from "../../context/WhatsApp/WhatsAppsContext";
import toastError from "../../errors/toastError";
import formatSerializedId from "../../utils/formatSerializedId";
import { AuthContext } from "../../context/Auth/AuthContext";
import usePlans from "../../hooks/usePlans";
import { useHistory } from "react-router-dom/cjs/react-router-dom.min";
import ForbiddenPage from "../../components/ForbiddenPage";
import { Can } from "../../components/Can";

const useStyles = makeStyles((theme) => ({
  mainPaper: {
    flex: 1,
    padding: theme.padding,
    overflowY: "scroll",
    ...theme.scrollbarStyles,
  },
  customTableCell: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  tooltip: {
    backgroundColor: "#f5f5f9",
    color: "rgba(0, 0, 0, 0.87)",
    fontSize: theme.typography.pxToRem(14),
    border: "1px solid #dadde9",
    maxWidth: 450,
  },
  tooltipPopper: {
    textAlign: "center",
  },
  buttonProgress: {
    color: green[500],
  },
}));

function CircularProgressWithLabel(props) {
  return (
    <Box position="relative" display="inline-flex">
      <CircularProgress variant="determinate" {...props} />
      <Box top={0} left={0} bottom={0} right={0} position="absolute" display="flex" alignItems="center" justifyContent="center" >
        <Typography variant="caption" component="div" color="textSecondary">
          {`${Math.round(props.value)}%`}
        </Typography>
      </Box>
    </Box>
  );
}

const CustomToolTip = ({ title, content, children }) => {
  const classes = useStyles();
  return (
    <Tooltip
      arrow
      classes={{
        tooltip: classes.tooltip,
        popper: classes.tooltipPopper,
      }}
      title={
        <React.Fragment>
          <Typography gutterBottom color="inherit">
            {title}
          </Typography>
          {content && <Typography>{content}</Typography>}
        </React.Fragment>
      }
    >
      {children}
    </Tooltip>
  );
};

const IconChannel = (channel) => {
  switch (channel) {
    case "facebook":
      return <Facebook style={{ color: "#3b5998" }} />;
    case "instagram":
      return <Instagram style={{ color: "#e1306c" }} />;
    case "whatsapp":
      return <WhatsApp style={{ color: "#25d366" }} />;
    default:
      return "error";
  }
};

const Connections = () => {
  const classes = useStyles();
  const { whatsApps, loading } = useContext(WhatsAppsContext);
  const [whatsAppModalOpen, setWhatsAppModalOpen] = useState(false);
  const [statusImport, setStatusImport] = useState([]);
  const [qrModalOpen, setQrModalOpen] = useState(false);
  const [selectedWhatsApp, setSelectedWhatsApp] = useState(null);
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const history = useHistory();
  
  const confirmationModalInitialState = {
    action: "",
    title: "",
    message: "",
    whatsAppId: "",
    open: false,
  };

  const [confirmModalInfo, setConfirmModalInfo] = useState(confirmationModalInitialState);
  const [planConfig, setPlanConfig] = useState(false);
  const [supportWhatsapp, setSupportWhatsapp] = useState("");

  const { user, socket } = useContext(AuthContext);
  const companyId = user.companyId;
  const { getPlanCompany } = usePlans();

  useEffect(() => {
    async function fetchData() {
      const planConfigs = await getPlanCompany(undefined, companyId);
      setPlanConfig(planConfigs);
    }
    fetchData();
  }, [companyId, getPlanCompany]);

  const responseFacebook = (response) => {
    if (response.status !== "unknown") {
      const { accessToken, userID } = response;
      api.post("/facebook", { facebookUserId: userID, facebookUserToken: accessToken })
        .then(() => toast.success(i18n.t("connections.facebook.success")))
        .catch((error) => toastError(error));
    }
  };

  const responseInstagram = (response) => {
    if (response.status !== "unknown") {
      const { accessToken, userID } = response;
      api.post("/facebook", { addInstagram: true, facebookUserId: userID, facebookUserToken: accessToken })
        .then(() => toast.success(i18n.t("connections.facebook.success")))
        .catch((error) => toastError(error));
    }
  };

  useEffect(() => {
    if (!socket || !user?.companyId) return;
    const eventName = `importMessages-${user.companyId}`;
    const handler = (data) => {
      if (data.action === "refresh") {
        setStatusImport([]);
        return;
      }
      if (data.action === "update") {
        setStatusImport(data.status);
      }
    };
    socket.on(eventName, handler);
    return () => {
      socket.off(eventName, handler);
    };
  }, [socket, user?.companyId]);

  useEffect(() => {
    const fetchSupportWhatsapp = async () => {
      try {
        const { data } = await api.get("/global-config/public-branding");
        const fromPanel = data?.loginWhatsapp;
        const fromEnv = process.env.REACT_APP_NUMBER_SUPPORT ? `https://wa.me/${process.env.REACT_APP_NUMBER_SUPPORT}` : "";
        setSupportWhatsapp(fromPanel || fromEnv);
      } catch (err) {
        if (process.env.REACT_APP_NUMBER_SUPPORT) {
          setSupportWhatsapp(`https://wa.me/${process.env.REACT_APP_NUMBER_SUPPORT}`);
        }
      }
    };
    fetchSupportWhatsapp();
  }, []);

  const handleStartWhatsAppSession = async (whatsAppId) => {
    try {
      await api.post(`/whatsappsession/${whatsAppId}`);
    } catch (err) {
      toastError(err);
    }
  };

  const handleRequestNewQrCode = async (whatsAppId) => {
    try {
      await api.put(`/whatsappsession/${whatsAppId}`);
    } catch (err) {
      toastError(err);
    }
  };

  const handleOpenWhatsAppModal = () => {
    setSelectedWhatsApp(null);
    setWhatsAppModalOpen(true);
  };

  const handleCloseWhatsAppModal = useCallback(() => {
    setWhatsAppModalOpen(false);
    setSelectedWhatsApp(null);
  }, []);

  const handleOpenQrModal = (whatsApp) => {
    setSelectedWhatsApp(whatsApp);
    setQrModalOpen(true);
  };

  const handleCloseQrModal = useCallback(() => {
    setSelectedWhatsApp(null);
    setQrModalOpen(false);
  }, []);

  const handleEditWhatsApp = (whatsApp) => {
    setSelectedWhatsApp(whatsApp);
    setWhatsAppModalOpen(true);
  };

  const openInNewTab = (url) => {
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const handleOpenConfirmationModal = (action, whatsAppId) => {
    if (action === "disconnect") {
      setConfirmModalInfo({
        action,
        title: i18n.t("connections.confirmationModal.disconnectTitle"),
        message: i18n.t("connections.confirmationModal.disconnectMessage"),
        whatsAppId,
      });
    }
    if (action === "delete") {
      setConfirmModalInfo({
        action,
        title: i18n.t("connections.confirmationModal.deleteTitle"),
        message: i18n.t("connections.confirmationModal.deleteMessage"),
        whatsAppId,
      });
    }
    if (action === "closedImported") {
      setConfirmModalInfo({
        action,
        title: i18n.t("connections.confirmationModal.closedImportedTitle"),
        message: i18n.t("connections.confirmationModal.closedImportedMessage"),
        whatsAppId,
      });
    }
    setConfirmModalOpen(true);
  };

  const handleSubmitConfirmationModal = async () => {
    if (confirmModalInfo.action === "disconnect") {
      try {
        await api.delete(`/whatsappsession/${confirmModalInfo.whatsAppId}`);
      } catch (err) {
        toastError(err);
      }
    }
    if (confirmModalInfo.action === "delete") {
      try {
        await api.delete(`/whatsapp/${confirmModalInfo.whatsAppId}`);
        toast.success(i18n.t("connections.toasts.deleted"));
      } catch (err) {
        toastError(err);
      }
    }
    if (confirmModalInfo.action === "closedImported") {
      try {
        await api.post(`/closedimported/${confirmModalInfo.whatsAppId}`);
        toast.success(i18n.t("connections.toasts.closedimported"));
      } catch (err) {
        toastError(err);
      }
    }
    setConfirmModalInfo(confirmationModalInitialState);
    setConfirmModalOpen(false);
  };

  const renderImportButton = (whatsApp) => {
    if (whatsApp?.statusImportMessages === "renderButtonCloseTickets") {
      return (
        <Button
          style={{ marginLeft: 12 }}
          size="small"
          variant="outlined"
          color="primary"
          onClick={() => handleOpenConfirmationModal("closedImported", whatsApp.id)}
        >
          {i18n.t("connections.buttons.closedImported")}
        </Button>
      );
    }
    return null;
  };

  const renderActionButtons = (whatsApp) => {
    return (
      <>
        {whatsApp.status === "qrcode" && (
          <Can
            role={user.profile === "user" && user.allowConnections === "enabled" ? "admin" : user.profile}
            perform="connections-page:addConnection"
            yes={() => (
              <Button size="small" variant="contained" color="primary" onClick={() => handleOpenQrModal(whatsApp)}>
                {i18n.t("connections.buttons.qrcode")}
              </Button>
            )}
          />
        )}
        {whatsApp.status === "DISCONNECTED" && (
          <Can
            role={user.profile === "user" && user.allowConnections === "enabled" ? "admin" : user.profile}
            perform="connections-page:addConnection"
            yes={() => (
              <>
                <Button size="small" variant="outlined" color="primary" onClick={() => handleStartWhatsAppSession(whatsApp.id)}>
                  {i18n.t("connections.buttons.tryAgain")}
                </Button>{" "}
                <Button size="small" variant="outlined" color="secondary" onClick={() => handleRequestNewQrCode(whatsApp.id)}>
                  {i18n.t("connections.buttons.newQr")}
                </Button>
              </>
            )}
          />
        )}
        {(whatsApp.status === "CONNECTED" || whatsApp.status === "PAIRING" || whatsApp.status === "TIMEOUT") && (
          <Can
            role={user.profile}
            perform="connections-page:addConnection"
            yes={() => (
              <>
                <Button size="small" variant="outlined" color="secondary" onClick={() => handleOpenConfirmationModal("disconnect", whatsApp.id)}>
                  {i18n.t("connections.buttons.disconnect")}
                </Button>
                {renderImportButton(whatsApp)}
              </>
            )}
          />
        )}
        {whatsApp.status === "OPENING" && (
          <Button size="small" variant="outlined" disabled color="default">
            {i18n.t("connections.buttons.connecting")}
          </Button>
        )}
      </>
    );
  };

  const renderStatusToolTips = (whatsApp) => {
    return (
      <div className={classes.customTableCell}>
        {whatsApp.status === "DISCONNECTED" && (
          <CustomToolTip title={i18n.t("connections.toolTips.disconnected.title")} content={i18n.t("connections.toolTips.disconnected.content")}>
            <SignalCellularConnectedNoInternet0Bar color="secondary" />
          </CustomToolTip>
        )}
        {whatsApp.status === "OPENING" && <CircularProgress size={24} className={classes.buttonProgress} />}
        {whatsApp.status === "qrcode" && (
          <CustomToolTip title={i18n.t("connections.toolTips.qrcode.title")} content={i18n.t("connections.toolTips.qrcode.content")}>
            <CropFree />
          </CustomToolTip>
        )}
        {whatsApp.status === "CONNECTED" && (
          <CustomToolTip title={i18n.t("connections.toolTips.connected.title")}>
            <SignalCellular4Bar style={{ color: green[500] }} />
          </CustomToolTip>
        )}
        {(whatsApp.status === "TIMEOUT" || whatsApp.status === "PAIRING") && (
          <CustomToolTip title={i18n.t("connections.toolTips.timeout.title")} content={i18n.t("connections.toolTips.timeout.content")}>
            <SignalCellularConnectedNoInternet2Bar color="secondary" />
          </CustomToolTip>
        )}
      </div>
    );
  };

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  const restartWhatsapps = async () => {
    toast.info("Reiniciando processos das conexões...");
    try {
      for (const whatsapp of whatsApps) {
        if (whatsapp.channel !== "whatsapp") continue;

        try {
          // Em vez de DELETE e POST, usamos o PUT
          // O PUT geralmente aciona o StartWhatsAppSession que tenta usar a sessão existente
          // sem forçar um logout no aparelho do cliente.
          await api.put(`/whatsappsession/${whatsapp.id}`);
          
          await sleep(1500); // Aguarda um pouco entre cada uma
        } catch (e) {
          console.error(`Erro ao reiniciar WhatsApp ${whatsapp.id}:`, e);
        }
      }
      toast.success(i18n.t("connections.waitConnection"));
    } catch (err) {
      toastError(err);
    }
  };

  return (
    <MainContainer>
      <ConfirmationModal title={confirmModalInfo.title} open={confirmModalOpen} onClose={() => setConfirmModalOpen(false)} onConfirm={handleSubmitConfirmationModal} >
        {confirmModalInfo.message}
      </ConfirmationModal>
      {qrModalOpen && (
        <QrcodeModal open={qrModalOpen} onClose={handleCloseQrModal} whatsAppId={!whatsAppModalOpen && selectedWhatsApp?.id} />
      )}
      <WhatsAppModal open={whatsAppModalOpen} onClose={handleCloseWhatsAppModal} whatsAppId={!qrModalOpen && selectedWhatsApp?.id} />
      
      {user.profile === "user" && user.allowConnections === "disabled" ? (
        <ForbiddenPage />
      ) : (
        <>
          <MainHeader>
            <Title>{i18n.t("connections.title")} ({whatsApps.length})</Title>
            <MainHeaderButtonsWrapper>
              <Button variant="contained" color="primary" onClick={restartWhatsapps} >
                {i18n.t("connections.restartConnections")}
              </Button>

              <Button variant="contained" color="primary" onClick={() => openInNewTab(supportWhatsapp)}>
                {i18n.t("connections.callSupport")}
              </Button>

              <PopupState variant="popover" popupId="demo-popup-menu">
                {(popupState) => (
                  <React.Fragment>
                    <Can role={user.profile} perform="connections-page:addConnection" yes={() => (
                      <>
                        <Button variant="contained" color="primary" {...bindTrigger(popupState)}>
                          {i18n.t("connections.newConnection")}
                        </Button>
                        <Menu {...bindMenu(popupState)}>
                          <MenuItem disabled={!planConfig?.plan?.useWhatsapp} onClick={() => { handleOpenWhatsAppModal(); popupState.close(); }}>
                            <WhatsApp fontSize="small" style={{ marginRight: "10px", color: "#25D366" }} /> WhatsApp
                          </MenuItem>
                          
                          <FacebookLogin
                            appId={process.env.REACT_APP_FACEBOOK_APP_ID}
                            callback={responseFacebook}
                            render={(renderProps) => (
                              <MenuItem disabled={!planConfig?.plan?.useFacebook} onClick={renderProps.onClick}>
                                <Facebook fontSize="small" style={{ marginRight: "10px", color: "#3b5998" }} /> Facebook
                              </MenuItem>
                            )}
                          />

                          <FacebookLogin
                            appId={process.env.REACT_APP_FACEBOOK_APP_ID}
                            callback={responseInstagram}
                            render={(renderProps) => (
                              <MenuItem disabled={!planConfig?.plan?.useInstagram} onClick={renderProps.onClick}>
                                <Instagram fontSize="small" style={{ marginRight: "10px", color: "#e1306c" }} /> Instagram
                              </MenuItem>
                            )}
                          />
                        </Menu>
                      </>
                    )} />
                  </React.Fragment>
                )}
              </PopupState>
            </MainHeaderButtonsWrapper>
          </MainHeader>

          {statusImport?.all && (
            <Box mb={2}>
              <Card>
                <CardContent>
                  <Typography component="h5" variant="h5">
                    {statusImport?.this === -1 ? i18n.t("connections.buttons.preparing") : i18n.t("connections.buttons.importing")}
                  </Typography>
                  {statusImport?.this === -1 ? <CircularProgress size={24} /> : (
                    <>
                      <Typography align="center">
                        {`${i18n.t("connections.typography.processed")} ${statusImport?.this} / ${statusImport?.all}`}
                      </Typography>
                      <Box display="flex" justifyContent="center" mt={1}>
                        <CircularProgressWithLabel value={(statusImport?.this / statusImport?.all) * 100} />
                      </Box>
                    </>
                  )}
                </CardContent>
              </Card>
            </Box>
          )}

          <Paper className={classes.mainPaper} variant="outlined">
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell align="center">Channel</TableCell>
                  <TableCell align="center">ID</TableCell>
                  <TableCell align="center">{i18n.t("connections.table.name")}</TableCell>
                  <TableCell align="center">{i18n.t("connections.table.number")}</TableCell>
                  <TableCell align="center">{i18n.t("connections.table.status")}</TableCell>
                  <TableCell align="center">{i18n.t("connections.table.session")}</TableCell>
                  <TableCell align="center">{i18n.t("connections.table.lastUpdate")}</TableCell>
                  <TableCell align="center">{i18n.t("connections.table.default")}</TableCell>
                  <Can role={user.profile === "user" && user.allowConnections === "enabled" ? "admin" : user.profile} perform="connections-page:addConnection" yes={() => (
                    <TableCell align="center">{i18n.t("connections.table.actions")}</TableCell>
                  )} />
                </TableRow>
              </TableHead>
              <TableBody>
                {loading ? <TableRowSkeleton /> : (
                  <>
                    {whatsApps?.map((whatsApp) => (
                      <TableRow key={whatsApp.id}>
                        <TableCell align="center">{IconChannel(whatsApp.channel)}</TableCell>
                        <TableCell align="center">
                          <span 
                            style={{ padding: "2px 8px", borderRadius: 999, border: "1px solid rgba(0,0,0,0.12)", fontWeight: 700, cursor: "pointer" }}
                            onClick={() => navigator.clipboard.writeText(String(whatsApp.id))}
                          >
                            {whatsApp.id}
                          </span>
                        </TableCell>
                        <TableCell align="center">{whatsApp.name}</TableCell>
                        <TableCell align="center">
                          {whatsApp.number && whatsApp.channel === "whatsapp" ? formatSerializedId(whatsApp.number) : whatsApp.number}
                        </TableCell>
                        <TableCell align="center">{renderStatusToolTips(whatsApp)}</TableCell>
                        <TableCell align="center">{renderActionButtons(whatsApp)}</TableCell>
                        <TableCell align="center">{format(parseISO(whatsApp.updatedAt), "dd/MM/yy HH:mm")}</TableCell>
                        <TableCell align="center">
                          {whatsApp.isDefault && <CheckCircle style={{ color: green[500] }} />}
                        </TableCell>
                        <Can role={user.profile} perform="connections-page:addConnection" yes={() => (
                          <TableCell align="center">
                            <IconButton size="small" onClick={() => handleEditWhatsApp(whatsApp)}><Edit /></IconButton>
                            <IconButton size="small" onClick={() => handleOpenConfirmationModal("delete", whatsApp.id)}><DeleteOutline /></IconButton>
                          </TableCell>
                        )} />
                      </TableRow>
                    ))}
                  </>
                )}
              </TableBody>
            </Table>
          </Paper>
        </>
      )}
    </MainContainer>
  );
};

export default Connections;