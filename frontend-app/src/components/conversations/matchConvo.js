import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import SideBar from '../layout/sideBar';

const MatchConvo = () => {
  const { matchId } = useParams();
  const navigate = useNavigate();
  const API_BASE_URL = process.env.REACT_APP_API_BASE_URL;
  const token = localStorage.getItem("token");
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newMessageText, setNewMessageText] = useState("");

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
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchConversation();
  }, [matchId]);

  const sendMessage = async () => {
    if (!newMessageText.trim()) return;
    try {
      const res = await fetch(`${API_BASE_URL}/conversation/${matchId}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ message: newMessageText.trim() }),
      });

      if (res.ok || res.status === 201) {
        let data = await res.json();
        setMessages(data.messages || []);
        setNewMessageText("");
      }
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) return <p>Loading conversation...</p>;

  return (
    <div>
        <SideBar />
        <div style={{ padding: "20px" }}>
        <button onClick={() => navigate("/conversations")}>⬅ Back</button>
        <h2>Conversation with Match {matchId}</h2>

        {messages.length === 0 ? (
            <p>No messages yet. Say hi!</p>
        ) : (
            <div style={{ maxHeight: "300px", overflowY: "auto" }}>
            {messages.map((msg) => (
                <div key={msg.id} style={{ marginBottom: "10px" }}>
                <strong>{msg.sender_id === matchId ? "You" : "Them"}: </strong>
                {msg.text}
                <div style={{ fontSize: "12px", color: "gray" }}>
                    {new Date(msg.timestamp).toLocaleString()}
                </div>
                </div>
            ))}
            </div>
        )}

        <textarea
            value={newMessageText}
            onChange={(e) => setNewMessageText(e.target.value)}
            rows={3}
            style={{ width: "100%" }}
        />
        <button onClick={sendMessage} disabled={!newMessageText.trim()}>
            Send
        </button>
        </div>
    </div>
  );
};

export default MatchConvo;
