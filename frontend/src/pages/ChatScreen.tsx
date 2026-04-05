import { useEffect, useState, useRef } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { ArrowLeft, Send, Handshake } from 'lucide-react';
import { apiClient } from '../api/client';
import { useAuth } from '../store/AuthContext';

interface Message {
  id: string;
  sender_id: string;
  recipient_id: string;
  body: string;
  sent_at: string;
}

const ChatScreen = () => {
  const navigate  = useNavigate();
  const location  = useLocation();
  const { contextId } = useParams();
  const { user, token: authToken } = useAuth();
  const { recipientId, equipment } = (location.state as { recipientId?: string; equipment?: string }) ?? {};

  const [messages, setMessages] = useState<Message[]>([]);
  const [inputStr, setInputStr] = useState('');
  const wsRef = useRef<WebSocket | null>(null);

  const myUserId = user?.id || '';

  useEffect(() => {
    if (!contextId) return;

    const token = authToken || localStorage.getItem('jwt_token');
    if (!token) return;

    // Load initial messages
    apiClient.get(`/messages/${contextId}`)
      .then(res => setMessages(res.data.messages || []))
      .catch(console.error);

    // Initialize WebSocket
    const backendUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';
    const wsUrl = backendUrl.replace('http', 'ws') + `/ws?token=${token}`;
    
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('WS connected. Joining chat room:', contextId);
      ws.send(JSON.stringify({ event: 'join_chat', data: { contextId } }));
    };

    ws.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (payload.event === 'message') {
          setMessages(prev => [...prev, payload.data]);
        }
      } catch (err) {
        console.error('Failed to parse WS message', err);
      }
    };

    const pingInterval = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ event: 'ping' }));
      }
    }, 25000);

    return () => {
      clearInterval(pingInterval);
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ event: 'leave_chat', data: { contextId } }));
        ws.close();
      }
    };
  }, [contextId]);

  const handleSend = async () => {
    if (!inputStr.trim() || !contextId) return;

    const body = inputStr.trim();
    setInputStr(''); // clear optimistic

    if (!recipientId) {
      console.warn('No recipientId in state — cannot send message');
      return;
    }

    try {
      await apiClient.post('/messages', {
        request_id:   contextId,
        recipient_id: recipientId,
        body,
      });
      // The WS will broadcast it back to us, no need to manually append if it works.
      // But we can optimistically append just in case it fails.
      const optMsg: Message = {
        id:           Date.now().toString(),
        sender_id:    myUserId,
        recipient_id: recipientId,
        body,
        sent_at:      new Date().toISOString(),
      };
      setMessages(prev => [...prev, optMsg]);
    } catch (err) {
      console.error('Failed to send message', err);
    }
  };

  return (
    <div className="flex flex-col h-full bg-bg-primary">
      {/* Header */}
      <div className="flex justify-between items-center px-4 py-4 border-b border-gray-800 bg-bg-secondary/80 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)}>
            <ArrowLeft size={24} className="text-white" />
          </button>
          <div>
            <h2 className="font-bold text-lg leading-tight">{equipment ?? 'Chat'}</h2>
            <span className="text-xs text-urgency-emergency font-bold uppercase tracking-wider">Active</span>
          </div>
        </div>
        <button onClick={() => navigate('/transaction')} className="p-2 bg-green-500/20 text-green-400 rounded-full border border-green-500/30">
          <Handshake size={20} />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
           <p className="text-center text-sm text-secondary pt-8">No messages yet. Say hi!</p>
        ) : (
          messages.map(msg => {
            const isMe = msg.sender_id === myUserId;
            return (
              <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                <div className={`
                  rounded-2xl px-4 py-2 max-w-[80%] text-sm
                  ${isMe 
                    ? 'bg-accent-cyan/20 border border-accent-cyan/30 text-white rounded-tr-sm' 
                    : 'bg-gray-800 rounded-tl-sm'
                  }
                `}>
                  <p>{msg.body}</p>
                  <span className={`text-[10px] block mt-1 ${isMe ? 'text-cyan-200/50 text-right' : 'text-muted'}`}>
                    {new Date(msg.sent_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Input */}
      <div className="p-4 bg-bg-secondary border-t border-gray-800 flex items-center gap-3 pb-8">
        <div className="flex-1 bg-gray-800 rounded-full border border-gray-700 px-4 py-3">
          <input 
            type="text" 
            placeholder="Type a message..." 
            className="w-full bg-transparent outline-none text-sm text-white"
            value={inputStr}
            onChange={e => setInputStr(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSend()}
          />
        </div>
        <button 
          onClick={handleSend}
          disabled={!inputStr.trim()}
          className="w-12 h-12 rounded-full bg-accent-cyan flex justify-center items-center text-black disabled:opacity-50"
        >
          <Send size={18} />
        </button>
      </div>
    </div>
  );
};

export default ChatScreen;
