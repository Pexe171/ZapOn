import React, { useContext, useEffect, useRef, useState } from "react";
import { useParams, useHistory } from "react-router-dom";
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  makeStyles,
  Paper,
  Tab,
  Tabs,
  TextField,
} from "@material-ui/core";

import ChatList from "./ChatList";
import ChatMessages from "./ChatMessages";
import { UsersFilter } from "../../components/UsersFilter";
import api from "../../services/api";
import { has, isObject } from "lodash";
import { AuthContext } from "../../context/Auth/AuthContext";
import withWidth, { isWidthUp } from "@material-ui/core/withWidth";
import { i18n } from "../../translate/i18n";

const useStyles = makeStyles((theme) => ({
  mainContainer: {
    display: "flex",
    flexDirection: "column",
    position: "relative",
    flex: 1,
    padding: theme.spacing(2),
    height: `calc(100% - 48px)`,
    overflowY: "hidden",
    border: `1px solid ${theme.palette.divider}`,
    borderRadius: 14,
    background:
      theme.palette.mode === "dark"
        ? "linear-gradient(180deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.02) 100%)"
        : "linear-gradient(180deg, rgba(2,6,23,0.03) 0%, rgba(2,6,23,0.01) 100%)",
    boxShadow:
      theme.palette.mode === "dark"
        ? "0 12px 30px rgba(0,0,0,0.35)"
        : "0 12px 30px rgba(2,6,23,0.08)",
  },
  gridContainer: {
    flex: 1,
    height: "100%",
    border: `1px solid ${theme.palette.divider}`,
    borderRadius: 14,
    overflow: "hidden",
    background:
      theme.palette.mode === "dark"
        ? "rgba(255,255,255,0.04)"
        : "rgba(255,255,255,0.75)",
    backdropFilter: "blur(10px)",
  },
  gridItem: {
    height: "100%",
  },
  gridItemTab: {
    height: "92%",
    width: "100%",
  },
  leftColumn: {
    height: "100%",
    borderRight: `1px solid ${theme.palette.divider}`,
    background:
      theme.palette.mode === "dark"
        ? "rgba(255,255,255,0.02)"
        : "rgba(255,255,255,0.55)",
  },
  btnContainer: {
    textAlign: "right",
    padding: 10,
  },
  primaryButton: {
    backgroundColor: theme.palette.primary.main,
    color: theme.palette.primary.contrastText,
    borderRadius: 10,
    fontWeight: 700,
    textTransform: "none",
    boxShadow:
      theme.palette.mode === "dark"
        ? "0 10px 20px rgba(0,0,0,0.35)"
        : "0 10px 20px rgba(2,6,23,0.12)",
  },
  primaryButtonOutlined: {
    borderRadius: 10,
    fontWeight: 700,
    textTransform: "none",
    borderColor: theme.palette.primary.main,
    color: theme.palette.primary.main,
  },
}));

