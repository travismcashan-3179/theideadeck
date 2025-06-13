import React, { useState, useRef, useEffect, useLayoutEffect } from 'react';
import TinderCard from 'react-tinder-card';
import { Swiper, SwiperSlide } from 'swiper/react';
import 'swiper/css';
import './ChatGilbot.css';
import Settings from './Settings';

const BOT_AVATAR = (
  <span className="gilbot-avatar" aria-label="Gilbot">🤖</span>
);

const WELCOME = [
  { sender: 'agent', text: '👋 Hi! I am LinkedList, your friendly LinkedIn idea assistant. How can I help you today?' }
];

const POST_TYPES = ["", "Story", "How-to", "List", "Question", "Announcement", "Opinion", "Inspire", "Collab"];
const CONTENT_TOPICS = ["", "Leadership", "Career", "Productivity", "Trends", "Culture", "AI", "Marketing", "Branding"];
const INTENTS = ["", "Inspire", "Educate", "Engage", "Promote", "Network", "Entertain"];

function formatDate(ts) {
  return new Date(ts).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
}

function getImageUrl(url) {
  if (!url) return '';
  if (url.startsWith('/uploads/')) {
    // Use backend server in dev
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      return `http://localhost:3001${url}`;
    }
  }
  return url;
}

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'https://your-backend-url.com'; // TODO: Replace with your actual backend URL
function getApiUrl(path) {
  return `${BACKEND_URL}${path}`;
}

