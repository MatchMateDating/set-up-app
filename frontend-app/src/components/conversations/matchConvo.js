import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import SideBar from '../layout/sideBar';
import { useUserInfo } from './hooks/useUserInfo';
import SendPuzzle from "./conversationPuzzle";
import './matchConvo.css';
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
          if (data.error_code === 'TOKEN_EXPIRED') {
            localStorage.removeItem('token');
            window.location.href = '/';
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
      const uniqueIds = [...new Set(messages.map(m => m.sender_id))];
      const names = {};
      const roles = {};
      for (const id of uniqueIds) {
        try {
          const token = localStorage.getItem("token");
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
        let data = await res.json();
        setMessages(data.messages || []);
        setNewMessageText("");
        setSendPuzzle(false);
      } else if (res.status === 401) {
        const data = await res.json();
        if (data.error_code === "TOKEN_EXPIRED") {
          localStorage.removeItem("token");
          window.location.href = "/";
        }
      } else {
        console.error("Failed to send message or puzzle");
      }
    } catch (err) {
      console.error(err);
    }
  };


  const handlePuzzleClick = (puzzleLink) => {
    localStorage.setItem("activeMatchId", matchId);
    if (puzzleLink) {
      navigate(puzzleLink);
    }
  };

  const getSenderLabel = (msg) => {
    if (userInfo?.role === "user") {
      if (msg.sender_id === userInfo?.id) return "Me";
      if (senderRoles[msg.sender_id] === "user") return "Them";
      if (senderRoles[msg.sender_id] === "matchmaker") return "Matchmaker";
    } else if (userInfo?.role === "matchmaker") {
      if (msg.sender_id == userInfo?.id) return "Me";
      return senderNames[msg.sender_id] || "Loading...";
    }
    return "Unknown";
  };

  if (loading) return <p>Loading conversation...</p>;

  return (
    <div>
      <SideBar />
      <div className="match-convo-container">
        <button className="back-button" onClick={() => navigate("/conversations")}>⬅ Back</button>
        <h2 className="convo-title">Conversation with Match {matchId}</h2>

        {messages.length === 0 ? (
          <p>No messages yet. Say hi!</p>
        ) : (
          <div className="messages-box">
            {messages.map((msg) => (
              <div key={msg.id} className="message-item">
                <strong>{getSenderLabel(msg)}: </strong>
                {msg.text && <>{msg.text}</>}
                {msg.puzzle_type && (
                  <>
                    {msg.text && <div></div>}
                    <button
                      className="puzzle-button"
                      onClick={() => handlePuzzleClick(msg.puzzle_link)}
                    >
                      Let’s Play {msg.puzzle_type}!
                    </button>
                  </>
                )}
                <div className="timestamp">
                  {new Date(msg.timestamp).toLocaleString()}
                </div>
              </div>
            ))}
          </div>

        )}

        {sendPuzzle && (
          <SendPuzzle
            selectedPuzzleType={selectedPuzzleType}
            selectedPuzzleLink={selectedPuzzleLink}
            onPuzzleChange={(name, link) => {
              setSelectedPuzzleType(name);
              setSelectedPuzzleLink(link);
            }}
            onClose={() => setSendPuzzle(false)} // parent toggles boolean
          />
        )}
        {userInfo?.role != "matchmaker" && (
          <textarea
            value={newMessageText}
            onChange={(e) => setNewMessageText(e.target.value)}
            rows={3}
            className="message-input"
          />
        )}
        <div className="send-actions">
          <button
            className="send-convo-button"
            onClick={sendMessage}
            disabled={!newMessageText.trim() && !sendPuzzle}
          >
            Send
          </button>

          {!sendPuzzle && (
            <button className="send-puzzle-button" onClick={() => setSendPuzzle(true)}>
              Send Puzzle
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default MatchConvo;