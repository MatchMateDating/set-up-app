import React, { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import SideBar from "../layout/sideBar";
import { useUserInfo } from "./hooks/useUserInfo";
import SendPuzzle from "./conversationPuzzle";
import "./matchConvo.css";
import { games } from "../puzzles/puzzlesPage";

const MatchConvo = () => {
  const { matchId } = useParams();
  const navigate = useNavigate();
  const API_BASE_URL = process.env.REACT_APP_API_BASE_URL;
  const token = localStorage.getItem("token");
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newMessageText, setNewMessageText] = useState("");
  const { userInfo } = useUserInfo(API_BASE_URL);
  const [sendPuzzle, setSendPuzzle] = useState(false);
  const [selectedPuzzleType, setSelectedPuzzleType] = useState(games[0].name);
  const [selectedPuzzleLink, setSelectedPuzzleLink] = useState(games[0].path);
  const [senderNames, setSenderNames] = useState({});
  const [senderRoles, setSenderRoles] = useState({});
  const [matchUser, setMatchUser] = useState(null);
  const [matchInfo, setMatchInfo] = useState(null);

  const messagesEndRef = useRef(null);

  useEffect(() => {
    const fetchConversation = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/conversation/${matchId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          let data = await res.json();
          if (data.length > 0) data = data[0].messages;
          setMessages(data || []);
        }
        if (res.status === 401) {
          const data = await res.json();
          if (data.error_code === "TOKEN_EXPIRED") {
            localStorage.removeItem("token");
            window.location.href = "/";
          }
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchConversation();
  }, [matchId]);

  useEffect(() => {
    const fetchNames = async () => {
      const uniqueIds = [...new Set(messages.map((m) => m.sender_id))];
      const names = {};
      const roles = {};
      for (const id of uniqueIds) {
        try {
          const res = await fetch(`${API_BASE_URL}/profile/${id}`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (res.ok) {
            const data = await res.json();
            names[id] = data.first_name;
            roles[id] = data.role;
          }
        } catch (err) {
          console.error("Error fetching sender name:", err);
        }
      }
      setSenderNames(names);
      setSenderRoles(roles);
    };
    fetchNames();
  }, [messages, userInfo]);

  useEffect(() => {
    const fetchMatchUser = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/match/matches`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          // Handle new structure: {matched: [], pending_approval: []}
          const allMatches = Array.isArray(data) ? data : [...(data.matched || []), ...(data.pending_approval || [])];
          const matchInfo = allMatches.find((m) => m.match_id === Number(matchId));
          if (matchInfo) {
            setMatchUser(matchInfo.match_user);
            setMatchInfo(matchInfo);
          }
        }
      } catch (err) {
        console.error("Error fetching match user:", err);
      }
    };
    fetchMatchUser();
  }, [matchId]);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  const sendMessage = async () => {
    if (!newMessageText.trim() && !sendPuzzle) return;
    try {
      const bodyData = {};
      if (newMessageText.trim()) bodyData.message = newMessageText.trim();
      if (sendPuzzle) {
        bodyData.puzzle_type = selectedPuzzleType;
        bodyData.puzzle_link = selectedPuzzleLink;
      }

      const res = await fetch(`${API_BASE_URL}/conversation/${matchId}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(bodyData),
      });

      if (res.ok || res.status === 201) {
        const data = await res.json();
        setMessages(data.messages || []);
        setNewMessageText("");
        setSendPuzzle(false);
        // Refresh match info to get updated message count
        if (matchId) {
          const matchRes = await fetch(`${API_BASE_URL}/match/matches`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (matchRes.ok) {
            const matchData = await matchRes.json();
            const allMatches = Array.isArray(matchData) ? matchData : [...(matchData.matched || []), ...(matchData.pending_approval || [])];
            const updatedMatch = allMatches.find((m) => m.match_id === Number(matchId));
            if (updatedMatch) setMatchInfo(updatedMatch);
          }
        }
      } else {
        const errorData = await res.json().catch(() => ({}));
        alert(errorData.error || 'Failed to send message');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handlePuzzleClick = (puzzleLink) => {
    localStorage.setItem("activeMatchId", matchId);
    if (puzzleLink) navigate(puzzleLink);
  };

  const isMine = (msg) => msg.sender_id === userInfo?.id;

  const getSenderLabel = (msg) => {
    if (isMine(msg)) return "";

    const senderRole = senderRoles[msg.sender_id];
    const senderName = senderNames[msg.sender_id] || "Loading...";

    if (senderRole === "matchmaker") {
      if (userInfo?.role === "user") return "Matchmaker";
      return senderName;
    }

    return senderName;
  };

  const handleApprove = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/match/approve/${matchId}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        alert('Match approved successfully');
        // Refresh match info
        const matchRes = await fetch(`${API_BASE_URL}/match/matches`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (matchRes.ok) {
          const matchData = await matchRes.json();
          const allMatches = Array.isArray(matchData) ? matchData : [...(matchData.matched || []), ...(matchData.pending_approval || [])];
          const updatedMatch = allMatches.find((m) => m.match_id === Number(matchId));
          if (updatedMatch) {
            setMatchInfo(updatedMatch);
            // Navigate back to conversations
            navigate('/conversations');
          }
        }
      } else {
        const data = await res.json();
        alert(data.message || 'Failed to approve match');
      }
    } catch (err) {
      console.error(err);
      alert('Failed to approve match');
    }
  };

  const isPendingApproval = matchInfo?.status === 'pending_approval' || matchInfo?.message_count !== undefined;
  const messageCount = matchInfo?.message_count || 0;
  const canSendMore = messageCount < 10;
  const waitingForOtherApproval = matchInfo?.waiting_for_other_approval || false;

  if (loading) return <p>Loading conversation...</p>;

  return (
    <div>
      <SideBar />
      <div className="match-convo-container">
        <button className="back-button" onClick={() => navigate("/conversations")}>
          ⬅ Back
        </button>

        {matchUser && (
          <div className="match-avatar-section">
            <div
              className="match-avatar"
              onClick={() => navigate(`/profile/${matchUser?.id}`)}
              style={{ cursor: "pointer" }}
            >
              {matchUser?.first_image ? (
                <img
                  src={matchUser.first_image.startsWith("http")
                    ? matchUser.first_image
                    : `${API_BASE_URL}${matchUser.first_image}`}
                  alt={matchUser.first_name}
                  className="match-avatar-img"
                />
              ) : (
                <div className="match-placeholder">{matchUser?.first_name?.[0] || "?"}</div>
              )}
            </div>
            <h2 className="convo-title">
              {matchUser.first_name || `Match ${matchId}`}
            </h2>
          </div>
        )}

        <div className="messages-box">
          {messages.length === 0 ? (
            <p>No messages yet. Say hi!</p>
          ) : (
            messages.map((msg) => {
              const mine = isMine(msg);
              const senderLabel = getSenderLabel(msg);

              return (
                <div
                  key={msg.id}
                  className={`message-bubble ${mine ? "mine" : "theirs"}`}
                >
                  {!mine && <div className="sender-label">{senderLabel}</div>}
                  {msg.text && <p className="message-text">{msg.text}</p>}
                  {msg.puzzle_type && (
                    <button
                      className="puzzle-bubble"
                      onClick={() => handlePuzzleClick(msg.puzzle_link)}
                    >
                      🎮 Play {msg.puzzle_type}
                    </button>
                  )}
                  <span className="timestamp">
                    {new Date(msg.timestamp).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {sendPuzzle && (
          <SendPuzzle
            selectedPuzzleType={selectedPuzzleType}
            selectedPuzzleLink={selectedPuzzleLink}
            onPuzzleChange={(name, link) => {
              setSelectedPuzzleType(name);
              setSelectedPuzzleLink(link);
            }}
            onClose={() => setSendPuzzle(false)}
          />
        )}

        {/* Message count and approve button for matchmakers */}
        {userInfo?.role === 'matchmaker' && isPendingApproval && (
          <div className="pending-approval-info">
            <p className="message-count-text">Messages: {messageCount}/10</p>
            {!canSendMore && (
              <p className="limit-reached-text">Message limit reached. Please approve to continue.</p>
            )}
            <button className="approve-button" onClick={handleApprove}>
              Approve Match
            </button>
          </div>
        )}

        {/* Message input for matchmakers when pending approval and under limit and not waiting */}
        {userInfo?.role === 'matchmaker' && isPendingApproval && canSendMore && !waitingForOtherApproval && (
          <textarea
            value={newMessageText}
            onChange={(e) => setNewMessageText(e.target.value)}
            rows={3}
            className="message-input"
            placeholder="Type a message..."
          />
        )}

        {userInfo?.role !== "matchmaker" && (
          <textarea
            value={newMessageText}
            onChange={(e) => setNewMessageText(e.target.value)}
            rows={3}
            className="message-input"
            placeholder="Type a message..."
          />
        )}

        <div className="send-actions">
          <button
            className="send-convo-button"
            onClick={sendMessage}
            disabled={(!newMessageText.trim() && !sendPuzzle) || (userInfo?.role === 'matchmaker' && isPendingApproval && (!canSendMore || waitingForOtherApproval))}
          >
            Send
          </button>

          {!sendPuzzle && (
            <button
              className="send-puzzle-button"
              onClick={() => setSendPuzzle(true)}
            >
              Send Puzzle
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default MatchConvo;