export default function App() {
  const initialTab = (window.location.pathname.replace(/^\//, '') === 'ideas') ? 'ideas' : 'chat';
  const [tab, setTab] = useState(initialTab);
  const [messages, setMessages] = useState(WELCOME);
  const [input, setInput] = useState('');
  const [ideas, setIdeas] = useState([]);
  const chatRef = useRef(null);
  const bottomRef = useRef(null);
  const [inputRows, setInputRows] = useState(1);
  const maxRows = 6;
  const [loading, setLoading] = useState(false);
  const GIPHY_API_KEY = 'XwAt1owQmteKWjXVsIZUUtZG7dr7jaG4'; // user key
  const GIPHY_KEYWORDS = ['waiting', 'loading', 'funny', 'dog waiting', 'cat waiting', 'tapping fingers', 'impatient', 'bored', 'looking out window'];
  const lastWaitingMsgId = useRef(null);
  const [recording, setRecording] = useState(false);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const [filterPostType, setFilterPostType] = useState("");
  const [filterContentTopic, setFilterContentTopic] = useState("");
  const [filterIntent, setFilterIntent] = useState("");
  const [detailIdea, setDetailIdea] = useState(null);
  const [draggedCard, setDraggedCard] = useState(null);
  const [ideasView, setIdeasView] = useState('grid');
  const [groupBy, setGroupBy] = useState('none');
  const [editingTitleId, setEditingTitleId] = useState(null);
  const [dragOverId, setDragOverId] = useState(null);
  const [error, setError] = useState("");
  const [navOpen, setNavOpen] = useState(false);
  const [isUserScrolledUp, setIsUserScrolledUp] = useState(false);
  const [settings, setSettings] = useState({});

  // Load chat history on mount
  useEffect(() => {
    async function loadChat() {
      try {
        const res = await fetch(getApiUrl('/chat'));
        if (!res.ok) throw new Error('Failed to load chat');
        const chat = await res.json();
        console.log('Fetched chat from backend:', chat);
        setMessages(chat);
      } catch (err) {
        setError('Failed to load chat.');
      }
    }
    if (tab === 'chat') loadChat();
  }, [tab]);

  useEffect(() => {
    if (tab === 'ideas') {
      async function loadIdeas() {
        try {
          const res = await fetch(getApiUrl('/ideas'));
          if (!res.ok) throw new Error('Failed to load ideas');
          const fetchedIdeas = await res.json();
          const ideasWithEdit = fetchedIdeas.map((idea, idx, arr) => {
            if (!idea.type && !idea.topic && !idea.intent) {
              return { ...idea, _editingMeta: true };
            }
            return idea;
          });
          setIdeas(ideasWithEdit);
        } catch (err) {
          setError('Failed to load ideas.');
        }
      }
      loadIdeas();
    }
  }, [tab]);

  useEffect(() => {
    chatRef.current?.scrollTo(0, chatRef.current.scrollHeight);
  }, [messages, tab]);

  // Scroll to bottom using anchor unless user has scrolled up
  useEffect(() => {
    if (!isUserScrolledUp && tab === 'chat' && bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'auto' });
    }
  }, [messages, tab, isUserScrolledUp]);

  // Detect if user scrolls up in chat
  useEffect(() => {
    if (tab !== 'chat') return;
    const chatList = chatRef.current;
    if (!chatList) return;
    const handleScroll = () => {
      // If user is near the bottom (within 40px), consider as not scrolled up
      const atBottom = chatList.scrollHeight - chatList.scrollTop - chatList.clientHeight < 40;
      setIsUserScrolledUp(!atBottom);
    };
    chatList.addEventListener('scroll', handleScroll);
    return () => chatList.removeEventListener('scroll', handleScroll);
  }, [tab]);

  // On initial mount or tab switch to chat, scroll to bottom immediately
  useLayoutEffect(() => {
    if (tab === 'chat' && bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'auto' });
    }
  }, [tab]);

  const handleInputChange = (e) => {
    setInput(e.target.value);
    // Auto-expand textarea up to maxRows
    const lines = e.target.value.split('\n').length;
    setInputRows(Math.min(maxRows, Math.max(1, lines)));
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  async function fetchRandomLoadingGif() {
    const keyword = GIPHY_KEYWORDS[Math.floor(Math.random() * GIPHY_KEYWORDS.length)];
    try {
      const res = await fetch(`https://api.giphy.com/v1/gifs/search?api_key=${GIPHY_API_KEY}&q=${encodeURIComponent(keyword)}&limit=25&rating=pg`);
      const data = await res.json();
      if (data.data && data.data.length > 0) {
        const gif = data.data[Math.floor(Math.random() * data.data.length)];
        return gif.images.fixed_height.url;
      } else {
        return 'https://media.giphy.com/media/3oEjI6SIIHBdRxXI40/giphy.gif'; // fallback
      }
    } catch {
      return 'https://media.giphy.com/media/3oEjI6SIIHBdRxXI40/giphy.gif';
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!input.trim()) return;
    setLoading(true);
    setError("");
    const now = Date.now();
    const userMsg = { sender: 'user', text: input, createdAt: new Date(now).toISOString() };
    setInput('');
    try {
      // 1. POST user message
      let res = await fetch(getApiUrl('/chat'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userMsg)
      });
      if (!res.ok) throw new Error('Failed to send message');

      // 2. Fetch GIPHY and POST loader
      const gifUrl = await fetchRandomLoadingGif();
      const waitingMsg = { sender: 'agent', type: 'loadingGif', gif: gifUrl, text: '[GIPHY_WAITING]', createdAt: new Date(now + 1).toISOString() };
      res = await fetch(getApiUrl('/chat'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(waitingMsg)
      });
      if (!res.ok) throw new Error('Failed to send loading message');

      // 3. Reload chat history
      res = await fetch(getApiUrl('/chat'));
      if (!res.ok) throw new Error('Failed to reload chat history');
      let history = await res.json();
      if (history && history.length > 0) {
        history.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
        setMessages(history);
      }

      // 4. Get AI reply
      res = await fetch(getApiUrl('/agent'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMsg.text })
      });
      if (!res.ok) throw new Error('Failed to get AI reply');
      await res.json();

      // 5. Reload chat history again
      res = await fetch(getApiUrl('/chat'));
      if (!res.ok) throw new Error('Failed to reload chat history');
      history = await res.json();
      if (history && history.length > 0) {
        history.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
        setMessages(history);
      }
      setLoading(false);
    } catch (err) {
      setLoading(false);
      setError(err.message || 'Sorry, something went wrong.');
      setMessages(msgs => [
        ...msgs,
        { sender: 'agent', text: 'Sorry, something went wrong.' }
      ]);
    }
  };

  const markUsed = async (id) => {
    try {
      const res = await fetch(getApiUrl(`/ideas/${id}/used`), { method: 'PUT' });
      if (!res.ok) throw new Error('Failed to mark as used');
      setIdeas(ideas => ideas.map(idea => idea.id === id ? { ...idea, used: true } : idea));
    } catch (err) {
      setError('Failed to mark idea as used.');
    }
  };
  const deleteIdea = async (id) => {
    try {
      const res = await fetch(getApiUrl(`/ideas/${id}`), { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete idea');
      setIdeas(ideas => ideas.filter(idea => idea.id !== id));
    } catch (err) {
      setError('Failed to delete idea.');
    }
  };

  const handleMicClick = async () => {
    if (recording) {
      // Stop recording
      mediaRecorderRef.current.stop();
      setRecording(false);
    } else {
      // Start recording
      if (!navigator.mediaDevices || !window.MediaRecorder) {
        alert('Audio recording not supported in this browser.');
        return;
      }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported('audio/wav')
        ? 'audio/wav'
        : MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
          ? 'audio/webm;codecs=opus'
          : MediaRecorder.isTypeSupported('audio/webm')
            ? 'audio/webm'
            : '';
      const mediaRecorder = new window.MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };
      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType || 'audio/webm' });
        const fileExt = mimeType === 'audio/wav' ? 'wav' : 'webm';
        const formData = new FormData();
        formData.append('audio', audioBlob, `recording.${fileExt}`);
        setLoading(true);
        try {
          const res = await fetch(getApiUrl('/transcribe'), {
            method: 'POST',
            body: formData
          });
          const data = await res.json();
          if (data.text) setInput(input + (input ? '\n' : '') + data.text);
        } catch (err) {
          alert('Transcription failed.');
        }
        setLoading(false);
      };
      mediaRecorder.start();
      setRecording(true);
    }
  };

  // Filter ideas based on selected filters
  const filteredIdeas = ideas.filter(idea => {
    return (
      (!filterPostType || idea.type === filterPostType) &&
      (!filterContentTopic || idea.topic === filterContentTopic) &&
      (!filterIntent || idea.intent === filterIntent)
    );
  });

  // Helper: get counts for each meta value, from a given list
  function getMetaCounts(field, list) {
    const counts = {};
    list.forEach(idea => {
      const val = idea[field] || '';
      counts[val] = (counts[val] || 0) + 1;
    });
    return counts;
  }

  // Helper: get sorted options for dropdowns, from a given list
  function getSortedOptions(options, field, isFilter, list) {
    const counts = getMetaCounts(field, list);
    const nonEmpty = options.filter(opt => opt);
    const withCount = nonEmpty.filter(opt => (counts[opt] || 0) > 0);
    const zeroCount = nonEmpty.filter(opt => (counts[opt] || 0) === 0);
    withCount.sort((a, b) => {
      const diff = (counts[b] || 0) - (counts[a] || 0);
      if (diff !== 0) return diff;
      return a.localeCompare(b);
    });
    zeroCount.sort((a, b) => a.localeCompare(b));
    return (isFilter ? [''] : ['']).concat(withCount, zeroCount);
  }

  // Compute filtered ideas for each filter context
  // For each filter, compute the ideas that would be shown if only that filter was applied
  const ideasForType = ideas.filter(idea =>
    (!filterContentTopic || idea.topic === filterContentTopic) &&
    (!filterIntent || idea.intent === filterIntent)
  );
  const ideasForTopic = ideas.filter(idea =>
    (!filterPostType || idea.type === filterPostType) &&
    (!filterIntent || idea.intent === filterIntent)
  );
  const ideasForIntent = ideas.filter(idea =>
    (!filterPostType || idea.type === filterPostType) &&
    (!filterContentTopic || idea.topic === filterContentTopic)
  );

  // Sync tab with URL
  useEffect(() => {
    const path = window.location.pathname.replace(/^\//, '');
    if (path === 'ideas' || path === 'chat') {
      setTab(path);
    }
    const onPopState = () => {
      const newPath = window.location.pathname.replace(/^\//, '');
      if (newPath === 'ideas' || newPath === 'chat') {
        setTab(newPath);
      }
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  useEffect(() => {
    if (window.location.pathname !== `/${tab}`) {
      window.history.pushState({}, '', `/${tab}`);
    }
  }, [tab]);

  // Grouping logic before rendering
  function groupIdeas(ideas, groupBy, orderArr) {
    if (groupBy === 'none') return [{ group: null, items: ideas }];
    const groups = {};
    ideas.forEach(idea => {
      const key = idea[groupBy] || '(None)';
      if (!groups[key]) groups[key] = [];
      groups[key].push(idea);
    });
    // Sort groups by count (desc), then orderArr, then alphabetically
    const groupKeys = Object.keys(groups);
    groupKeys.sort((a, b) => {
      const countDiff = groups[b].length - groups[a].length;
      if (countDiff !== 0) return countDiff;
      const aIdx = orderArr.indexOf(a);
      const bIdx = orderArr.indexOf(b);
      if (aIdx !== -1 && bIdx !== -1) return aIdx - bIdx;
      if (aIdx !== -1) return -1;
      if (bIdx !== -1) return 1;
      return a.localeCompare(b);
    });
    return groupKeys.map(key => ({ group: key, items: groups[key] }));
  }
  const groupOrder = groupBy === 'type' ? POST_TYPES : groupBy === 'topic' ? CONTENT_TOPICS : groupBy === 'intent' ? INTENTS : [];
  const groupedIdeas = groupIdeas(filteredIdeas, groupBy, groupOrder);

  async function handleImageDrop(e, idea) {
    e.preventDefault();
    setDragOverId(null);
    const file = e.dataTransfer.files && e.dataTransfer.files[0];
    if (!file || !file.type.startsWith('image/')) return;
    const formData = new FormData();
    formData.append('image', file);
    try {
      const res = await fetch(getApiUrl(`/ideas/${idea.id}/image`), {
        method: 'POST',
        body: formData
      });
      if (res.ok) {
        const data = await res.json();
        setIdeas(prev => prev.map(idObj => idObj.id === idea.id ? { ...idObj, imageUrl: data.imageUrl } : idObj));
      } else {
        setError('Image upload failed.');
      }
    } catch (err) {
      setError('Image upload failed.');
    }
  }

  // Add logging for rendered messages
  useEffect(() => {
    if (tab === 'chat') {
      console.log('Messages rendered in chat UI:', messages);
    }
  }, [messages, tab]);

  return (
    <div id="gilbot-chat-root">
      {/* Floating Hamburger Button */}
      <button
        className={`gilbot-hamburger${navOpen ? ' open' : ''}`}
        onClick={() => setNavOpen(!navOpen)}
        aria-label={navOpen ? 'Close navigation' : 'Open navigation'}
        style={{
          position: 'fixed',
          top: 24,
          right: 32,
          zIndex: 2001,
          background: '#fff',
          border: 'none',
          borderRadius: 12,
          boxShadow: '0 2px 8px #e7e7fa',
          width: 48,
          height: 48,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
        }}
      >
        <span className="hamburger-icon" style={{ position: 'relative', width: 28, height: 28, display: 'block' }}>
          {/* Hamburger lines */}
          <span className="bar bar1" style={{ position: 'absolute', left: 0, width: 28, height: 3.5, borderRadius: 2, background: '#343794', top: 3, opacity: navOpen ? 0 : 1, transition: 'opacity 0.22s' }} />
          <span className="bar bar2" style={{ position: 'absolute', left: 0, width: 28, height: 3.5, borderRadius: 2, background: '#343794', top: 12, opacity: navOpen ? 0 : 1, transition: 'opacity 0.22s' }} />
          <span className="bar bar3" style={{ position: 'absolute', left: 0, width: 28, height: 3.5, borderRadius: 2, background: '#343794', top: 21, opacity: navOpen ? 0 : 1, transition: 'opacity 0.22s' }} />
          {/* X icon */}
          <span className="x-bar x1" style={{ position: 'absolute', left: 0, top: 14, width: 28, height: 3.5, borderRadius: 2, background: '#343794', opacity: navOpen ? 1 : 0, transform: 'rotate(45deg)', transition: 'opacity 0.22s' }} />
          <span className="x-bar x2" style={{ position: 'absolute', left: 0, top: 14, width: 28, height: 3.5, borderRadius: 2, background: '#343794', opacity: navOpen ? 1 : 0, transform: 'rotate(-45deg)', transition: 'opacity 0.22s' }} />
        </span>
      </button>
      {/* Modal Navigation as dropdown below hamburger */}
      {navOpen && (
        <div
          className="gilbot-nav-modal"
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'transparent',
            zIndex: 2000,
          }}
          onClick={() => setNavOpen(false)}
        >
          <div
            style={{
              position: 'absolute',
              top: 72, // 48px button + 24px margin
              right: 32,
              background: '#fff',
              borderRadius: 18,
              boxShadow: '0 8px 32px #0002',
              padding: 24,
              minWidth: 180,
              maxWidth: 240,
              width: '90vw',
              display: 'flex',
              flexDirection: 'column',
              gap: 16,
              alignItems: 'stretch',
              zIndex: 2001,
            }}
            onClick={e => e.stopPropagation()}
          >
            <button
              style={{
                width: '100%',
                padding: '14px 0',
                fontSize: '1.1em',
                fontWeight: 700,
                color: tab === 'chat' ? '#fff' : '#343794',
                background: tab === 'chat' ? '#343794' : '#f3eeff',
                border: 'none',
                borderRadius: 10,
                marginBottom: 8,
                cursor: 'pointer',
                transition: 'background 0.2s',
              }}
              onClick={() => { setTab('chat'); setNavOpen(false); }}
            >
              Chat
            </button>
            <button
              style={{
                width: '100%',
                padding: '14px 0',
                fontSize: '1.1em',
                fontWeight: 700,
                color: tab === 'ideas' ? '#fff' : '#343794',
                background: tab === 'ideas' ? '#343794' : '#f3eeff',
                border: 'none',
                borderRadius: 10,
                cursor: 'pointer',
                transition: 'background 0.2s',
              }}
              onClick={() => { setTab('ideas'); setNavOpen(false); }}
            >
              Ideas
            </button>
            <button
              style={{
                width: '100%',
                padding: '14px 0',
                fontSize: '1.1em',
                fontWeight: 700,
                color: tab === 'settings' ? '#fff' : '#343794',
                background: tab === 'settings' ? '#343794' : '#f3eeff',
                border: 'none',
                borderRadius: 10,
                cursor: 'pointer',
                transition: 'background 0.2s',
              }}
              onClick={() => { setTab('settings'); setNavOpen(false); }}
            >
              Settings
            </button>
          </div>
        </div>
      )}
      <div className="gilbot-body">
        {error && (
          <div style={{ color: '#d9534f', background: '#fff0f0', padding: '12px 24px', borderRadius: 12, marginBottom: 18, textAlign: 'center', fontWeight: 600 }}>
            {error}
          </div>
        )}
        {tab === 'settings' ? (
          <Settings onSave={setSettings} initialValues={settings} />
        ) : tab === 'chat' ? (
          <>
            <div className="gilbot-chat-list" ref={chatRef} style={{ position: 'relative' }}>
              <div className="gilbot-chat-fade-top" />
              {messages.map((m, i) => (
                <div
                  key={i}
                  className={`gilbot-bubble ${m.sender === 'user' ? 'gilbot-user' : 'gilbot-bot'}`}
                  style={{ alignSelf: m.sender === 'user' ? 'flex-end' : 'flex-start' }}
                >
                  {m.type === 'loadingGif' && m.gif ? (
                    <img src={m.gif} alt="Loading..." style={{ width: 160, height: 160, borderRadius: 18, boxShadow: '0 2px 8px #e7e7fa' }} />
                  ) : (
                    m.text.split('\n').map((line, idx) => (
                      <React.Fragment key={idx}>
                        {line}
                        <br />
                      </React.Fragment>
                    ))
                  )}
                </div>
              ))}
              <div ref={bottomRef} />
            </div>
            <form className="gilbot-input-bar" onSubmit={handleSubmit}>
              <div className="gilbot-input-bar-inner">
                <textarea
                  className="gilbot-input"
                  value={input}
                  onChange={handleInputChange}
                  onKeyDown={handleKeyDown}
                  placeholder="Type your message..."
                  rows={inputRows}
                  style={{ resize: 'none', minHeight: 44, maxHeight: 44 * maxRows, overflowY: inputRows === maxRows ? 'auto' : 'hidden' }}
                />
                <button
                  type="button"
                  className="gilbot-mic-btn"
                  onClick={handleMicClick}
                  style={{ background: recording ? '#d9534f' : '#9194E0', color: '#fff', border: 'none', borderRadius: 32, padding: '14px 18px', marginRight: 8, fontSize: '1.1em', fontWeight: 700, cursor: 'pointer', transition: 'background 0.2s' }}
                  disabled={loading}
                  aria-label={recording ? 'Stop recording' : 'Record voice'}
                >
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 1v14a4 4 0 0 0 4-4V5a4 4 0 0 0-8 0v6a4 4 0 0 0 4 4z"></path><line x1="19" y1="10" x2="19" y2="10"></line><line x1="5" y1="10" x2="5" y2="10"></line><line x1="12" y1="19" x2="12" y2="23"></line><line x1="8" y1="23" x2="16" y2="23"></line></svg>
                  {recording ? 'Stop' : ''}
                </button>
                <button className="gilbot-send-btn" type="submit" disabled={loading}>Send</button>
              </div>
            </form>
          </>
        ) : (
          <div style={{ flex: 1, width: '100%', padding: '32px 0 0 0', overflow: 'auto' }}>
            <div style={{ display: 'flex', gap: 16, marginBottom: 24, flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center' }}>
              <div className="gilbot-filter-group">
                <div className="gilbot-filter-label">Type</div>
                <select className="gilbot-filter-select" value={filterPostType} onChange={e => setFilterPostType(e.target.value)}>
                  {getSortedOptions(POST_TYPES, 'type', true, ideasForType).map(type => {
                    if (!type) return <option key="" value="">All</option>;
                    const count = getMetaCounts('type', ideasForType)[type] || 0;
                    return <option key={type} value={type} disabled={count === 0} style={count === 0 ? { color: '#bbb' } : {}}>{type} ({count})</option>;
                  })}
                </select>
              </div>
              <div className="gilbot-filter-group">
                <div className="gilbot-filter-label">Topic</div>
                <select className="gilbot-filter-select" value={filterContentTopic} onChange={e => setFilterContentTopic(e.target.value)}>
                  {getSortedOptions(CONTENT_TOPICS, 'topic', true, ideasForTopic).map(type => {
                    if (!type) return <option key="" value="">All</option>;
                    const count = getMetaCounts('topic', ideasForTopic)[type] || 0;
                    return <option key={type} value={type} disabled={count === 0} style={count === 0 ? { color: '#bbb' } : {}}>{type} ({count})</option>;
                  })}
                </select>
              </div>
              <div className="gilbot-filter-group">
                <div className="gilbot-filter-label">Intent</div>
                <select className="gilbot-filter-select" value={filterIntent} onChange={e => setFilterIntent(e.target.value)}>
                  {getSortedOptions(INTENTS, 'intent', true, ideasForIntent).map(type => {
                    if (!type) return <option key="" value="">All</option>;
                    const count = getMetaCounts('intent', ideasForIntent)[type] || 0;
                    return <option key={type} value={type} disabled={count === 0} style={count === 0 ? { color: '#bbb' } : {}}>{type} ({count})</option>;
                  })}
                </select>
              </div>
              <div style={{ display: 'flex', gap: 8, marginLeft: 18 }}>
                <button
                  type="button"
                  className={ideasView === 'grid' ? 'gilbot-view-toggle selected' : 'gilbot-view-toggle'}
                  onClick={() => setIdeasView('grid')}
                  aria-label="Grid view"
                  style={{ background: 'none', border: 'none', padding: 6, borderRadius: 8, cursor: 'pointer', color: ideasView === 'grid' ? '#343794' : '#bbb', outline: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
                </button>
                <button
                  type="button"
                  className={ideasView === 'list' ? 'gilbot-view-toggle selected' : 'gilbot-view-toggle'}
                  onClick={() => setIdeasView('list')}
                  aria-label="List view"
                  style={{ background: 'none', border: 'none', padding: 6, borderRadius: 8, cursor: 'pointer', color: ideasView === 'list' ? '#343794' : '#bbb', outline: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><circle cx="4" cy="6" r="2"/><circle cx="4" cy="12" r="2"/><circle cx="4" cy="18" r="2"/></svg>
                </button>
                <button
                  type="button"
                  className={ideasView === 'carousel' ? 'gilbot-view-toggle selected' : 'gilbot-view-toggle'}
                  onClick={() => setIdeasView('carousel')}
                  aria-label="Carousel view"
                  style={{ background: 'none', border: 'none', padding: 6, borderRadius: 8, cursor: 'pointer', color: ideasView === 'carousel' ? '#343794' : '#bbb', outline: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="10" rx="5"/><circle cx="7" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="17" cy="12" r="2"/></svg>
                </button>
              </div>
              <div style={{ marginLeft: 18, minWidth: 120 }}>
                <div className="gilbot-filter-label" style={{ textAlign: 'center' }}>Group By</div>
                <select
                  className="gilbot-filter-select"
                  value={groupBy}
                  onChange={e => setGroupBy(e.target.value)}
                  style={{ width: '100%' }}
                >
                  <option value="none">None</option>
                  <option value="type">Type</option>
                  <option value="topic">Topic</option>
                  <option value="intent">Intent</option>
                </select>
              </div>
            </div>
            <div className={ideasView === 'grid' ? 'gilbot-grid' : ideasView === 'carousel' ? 'gilbot-carousel' : 'gilbot-list'}>
              {ideasView === 'carousel' ? (
                filteredIdeas.length === 0 ? (
                  <div style={{ color: '#888', textAlign: 'center', marginTop: 40 }}>No ideas yet. Add some in the chat!</div>
                ) : (
                  <Swiper
                    spaceBetween={24}
                    slidesPerView={1}
                    centeredSlides={true}
                    grabCursor={true}
                    style={{ padding: '24px 0', width: '100%', maxWidth: 400 }}
                  >
                    {filteredIdeas.map((idea, i) => (
                      <SwiperSlide key={idea.id}>
                        <div className="google-keep-card" style={{ 
                          background: '#fff', 
                          borderRadius: '8px', 
                          boxShadow: '0 1px 2px 0 rgba(60,64,67,0.3), 0 1px 3px 1px rgba(60,64,67,0.15)', 
                          padding: '16px', 
                          margin: '8px', 
                          width: '240px', 
                          transition: 'box-shadow 0.2s ease', 
                          cursor: 'pointer' 
                        }}>
                          <div style={{ fontSize: '16px', fontWeight: '500', marginBottom: '8px' }}>{idea.text}</div>
                          {idea.type && <div style={{ fontSize: '14px', color: '#5f6368' }}>Type: {idea.type}</div>}
                          {idea.topic && <div style={{ fontSize: '14px', color: '#5f6368' }}>Topic: {idea.topic}</div>}
                          {idea.intent && <div style={{ fontSize: '14px', color: '#5f6368' }}>Intent: {idea.intent}</div>}
                          {idea.status && <div style={{ fontSize: '14px', color: '#5f6368' }}>Status: {idea.status}</div>}
                          {idea.audience && <div style={{ fontSize: '14px', color: '#5f6368' }}>Audience: {idea.audience}</div>}
                        </div>
                      </SwiperSlide>
                    ))}
                  </Swiper>
                )
              ) : filteredIdeas.length === 0 ? (
                <div style={{ color: '#888', textAlign: 'center', marginTop: 40, gridColumn: '1/-1' }}>No ideas yet. Add some in the chat!</div>
              ) : groupedIdeas.map(({ group, items }) => (
                <React.Fragment key={group || 'none'}>
                  {ideasView === 'list' && groupBy !== 'none' && (
                    <div style={{ textAlign: 'center', fontSize: '2.2em', fontWeight: 800, color: '#343794', margin: '32px 0 12px 0', width: '100%' }}>{group}</div>
                  )}
                  {items.map((idea, i) => {
                    if (ideasView === 'grid') {
                      return (
                        <div
                          key={idea.id}
                          className="google-keep-card"
                          style={{ 
                            background: '#fff', 
                            borderRadius: '8px', 
                            boxShadow: '0 1px 2px 0 rgba(60,64,67,0.3), 0 1px 3px 1px rgba(60,64,67,0.15)', 
                            padding: '16px', 
                            margin: '8px', 
                            width: '240px', 
                            transition: 'box-shadow 0.2s ease', 
                            cursor: 'pointer' 
                          }}
                          onClick={() => setDetailIdea(idea)}
                        >
                          <div style={{ fontSize: '16px', fontWeight: '500', marginBottom: '8px' }}>{idea.text}</div>
                          {idea.type && <div style={{ fontSize: '14px', color: '#5f6368' }}>Type: {idea.type}</div>}
                          {idea.topic && <div style={{ fontSize: '14px', color: '#5f6368' }}>Topic: {idea.topic}</div>}
                          {idea.intent && <div style={{ fontSize: '14px', color: '#5f6368' }}>Intent: {idea.intent}</div>}
                          {idea.status && <div style={{ fontSize: '14px', color: '#5f6368' }}>Status: {idea.status}</div>}
                          {idea.audience && <div style={{ fontSize: '14px', color: '#5f6368' }}>Audience: {idea.audience}</div>}
                        </div>
                      );
                    } else {
                      return (
                        <div
                          key={idea.id}
                          className="gilbot-list-row"
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 18,
                            background: '#fff',
                            borderRadius: 18,
                            boxShadow: '0 2px 8px #e7e7fa',
                            padding: '18px 24px',
                            marginBottom: 12,
                            minHeight: 72,
                            position: 'relative',
                            cursor: 'pointer'
                          }}
                          onClick={() => setDetailIdea(idea)}
                        >
                          {idea.imageUrl && (
                            <img src={getImageUrl(idea.imageUrl)} alt="Idea" style={{ width: 56, height: 56, borderRadius: 12, objectFit: 'cover', flexShrink: 0 }} />
                          )}
                          <div style={{ fontWeight: 700, fontSize: '1.08em', color: '#343794', flex: 1, minWidth: 0, textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                            {editingTitleId === idea.id ? (
                              <textarea
                                value={idea.hook || ''}
                                autoFocus
                                rows={1}
                                style={{
                                  fontWeight: 700,
                                  fontSize: '1.18em',
                                  color: '#343794',
                                  flex: 1,
                                  minWidth: 0,
                                  textOverflow: 'ellipsis',
                                  overflow: 'hidden',
                                  whiteSpace: 'pre-wrap',
                                  border: 'none',
                                  outline: 'none',
                                  background: 'transparent',
                                  borderRadius: 0,
                                  padding: 0,
                                  resize: 'none',
                                  width: '100%',
                                  boxSizing: 'border-box',
                                  lineHeight: 1.3,
                                  margin: 0,
                                  display: 'block',
                                  transition: 'none',
                                }}
                                onChange={e => {
                                  const val = e.target.value;
                                  setIdeas(prev => prev.map(idObj => idObj.id === idea.id ? { ...idObj, hook: val } : idObj));
                                  // Auto-resize
                                  e.target.style.height = 'auto';
                                  e.target.style.height = e.target.scrollHeight + 'px';
                                }}
                                onBlur={async e => {
                                  setEditingTitleId(null);
                                  await fetch(getApiUrl(`/ideas/${idea.id}`), {
                                    method: 'PATCH',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ hook: e.target.value })
                                  });
                                }}
                                onKeyDown={async e => {
                                  if (e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault();
                                    setEditingTitleId(null);
                                    await fetch(getApiUrl(`/ideas/${idea.id}`), {
                                      method: 'PATCH',
                                      headers: { 'Content-Type': 'application/json' },
                                      body: JSON.stringify({ hook: e.target.value })
                                    });
                                  }
                                }}
                              />
                            ) : (
                              <span
                                className="ca-card-hook editable-title"
                                style={{ cursor: 'pointer', textDecoration: 'underline dotted #343794 1.5px', textUnderlineOffset: 4 }}
                                onDoubleClick={e => {
                                  e.stopPropagation();
                                  setEditingTitleId(idea.id);
                                }}
                                title="Double-click to edit title"
                              >
                                {idea.hook || idea.text}
                              </span>
                            )}
                          </div>
                          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginLeft: 8, marginRight: 16 }}>
                            {idea.type && <span className="ca-card-tag" style={{ padding: '4px 12px', fontSize: '0.98em' }}>{idea.type}</span>}
                            {idea.topic && <span className="ca-card-tag" style={{ padding: '4px 12px', fontSize: '0.98em' }}>{idea.topic}</span>}
                            {idea.intent && <span className="ca-card-tag" style={{ padding: '4px 12px', fontSize: '0.98em' }}>{idea.intent}</span>}
                          </div>
                          <button
                            className="ca-card-edit-btn"
                            type="button"
                            onClick={e => {
                              e.stopPropagation();
                              setIdeas(prev => prev.map(idObj => idObj.id === idea.id ? { ...idObj, _editingMeta: true } : idObj));
                            }}
                            aria-label="Edit meta"
                          >
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="5" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="12" cy="19" r="1.5"/></svg>
                          </button>
                        </div>
                      );
                    }
                  })}
                </React.Fragment>
              ))}
            </div>
            {ideas.length > 0 && (
              <button
                style={{
                  margin: '36px auto 0 auto',
                  display: 'block',
                  background: '#d9534f',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 18,
                  padding: '18px 36px',
                  fontSize: '1.2em',
                  fontWeight: 700,
                  cursor: 'pointer',
                  boxShadow: '0 2px 8px #e7e7fa',
                  letterSpacing: '0.02em',
                  transition: 'background 0.2s',
                }}
                onClick={async () => {
                  if (window.confirm('Are you sure you want to delete ALL your ideas? This cannot be undone.')) {
                    await fetch(getApiUrl('/ideas'), { method: 'DELETE' });
                    setIdeas([]);
                  }
                }}
              >
                Delete All Ideas
              </button>
            )}
            {detailIdea && (
              <div style={{
                position: 'fixed',
                top: 0, left: 0, right: 0, bottom: 0,
                background: 'rgba(0,0,0,0.32)',
                zIndex: 1000,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
                onClick={() => setDetailIdea(null)}
              >
                <div
                  style={{
                    background: '#fff',
                    borderRadius: 18,
                    boxShadow: '0 8px 32px #0002',
                    padding: 36,
                    minWidth: 320,
                    maxWidth: 480,
                    width: '90vw',
                    maxHeight: '80vh',
                    overflowY: 'auto',
                    position: 'relative',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 18,
                  }}
                  onClick={e => e.stopPropagation()}
                >
                  <button
                    style={{
                      position: 'absolute',
                      top: 18,
                      right: 18,
                      background: '#343794',
                      color: '#fff',
                      border: 'none',
                      borderRadius: 16,
                      padding: '6px 18px',
                      fontWeight: 700,
                      fontSize: '1em',
                      cursor: 'pointer',
                    }}
                    onClick={() => setDetailIdea(null)}
                    autoFocus
                  >
                    Close
                  </button>
                  <div style={{ fontSize: '1.4em', fontWeight: 700, marginBottom: 8 }}>{detailIdea.hook}</div>
                  <div style={{ color: '#343794', fontWeight: 600, marginBottom: 8 }}>Full Original:</div>
                  <div style={{ whiteSpace: 'pre-wrap', fontSize: '1.1em', color: '#222', marginBottom: 18 }}>{detailIdea.original}</div>
                  <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 12 }}>
                    {detailIdea.type && <span style={{ background: '#f3eeff', color: '#343794', borderRadius: 18, padding: '6px 16px', fontWeight: 600 }}>{detailIdea.type}</span>}
                    {detailIdea.topic && <span style={{ background: '#f3eeff', color: '#343794', borderRadius: 18, padding: '6px 16px', fontWeight: 600 }}>{detailIdea.topic}</span>}
                    {detailIdea.intent && <span style={{ background: '#f3eeff', color: '#343794', borderRadius: 18, padding: '6px 16px', fontWeight: 600 }}>{detailIdea.intent}</span>}
                    <span style={{ color: '#aaa', fontWeight: 400, marginLeft: 8 }}>{formatDate(detailIdea.createdAt)}</span>
                  </div>
                  {detailIdea && detailIdea.imageUrl && (
                    <img src={getImageUrl(detailIdea.imageUrl)} alt="Idea" style={{ width: 192, height: 192, borderRadius: 18, objectFit: 'cover', display: 'block', margin: '18px auto 0 auto' }} />
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
} 