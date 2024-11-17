import React, {
  useState,
  useEffect,
  useReducer,
  useRef,
  useContext,
} from "react";

import { isSameDay, parseISO, format } from "date-fns";
import clsx from "clsx";

import { green } from "@material-ui/core/colors";
import {
  Button,
  CircularProgress,
  Divider,
  IconButton,
  makeStyles,
  Badge,
} from "@material-ui/core";

import {
  AccessTime,
  Block,
  Done,
  DoneAll,
  ExpandMore,
  GetApp,
  Reply,
} from "@material-ui/icons";

import AudioModal from "../AudioModal";
import MarkdownWrapper from "../MarkdownWrapper";
import ModalImageCors from "../ModalImageCors";
import MessageOptionsMenu from "../MessageOptionsMenu";
import whatsBackground from "../../assets/wa-background.png";
import LocationPreview from "../LocationPreview";
import whatsBackgroundDark from "../../assets/wa-background-dark.png"; //DARK MODE Pack Typebot//
import VCardPreview from "../VCardPreview";
import api from "../../services/api";
import toastError from "../../errors/toastError";
import { SocketContext } from "../../context/Socket/SocketContext";
import { ForwardMessageContext } from "../../context/ForwarMessage/ForwardMessageContext";
import { ReplyMessageContext } from "../../context/ReplyingMessage/ReplyingMessageContext";
import SelectMessageCheckbox from "./SelectMessageCheckbox";

import { Mutex } from "async-mutex";
const loadPageMutex = new Mutex();