export function ChatModal({
  open,
  chat,
  type,
  handleClose,
  handleLoadNewChat,
}) {
  const classes = useStyles();
  const [users, setUsers] = useState([]);
  const [title, setTitle] = useState("");

  useEffect(() => {
    setTitle("");
    setUsers([]);
    if (type === "edit" && chat) {
      const userList = chat.users.map((u) => ({
        id: u.user.id,
        name: u.user.name,
      }));
      setUsers(userList);
      setTitle(chat.title);
    }
  }, [chat, open, type]);

  const handleSave = async () => {
    try {
      if (type === "edit") {
        await api.put(`/chats/${chat.id}`, {
          users,
          title,
        });
      } else {
        const { data } = await api.post("/chats", {
          users,
          title,
        });
        handleLoadNewChat(data);
      }
      handleClose();
    } catch (err) {}
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      aria-labelledby="alert-dialog-title"
      aria-describedby="alert-dialog-description"
    >
      <DialogTitle id="alert-dialog-title">
        {i18n.t("chatInternal.modal.title")}
      </DialogTitle>
      <DialogContent>
        <Grid spacing={2} container>
          <Grid xs={12} style={{ padding: 18 }} item>
            <TextField
              label="Título"
              placeholder="Título"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              variant="outlined"
              size="small"
              fullWidth
            />
          </Grid>
          <Grid xs={12} item>
            <UsersFilter
              onFiltered={(users) => setUsers(users)}
              initialUsers={users}
            />
          </Grid>
        </Grid>
      </DialogContent>
      <DialogActions>
        <Button
          onClick={handleClose}
          variant="outlined"
          className={classes.primaryButtonOutlined}
        >
          {i18n.t("chatInternal.modal.cancel")}
        </Button>
        <Button
          onClick={handleSave}
          variant="contained"
          className={classes.primaryButton}
          disabled={!users?.length || !title}
        >
          {i18n.t("chatInternal.modal.save")}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function Chat(props) {
  const classes = useStyles();
  const { user, socket } = useContext(AuthContext);
  const history = useHistory();
  const [showDialog, setShowDialog] = useState(false);
  const [dialogType, setDialogType] = useState("new");
  const [currentChat, setCurrentChat] = useState({});
  const [chats, setChats] = useState([]);
  const [chatsPageInfo, setChatsPageInfo] = useState({ hasMore: false });
  const [messages, setMessages] = useState([]);
  const [messagesPageInfo, setMessagesPageInfo] = useState({ hasMore: false });
  const [messagesPage, setMessagesPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState(0);
  const isMounted = useRef(true);
  const scrollToBottomRef = useRef();
  const { id } = useParams();

  const findChats = async () => {
    try {
      const { data } = await api.get("/chats");
      return data;
    } catch (err) {
      console.log(err);
    }
  };

  const findMessages = async (chatId) => {
    setLoading(true);
    try {
      const { data } = await api.get(
        `/chats/${chatId}/messages?pageNumber=${messagesPage}`
      );
      setMessagesPage((prev) => prev + 1);
      setMessagesPageInfo(data);
      setMessages((prev) => [...data.records, ...prev]);
    } catch (err) {}
    setLoading(false);
  };

  const selectChat = (chat) => {
    try {
      setMessages([]);
      setMessagesPage(1);
      setCurrentChat(chat);
      setTab(1);
    } catch (err) {}
  };

  useEffect(() => {
    return () => {
      isMounted.current = false;
    };
  }, []);

  useEffect(() => {
    if (isMounted.current) {
      findChats().then((data) => {
        if (data && data.records) {
          setChats(data.records);
          setChatsPageInfo(data);
          if (id) {
            const chat = data.records.find((r) => r.uuid === id);
            if (chat) selectChat(chat);
          }
        }
      });
    }
  }, [id]);

  useEffect(() => {
    if (isObject(currentChat) && has(currentChat, "id")) {
      findMessages(currentChat.id).then(() => {
        if (typeof scrollToBottomRef.current === "function") {
          setTimeout(() => {
            scrollToBottomRef.current();
          }, 300);
        }
      });
    }
  }, [currentChat]);

  useEffect(() => {
    const companyId = user.companyId;

    const onChatUser = (data) => {
      if (data.action === "create") {
        setChats((prev) => [data.record, ...prev]);
      }
      if (data.action === "update") {
        setChats((prev) =>
          prev.map((chat) => (chat.id === data.record.id ? data.record : chat))
        );
      }
    };

    const onChat = (data) => {
      if (data.action === "delete") {
        setChats((prev) => prev.filter((c) => c.id !== +data.id));
        setMessages([]);
        setMessagesPage(1);
        setMessagesPageInfo({ hasMore: false });
        setCurrentChat({});
        history.push("/chats");
      }
    };

    const onCurrentChat = (data) => {
      if (data.action === "new-message") {
        setMessages((prev) => [...prev, data.newMessage]);
        setChats((prev) =>
          prev.map((chat) => (chat.id === data.newMessage.chatId ? data.chat : chat))
        );
        if (scrollToBottomRef.current) scrollToBottomRef.current();
      }
      if (data.action === "update") {
        setChats((prev) =>
          prev.map((chat) => (chat.id === data.chat.id ? data.chat : chat))
        );
      }
    };

    socket.on(`company-${companyId}-chat-user-${user.id}`, onChatUser);
    socket.on(`company-${companyId}-chat`, onChat);
    if (currentChat?.id) {
      socket.on(`company-${companyId}-chat-${currentChat.id}`, onCurrentChat);
    }

    return () => {
      socket.off(`company-${companyId}-chat-user-${user.id}`, onChatUser);
      socket.off(`company-${companyId}-chat`, onChat);
      if (currentChat?.id) {
        socket.off(`company-${companyId}-chat-${currentChat.id}`, onCurrentChat);
      }
    };
  }, [currentChat, user, socket, history]);

  const sendMessage = async (contentMessage) => {
    setLoading(true);
    try {
      await api.post(`/chats/${currentChat.id}/messages`, {
        message: contentMessage,
      });
    } catch (err) {}
    setLoading(false);
  };

  const deleteChat = async (chat) => {
    try {
      await api.delete(`/chats/${chat.id}`);
    } catch (err) {}
  };

  const loadMoreMessages = async () => {
    if (!loading && currentChat.id) {
      findMessages(currentChat.id);
    }
  };

  const renderGrid = () => (
    <Grid className={classes.gridContainer} container>
      <Grid className={`${classes.gridItem} ${classes.leftColumn}`} md={3} item>
        <div className={classes.btnContainer}>
          <Button
            onClick={() => {
              setDialogType("new");
              setShowDialog(true);
            }}
            variant="contained"
            className={classes.primaryButton}
          >
            {i18n.t("chatInternal.new")}
          </Button>
        </div>
        <ChatList
          chats={chats}
          pageInfo={chatsPageInfo}
          loading={loading}
          handleSelectChat={(chat) => selectChat(chat)}
          handleDeleteChat={(chat) => deleteChat(chat)}
          handleEditChat={() => {
            setDialogType("edit");
            setShowDialog(true);
          }}
        />
      </Grid>
      <Grid className={classes.gridItem} md={9} item>
        {isObject(currentChat) && has(currentChat, "id") && (
          <ChatMessages
            chat={currentChat}
            scrollToBottomRef={scrollToBottomRef}
            pageInfo={messagesPageInfo}
            messages={messages}
            loading={loading}
            handleSendMessage={sendMessage}
            handleLoadMore={loadMoreMessages}
          />
        )}
      </Grid>
    </Grid>
  );

  const renderTab = () => (
    <Grid className={classes.gridContainer} container>
      <Grid xs={12} item>
        <Tabs
          value={tab}
          indicatorColor="primary"
          textColor="primary"
          onChange={(e, v) => setTab(v)}
        >
          <Tab label="Chats" />
          <Tab label="Mensagens" />
        </Tabs>
      </Grid>
      {tab === 0 && (
        <Grid className={classes.gridItemTab} xs={12} item>
          <div className={classes.btnContainer}>
            <Button
              onClick={() => {
                setDialogType("new");
                setShowDialog(true);
              }}
              variant="contained"
              className={classes.primaryButton}
            >
              {i18n.t("chatInternal.new")}
            </Button>
          </div>
          <ChatList
            chats={chats}
            pageInfo={chatsPageInfo}
            loading={loading}
            handleSelectChat={(chat) => selectChat(chat)}
            handleDeleteChat={(chat) => deleteChat(chat)}
          />
        </Grid>
      )}
      {tab === 1 && (
        <Grid className={classes.gridItemTab} xs={12} item>
          {isObject(currentChat) && has(currentChat, "id") && (
            <ChatMessages
              scrollToBottomRef={scrollToBottomRef}
              pageInfo={messagesPageInfo}
              messages={messages}
              loading={loading}
              handleSendMessage={sendMessage}
              handleLoadMore={loadMoreMessages}
            />
          )}
        </Grid>
      )}
    </Grid>
  );

  return (
    <>
      <ChatModal
        type={dialogType}
        open={showDialog}
        chat={currentChat}
        handleLoadNewChat={(data) => {
          setMessages([]);
          setMessagesPage(1);
          setCurrentChat(data);
          setTab(1);
          history.push(`/chats/${data.uuid}`);
        }}
        handleClose={() => setShowDialog(false)}
      />
      <Paper className={classes.mainContainer}>
        {isWidthUp("md", props.width) ? renderGrid() : renderTab()}
      </Paper>
    </>
  );
}

export default withWidth()(Chat);