const useStyles = makeStyles((theme) => ({
  messagesListWrapper: {
    overflow: "hidden",
    position: "relative",
    display: "flex",
    flexDirection: "column",
    flexGrow: 1,
    width: "100%",
    minWidth: 300,
    minHeight: 200,
  },

  messagesList: {
    backgroundImage:
      theme.mode === "light"
        ? `url(${whatsBackground})`
        : `url(${whatsBackgroundDark})`, //DARK MODE Pack Typebot//
    display: "flex",
    flexDirection: "column",
    flexGrow: 1,
    padding: "20px 20px 20px 20px",
    overflowY: "scroll",
    ...theme.scrollbarStyles,
  },

  circleLoading: {
    color: green[500],
    position: "absolute",
    opacity: "70%",
    top: 0,
    left: "50%",
    marginTop: 12,
  },

  messageLeft: {
    marginRight: 20,
    marginTop: 2,
    minWidth: 100,
    maxWidth: 600,
    height: "auto",
    display: "block",
    position: "relative",
    "&:hover #messageActionsButton": {
      display: "flex",
      position: "absolute",
      top: 0,
      right: 0,
    },

    whiteSpace: "pre-wrap",
    backgroundColor: "#ffffff",
    color: "#303030",
    alignSelf: "flex-start",
    borderTopLeftRadius: 0,
    borderTopRightRadius: 8,
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 8,
    paddingLeft: 5,
    paddingRight: 5,
    paddingTop: 5,
    paddingBottom: 0,
    boxShadow: "0 1px 1px #b3b3b3",
    transition: "background-color 0.5s ease-in-out",
  },

  quotedContainerLeft: {
    margin: "-3px -80px 6px -6px",
    overflow: "hidden",
    backgroundColor: "#f0f0f0",
    borderRadius: "7.5px",
    display: "flex",
    position: "relative",
    cursor: "pointer",
  },

  quotedMsg: {
    padding: 10,
    maxWidth: 300,
    height: "auto",
    display: "block",
    whiteSpace: "pre-wrap",
    overflow: "hidden",
  },

  quotedSideColorLeft: {
    flex: "none",
    width: "4px",
    backgroundColor: "#6bcbef",
  },

  messageRight: {
    marginLeft: 20,
    marginTop: 2,
    minWidth: 100,
    maxWidth: 600,
    height: "auto",
    display: "block",
    position: "relative",
    "&:hover #messageActionsButton": {
      display: "flex",
      position: "absolute",
      top: 0,
      right: 0,
    },

    whiteSpace: "pre-wrap",
    backgroundColor: "#dcf8c6",
    color: "#303030",
    alignSelf: "flex-end",
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 0,
    paddingLeft: 5,
    paddingRight: 5,
    paddingTop: 5,
    paddingBottom: 0,
    boxShadow: "0 1px 1px #b3b3b3",
  },

  quotedContainerRight: {
    margin: "-3px -80px 6px -6px",
    overflowY: "hidden",
    backgroundColor: "#cfe9ba",
    borderRadius: "7.5px",
    display: "flex",
    position: "relative",
  },

  quotedMsgRight: {
    padding: 10,
    maxWidth: 300,
    height: "auto",
    whiteSpace: "pre-wrap",
  },

  quotedSideColorRight: {
    flex: "none",
    width: "4px",
    backgroundColor: "#35cd96",
  },

  messageActionsButton: {
    display: "none",
    position: "relative",
    color: "#999",
    zIndex: 1,
    backgroundColor: "inherit",
    opacity: "90%",
    "&:hover, &.Mui-focusVisible": { backgroundColor: "inherit" },
  },

  messageContactName: {
    display: "flex",
    color: "#6bcbef",
    fontWeight: 500,
  },

  textContentItem: {
    overflowWrap: "break-word",
    padding: "3px 80px 6px 6px",
  },

  textContentItemEdited: {
    overflowWrap: "break-word",
    padding: "3px 120px 6px 6px",
  },

  textContentItemDeleted: {
    fontStyle: "italic",
    color: "rgba(0, 0, 0, 0.36)",
    overflowWrap: "break-word",
    padding: "3px 80px 6px 6px",
  },
  forwardMessage: {
    fontSize: 12,
    fontStyle: "italic",
    position: "absolute",
    top: 0,
    left: 5,
    color: "#999",
    display: "flex",
    alignItems: "center",
  },
  messageMedia: {
    objectFit: "cover",
    width: 250,
    height: 200,
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 8,
  },

  timestamp: {
    fontSize: 11,
    position: "absolute",
    bottom: 0,
    right: 5,
    color: "#999",
  },

  dailyTimestamp: {
    alignItems: "center",
    textAlign: "center",
    alignSelf: "center",
    width: "110px",
    backgroundColor: "#e1f3fb",
    margin: "10px",
    borderRadius: "10px",
    boxShadow: "0 1px 1px #b3b3b3",
  },

  dailyTimestampText: {
    color: "#808888",
    padding: 8,
    alignSelf: "center",
    marginLeft: "0px",
  },

  ackIcons: {
    fontSize: 18,
    verticalAlign: "middle",
    marginLeft: 4,
  },

  deletedIcon: {
    fontSize: 18,
    verticalAlign: "middle",
    marginRight: 4,
  },

  ackDoneAllIcon: {
    color: green[500],
    fontSize: 18,
    verticalAlign: "middle",
    marginLeft: 4,
  },

  downloadMedia: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "inherit",
    padding: 10,
  },
  "@global": {
    "@keyframes wave": {
      "0%, 60%, 100%": {
        transform: "initial",
      },
      "30%": {
        transform: "translateY(-15px)",
      },
    },
    "@keyframes quiet": {
      "25%": {
        transform: "scaleY(.6)",
      },
      "50%": {
        transform: "scaleY(.4)",
      },
      "75%": {
        transform: "scaleY(.8)",
      },
    },
    "@keyframes normal": {
      "25%": {
        transform: "scaleY(.1)",
      },
      "50%": {
        transform: "scaleY(.4)",
      },
      "75%": {
        transform: "scaleY(.6)",
      },
    },
    "@keyframes loud": {
      "25%": {
        transform: "scaleY(1)",
      },
      "50%": {
        transform: "scaleY(.4)",
      },
      "75%": {
        transform: "scaleY(1.2)",
      },
    },
  },
  wave: {
    position: "relative",
    textAlign: "center",
    height: "30px",
    marginTop: "10px",
    marginLeft: "auto",
    marginRight: "auto",
  },
  dot: {
    display: "inline-block",
    width: "7px",
    height: "7px",
    borderRadius: "50%",
    marginRight: "3px",
    background: theme.mode === "light" ? "#303030" : "#ffffff",
    animation: "wave 1.3s linear infinite",
    "&:nth-child(2)": {
      animationDelay: "-1.1s",
    },
    "&:nth-child(3)": {
      animationDelay: "-0.9s",
    },
  },

  wavebarsContainer: {
    display: "flex",
    justifyContent: "space-between",
    height: "30px",
    marginTop: "5px",
    marginBottom: "5px",
    marginLeft: "auto",
    marginRight: "auto",
    "--boxSize": "5px",
    "--gutter": "4px",
    width: "calc((var(--boxSize) + var(--gutter)) * 5)",
  },

  wavebars: {
    transform: "scaleY(.4)",
    height: "100%",
    width: "var(--boxSize)",
    animationDuration: "1.2s",
    backgroundColor: theme.mode === "light" ? "#303030" : "#ffffff",
    animationTimingFunction: "ease-in-out",
    animationIterationCount: "infinite",
    borderRadius: "8px",
  },

  wavebar1: {
    animationName: "quiet",
  },
  wavebar2: {
    animationName: "normal",
  },
  wavebar3: {
    animationName: "quiet",
  },
  wavebar4: {
    animationName: "loud",
  },
  wavebar5: {
    animationName: "quiet",
  },
}));

const reducer = (state, action) => {
  if (action.type === "LOAD_MESSAGES") {
    const messages = action.payload;
    const newMessages = [];

    messages.forEach((message) => {
      const messageIndex = state.findIndex((m) => m.id === message.id);
      if (messageIndex !== -1) {
        state[messageIndex] = message;
      } else {
        newMessages.push(message);
      }
    });

    return [...newMessages, ...state];
  }

  if (action.type === "ADD_MESSAGE") {
    const newMessage = action.payload;
    const messageIndex = state.findIndex((m) => m.id === newMessage.id);

    if (messageIndex !== -1) {
      state[messageIndex] = newMessage;
    } else {
      state.push(newMessage);
    }

    return [...state];
  }

  if (action.type === "UPDATE_MESSAGE") {
    const messageToUpdate = action.payload;
    const messageIndex = state.findIndex((m) => m.id === messageToUpdate.id);

    if (messageIndex !== -1) {
      state[messageIndex] = messageToUpdate;
    }

    return [...state];
  }

  if (action.type === "RESET") {
    return [];
  }
};

const MessagesList = ({ ticket, ticketId, isGroup }) => {
  const classes = useStyles();

  const [messagesList, dispatch] = useReducer(reducer, []);
  const [pageNumber, setPageNumber] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const lastMessageRef = useRef();
  const scrollRef = useRef();
  const [contactPresence, setContactPresence] = useState("available");

  const [selectedMessage, setSelectedMessage] = useState({});
  const [anchorEl, setAnchorEl] = useState(null);
  const messageOptionsMenuOpen = Boolean(anchorEl);
  const currentTicketId = useRef(ticketId);
  const isIOS =
    /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
  const socketManager = useContext(SocketContext);
  const { setReplyingMessage } = useContext(ReplyMessageContext);
  const { showSelectMessageCheckbox } = useContext(ForwardMessageContext);

  function loadData(incrementPage = false) {
    setLoading(true);
    const thisPageNumber = incrementPage ? pageNumber + 1 : 1;
    const delayDebounceFn = setTimeout(() => {
      const fetchMessages = async () => {
        if (ticketId === undefined) return;
        try {
          const { data } = await api.get("/messages/" + ticketId, {
            params: { pageNumber: thisPageNumber },
          });

          if (currentTicketId.current === ticketId) {
            dispatch({ type: "LOAD_MESSAGES", payload: data.messages });
            setHasMore(data.hasMore);
            setLoading(false);
          }

          if (pageNumber === 1 && data.messages.length > 1) {
            scrollToBottom();
          }
        } catch (err) {
          setLoading(false);
          toastError(err);
        }
      };
      fetchMessages();
      setPageNumber(thisPageNumber);
    }, 500);
    return () => {
      clearTimeout(delayDebounceFn);
    };
  }

  useEffect(async () => {
    dispatch({ type: "RESET" });

    currentTicketId.current = ticketId;

    await loadPageMutex.runExclusive(async () => {
      loadData();
    });
  }, [ticketId]);

  useEffect(() => {
    const companyId = localStorage.getItem("companyId");
    const socket = socketManager.getSocket(companyId);

    socket.on("ready", () => socket.emit("joinChatBox", `${ticket.id}`));

    socket.on(`company-${companyId}-appMessage`, (data) => {
      if (
        data.action === "create" &&
        data.message.ticketId === currentTicketId.current
      ) {
        dispatch({ type: "ADD_MESSAGE", payload: data.message });
        scrollToBottom();
      }

      if (
        data.action === "update" &&
        data.message.ticketId === currentTicketId.current
      ) {
        dispatch({ type: "UPDATE_MESSAGE", payload: data.message });
      }
    });

    socket.on(`company-${companyId}-contact`, (data) => {
      if (data?.contact?.id === ticket.contact.id && data.action === "update") {
        setContactPresence(data?.contact?.presence || "available");
      }
    });

    return () => {
      socket.disconnect();
    };
  }, [ticketId, ticket, socketManager]);

  const loadMore = async () => {
    await loadPageMutex.runExclusive(async () => {
      loadData(true);
    });
  };

  const scrollToBottom = () => {
    if (lastMessageRef.current) {
      lastMessageRef.current.scrollIntoView({});
    }
  };

  const handleScroll = (e) => {
    if (!hasMore) return;
    const { scrollTop } = e.currentTarget;

    if (scrollTop === 0) {
      document.getElementById("messagesList").scrollTop = 1;
    }

    if (loading) {
      return;
    }

    if (scrollTop < 50) {
      loadMore();
    }
  };

  const hanldeReplyMessage = (e, message) => {
    //if (ticket.status === "open" || ticket.status === "group") {
    setAnchorEl(null);
    setReplyingMessage(message);
    //}
  };

  const handleOpenMessageOptionsMenu = (e, message) => {
    setAnchorEl(e.currentTarget);
    setSelectedMessage(message);
  };

  const handleCloseMessageOptionsMenu = (e) => {
    setAnchorEl(null);
  };

  const checkMessageMedia = (message) => {
    console.log(message);
    if (
      message.mediaType === "locationMessage" &&
      message.body.split("|").length >= 2
    ) {
      let locationParts = message.body.split("|");
      let imageLocation = locationParts[0];
      let linkLocation = locationParts[1];

      let descriptionLocation = null;

      if (locationParts.length > 2)
        descriptionLocation = message.body.split("|")[2];

      return (
        <LocationPreview
          image={imageLocation}
          link={linkLocation}
          description={descriptionLocation}
        />
      );
    } else if (message.mediaType === "contactMessage") {
      let array = message.body.split("\n");
      let obj = [];
      let contact = "";
      for (let index = 0; index < array.length; index++) {
        const v = array[index];
        let values = v.split(":");
        for (let ind = 0; ind < values.length; ind++) {
          if (values[ind].indexOf("+") !== -1) {
            obj.push({ number: values[ind] });
          }
          if (values[ind].indexOf("FN") !== -1) {
            contact = values[ind + 1];
          }
        }
      }
      // console.log(message)
      return;
    } else if (message.mediaType === "image") {
      return <ModalImageCors imageUrl={message.mediaUrl} />;
    } else if (message.mediaType === "audio") {
      return (
        <AudioModal url={message.mediaUrl} />
        // <audio controls>
        //   <source src={message.mediaUrl} type="audio/ogg"></source>
        //   {/* <source src={message.mediaUrl} type="audio/mp3"></source> */}
        // </audio>
      );
    } else if (message.mediaType === "video") {
      return (
        <video
          className={classes.messageMedia}
          src={message.mediaUrl}
          controls
        />
      );
    } else {
      return (
        <>
          <div className={classes.downloadMedia}>
            <Button
              startIcon={<GetApp />}
              variant="outlined"
              target="_blank"
              href={message.mediaUrl}
            >
              Download
            </Button>
          </div>
          <Divider />
        </>
      );
    }
  };

  /*
    const renderMessageAck = (message) => {
      if (message.ack === 1) {
        return <AccessTime fontSize="small" className={classes.ackIcons} />;
      }
      if (message.ack === 2) {
        return <Done fontSize="small" className={classes.ackIcons} />;
      }
      if (message.ack === 3) {
        return <DoneAll fontSize="small" className={classes.ackIcons} />;
      }
      if (message.ack === 4 || message.ack === 5) {
        return <DoneAll fontSize="small" className={classes.ackDoneAllIcon} />;
      }
    };
    */

  const renderMessageAck = (message) => {
    if (message.ack === 0) {
      return <AccessTime fontSize="small" className={classes.ackIcons} />;
    }
    if (message.ack === 1) {
      return <Done fontSize="small" className={classes.ackIcons} />;
    }
    if (message.ack === 2) {
      return <Done fontSize="small" className={classes.ackIcons} />;
    }
    if (message.ack === 3) {
      return <DoneAll fontSize="small" className={classes.ackIcons} />;
    }
    if (message.ack === 4 || message.ack === 5) {
      return (
        <DoneAll
          fontSize="small"
          className={classes.ackDoneAllIcon}
          style={{ color: "#0377FC" }}
        />
      );
    }
  };

  const renderDailyTimestamps = (message, index) => {
    if (index === 0) {
      return (
        <span
          className={classes.dailyTimestamp}
          key={`timestamp-${message.id}`}
        >
          <div className={classes.dailyTimestampText}>
            {format(parseISO(messagesList[index].createdAt), "dd/MM/yyyy")}
          </div>
        </span>
      );
    }
    if (index < messagesList.length - 1) {
      let messageDay = parseISO(messagesList[index].createdAt);
      let previousMessageDay = parseISO(messagesList[index - 1].createdAt);

      if (!isSameDay(messageDay, previousMessageDay)) {
        return (
          <span
            className={classes.dailyTimestamp}
            key={`timestamp-${message.id}`}
          >
            <div className={classes.dailyTimestampText}>
              {format(parseISO(messagesList[index].createdAt), "dd/MM/yyyy")}
            </div>
          </span>
        );
      }
    }
    if (index === messagesList.length - 1) {
      return (
        <div
          key={`ref-${message.createdAt}`}
          ref={lastMessageRef}
          style={{ float: "left", clear: "both" }}
        />
      );
    }
  };

  const renderNumberTicket = (message, index) => {
    if (index < messagesList.length && index > 0) {
      let messageTicket = message.ticketId;
      let connectionName = message.ticket?.whatsapp?.name;
      let previousMessageTicket = messagesList[index - 1].ticketId;

      if (messageTicket !== previousMessageTicket) {
        return (
          <center>
            <div className={classes.ticketNunberClosed}>
              Conversa encerrada:{" "}
              {format(
                parseISO(messagesList[index - 1].createdAt),
                "dd/MM/yyyy HH:mm:ss"
              )}
            </div>

            <div className={classes.ticketNunberOpen}>
              Conversa iniciada:{" "}
              {format(parseISO(message.createdAt), "dd/MM/yyyy HH:mm:ss")}
            </div>
          </center>
        );
      }
    }
  };

  const renderMessageDivider = (message, index) => {
    if (index < messagesList.length && index > 0) {
      let messageUser = messagesList[index].fromMe;
      let previousMessageUser = messagesList[index - 1].fromMe;

      if (messageUser !== previousMessageUser) {
        return (
          <span style={{ marginTop: 16 }} key={`divider-${message.id}`}></span>
        );
      }
    }
  };

  const renderQuotedMessage = (message) => {
    return (
      <div
        className={clsx(classes.quotedContainerLeft, {
          [classes.quotedContainerRight]: message.fromMe,
        })}
      >
        <span
          className={clsx(classes.quotedSideColorLeft, {
            [classes.quotedSideColorRight]: message.quotedMsg?.fromMe,
          })}
        ></span>
        <div className={classes.quotedMsg}>
          {!message.quotedMsg?.fromMe && (
            <span className={classes.messageContactName}>
              {message.quotedMsg?.contact?.name}
            </span>
          )}

          {message.quotedMsg.mediaType === "audio" && (
            <div className={classes.downloadMedia}>
              <audio controls>
                <source
                  src={message.quotedMsg.mediaUrl}
                  type="audio/ogg"
                ></source>
              </audio>
            </div>
          )}
          {message.quotedMsg.mediaType === "video" && (
            <video
              className={classes.messageMedia}
              src={message.quotedMsg.mediaUrl}
              controls
            />
          )}
          {message.quotedMsg.mediaType === "application" && (
            <div className={classes.downloadMedia}>
              <Button
                startIcon={<GetApp />}
                color="primary"
                variant="outlined"
                target="_blank"
                href={message.quotedMsg.mediaUrl}
              >
                Download
              </Button>
            </div>
          )}

          {(message.quotedMsg.mediaType === "image" && (
            <ModalImageCors imageUrl={message.quotedMsg.mediaUrl} />
          )) ||
            message.quotedMsg?.body}
        </div>
      </div>
    );
  };

  const renderMessages = () => {
    if (messagesList.length > 0) {
      const viewMessagesList = messagesList.map((message, index) => {
        if (message.mediaType === "call_log") {
          return (
            <React.Fragment key={message.id}>
              {renderDailyTimestamps(message, index)}
              {renderNumberTicket(message, index)}
              {renderMessageDivider(message, index)}
              <div className={classes.messageCenter}>
                <IconButton
                  variant="contained"
                  size="small"
                  id="messageActionsButton"
                  disabled={message.isDeleted}
                  className={classes.messageActionsButton}
                  onClick={(e) => handleOpenMessageOptionsMenu(e, message)}
                >
                  <ExpandMore />
                </IconButton>
                {isGroup && (
                  <span className={classes.messageContactName}>
                    {message.contact?.name}
                  </span>
                )}
                <div>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 20 17"
                    width="20"
                    height="17"
                  >
                    <path
                      fill="#df3333"
                      d="M18.2 12.1c-1.5-1.8-5-2.7-8.2-2.7s-6.7 1-8.2 2.7c-.7.8-.3 2.3.2 2.8.2.2.3.3.5.3 1.4 0 3.6-.7 3.6-.7.5-.2.8-.5.8-1v-1.3c.7-1.2 5.4-1.2 6.4-.1l.1.1v1.3c0 .2.1.4.2.6.1.2.3.3.5.4 0 0 2.2.7 3.6.7.2 0 1.4-2 .5-3.1zM5.4 3.2l4.7 4.6 5.8-5.7-.9-.8L10.1 6 6.4 2.3h2.5V1H4.1v4.8h1.3V3.2z"
                    ></path>
                  </svg>{" "}
                  <span>
                    Chamada de voz/vídeo perdida às{" "}
                    {format(parseISO(message.createdAt), "HH:mm")}
                  </span>
                </div>
              </div>
            </React.Fragment>
          );
        }

        if (!message.fromMe) {
          return (
            <React.Fragment key={message.id}>
              {renderDailyTimestamps(message, index)}
              {renderNumberTicket(message, index)}
              {renderMessageDivider(message, index)}
              <div
                className={classes.messageLeft}
                title={message.queueId && message.queue?.name}
                onDoubleClick={(e) => hanldeReplyMessage(e, message)}
              >
                {showSelectMessageCheckbox && (
                  <SelectMessageCheckbox
                    // showSelectMessageCheckbox={showSelectMessageCheckbox}
                    message={message}
                    // selectedMessagesList={selectedMessagesList}
                    // setSelectedMessagesList={setSelectedMessagesList}
                  />
                )}
                <IconButton
                  variant="contained"
                  size="small"
                  id="messageActionsButton"
                  disabled={message.isDeleted}
                  className={classes.messageActionsButton}
                  onClick={(e) => handleOpenMessageOptionsMenu(e, message)}
                >
                  <ExpandMore />
                </IconButton>
                {message.isForwarded && (
                  <div>
                    <span className={classes.forwardMessage}>
                      <Reply
                        style={{ color: "grey", transform: "scaleX(-1)" }}
                      />{" "}
                      Encaminhada
                    </span>
                    <br />
                  </div>
                )}
                {isGroup && (
                  <span className={classes.messageContactName}>
                    {message.contact?.name}
                  </span>
                )}

                {/* aviso de mensagem apagado pelo contato */}
                {message.isDeleted && (
                  <div>
                    <span className={"message-deleted"}>
                      Essa mensagem foi apagada pelo contato &nbsp;
                      <Block
                        color="error"
                        fontSize="small"
                        className={classes.deletedIcon}
                      />
                    </span>
                  </div>
                )}

                {(message.mediaUrl ||
                  message.mediaType === "locationMessage" ||
                  message.mediaType === "vcard" ||
                  message.mediaType === "contactMessage") &&
                  //|| message.mediaType === "multi_vcard"
                  checkMessageMedia(message)}
                <div className={classes.textContentItem}>
                  {message.quotedMsg && renderQuotedMessage(message)}
                  {message.mediaType !== "reactionMessage" && (
                    <MarkdownWrapper>
                      {message.mediaType === "locationMessage" ||
                      message.mediaType === "contactMessage"
                        ? null
                        : message.body}
                    </MarkdownWrapper>
                  )}
                  {message.quotedMsg &&
                    message.mediaType === "reactionMessage" &&
                    message.body && (
                      <>
                        <span
                          style={{
                            marginLeft: "0px",
                            display: "flex",
                            alignItems: "center",
                          }}
                        >
                          <MarkdownWrapper>
                            {"_*" +
                              (message.fromMe
                                ? "Você"
                                : message?.contact?.name ?? "Contato") +
                              "*_ reagiu... "}
                          </MarkdownWrapper>
                          <Badge
                            className={classes.badge}
                            overlap="circular"
                            anchorOrigin={{
                              vertical: "bottom",
                              horizontal: "right",
                            }}
                            badgeContent={
                              <span
                                style={{
                                  fontSize: "1.2em",
                                  marginTop: "0",
                                  marginLeft: "5px",
                                }}
                              >
                                {message.body}
                              </span>
                            }
                          ></Badge>
                        </span>
                      </>
                    )}

                  <span className={classes.timestamp}>
                    {message.isEdited
                      ? "Editada " +
                        format(parseISO(message.createdAt), "HH:mm")
                      : format(parseISO(message.createdAt), "HH:mm")}
                  </span>
                </div>
              </div>
            </React.Fragment>
          );
        } else {
          return (
            <React.Fragment key={message.id}>
              {renderDailyTimestamps(message, index)}
              {renderNumberTicket(message, index)}
              {renderMessageDivider(message, index)}
              <div
                className={classes.messageRight}
                onDoubleClick={(e) => hanldeReplyMessage(e, message)}
              >
                {showSelectMessageCheckbox && (
                  <SelectMessageCheckbox
                    // showSelectMessageCheckbox={showSelectMessageCheckbox}
                    message={message}
                    // selectedMessagesList={selectedMessagesList}
                    // setSelectedMessagesList={setSelectedMessagesList}
                  />
                )}
                <IconButton
                  variant="contained"
                  size="small"
                  id="messageActionsButton"
                  disabled={message.isDeleted}
                  className={classes.messageActionsButton}
                  onClick={(e) => handleOpenMessageOptionsMenu(e, message)}
                >
                  <ExpandMore />
                </IconButton>
                {message.isForwarded && (
                  <div>
                    <span className={classes.forwardMessage}>
                      <Reply
                        style={{ color: "grey", transform: "scaleX(-1)" }}
                      />{" "}
                      Encaminhada
                    </span>
                    <br />
                  </div>
                )}
                {(message.mediaUrl ||
                  message.mediaType === "locationMessage" ||
                  message.mediaType === "vcard" ||
                  message.mediaType === "contactMessage") &&
                  //|| message.mediaType === "multi_vcard"
                  checkMessageMedia(message)}
                <div
                  className={clsx(classes.textContentItem, {
                    [classes.textContentItemDeleted]: message.isDeleted,
                  })}
                >
                  {message.isDeleted && (
                    <Block
                      color="disabled"
                      fontSize="small"
                      className={classes.deletedIcon}
                    />
                  )}
                  {message.quotedMsg && renderQuotedMessage(message)}
                  {message.mediaType !== "reactionMessage" &&
                    message.mediaType !== "locationMessage" && (
                      <MarkdownWrapper>{message.body}</MarkdownWrapper>
                    )}
                  {message.quotedMsg &&
                    message.mediaType === "reactionMessage" &&
                    message.body && (
                      <>
                        <span
                          style={{
                            marginLeft: "0px",
                            display: "flex",
                            alignItems: "center",
                          }}
                        >
                          <MarkdownWrapper>
                            {"_*" +
                              (message.fromMe
                                ? "Você"
                                : message?.contact?.name ?? "Contato") +
                              "*_ reagiu... "}
                          </MarkdownWrapper>
                          <Badge
                            className={classes.badge}
                            overlap="circular"
                            anchorOrigin={{
                              vertical: "bottom",
                              horizontal: "right",
                            }}
                            badgeContent={
                              <span
                                style={{
                                  fontSize: "1.2em",
                                  marginTop: "0",
                                  marginLeft: "5px",
                                }}
                              >
                                {message.body}
                              </span>
                            }
                          ></Badge>
                        </span>
                      </>
                    )}

                  <span className={classes.timestamp}>
                    {message.isEdited
                      ? "Editada " +
                        format(parseISO(message.createdAt), "HH:mm")
                      : format(parseISO(message.createdAt), "HH:mm")}
                    {renderMessageAck(message)}
                  </span>
                </div>
              </div>
            </React.Fragment>
          );
        }
      });
      return viewMessagesList;
    } else {
      return <div>Diga olá para seu novo contato!</div>;
    }
  };

  return (
    <div className={classes.messagesListWrapper}>
      <MessageOptionsMenu
        message={selectedMessage}
        anchorEl={anchorEl}
        menuOpen={messageOptionsMenuOpen}
        handleClose={handleCloseMessageOptionsMenu}
      />
      <div
        id="messagesList"
        className={classes.messagesList}
        onScroll={handleScroll}
      >
        {messagesList.length > 0 ? renderMessages() : []}
        {contactPresence === "composing" && (
          <div className={classes.messageLeft}>
            <div className={classes.wave}>
              <span className={classes.dot}></span>
              <span className={classes.dot}></span>
              <span className={classes.dot}></span>
            </div>
          </div>
        )}
        {contactPresence === "recording" && (
          <div className={classes.messageLeft}>
            <div className={classes.wavebarsContainer}>
              <div className={clsx(classes.wavebars, classes.wavebar1)}></div>
              <div className={clsx(classes.wavebars, classes.wavebar2)}></div>
              <div className={clsx(classes.wavebars, classes.wavebar3)}></div>
              <div className={clsx(classes.wavebars, classes.wavebar4)}></div>
              <div className={clsx(classes.wavebars, classes.wavebar5)}></div>
            </div>
          </div>
        )}
      </div>
      {loading && (
        <div>
          <CircularProgress className={classes.circleLoading} />
        </div>
      )}
    </div>
  );
};

export default MessagesList;
