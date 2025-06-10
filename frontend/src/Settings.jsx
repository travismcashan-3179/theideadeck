import React, { useState, useRef } from 'react';

function TagInput({ label, tags, setTags, placeholder, maxTags = 5 }) {
  const inputRef = useRef();
  const [input, setInput] = useState('');

  const addTag = (value) => {
    const val = value.trim().replace(/,+$/, '');
    if (val && !tags.includes(val) && tags.length < maxTags) {
      setTags([...tags, val]);
    }
  };

  const handleInput = (e) => {
    setInput(e.target.value);
  };

  const handleKeyDown = (e) => {
    if ([',', 'Enter', 'Tab'].includes(e.key)) {
      e.preventDefault();
      if (input) {
        addTag(input);
        setInput('');
      }
    } else if (e.key === 'Backspace' && !input && tags.length) {
      setTags(tags.slice(0, -1));
    }
  };

  const removeTag = (idx) => {
    setTags(tags.filter((_, i) => i !== idx));
  };

  return (
    <div style={{ marginBottom: 28 }}>
      <label style={{ fontWeight: 600, fontSize: 16, marginBottom: 8, display: 'block' }}>{label}
        <div style={{
          display: 'flex', flexWrap: 'wrap', gap: 8, minHeight: 48, alignItems: 'center',
          border: '1px solid #ddd', borderRadius: 8, padding: '8px 8px', marginTop: 8, background: '#fafbfc'
        }}>
          {tags.map((tag, idx) => (
            <span key={tag+idx} style={{
              display: 'inline-flex', alignItems: 'center', background: '#e3e9f6', color: '#2d3a4a',
              borderRadius: 16, padding: '6px 14px 6px 14px', fontSize: 15, fontWeight: 500, position: 'relative',
              marginRight: 4, marginBottom: 4, transition: 'background 0.2s'
            }}>
              {tag}
              <span
                onClick={() => removeTag(idx)}
                style={{
                  marginLeft: 8, cursor: 'pointer', fontWeight: 700, color: '#888',
                  opacity: 0.7, fontSize: 16, transition: 'opacity 0.2s',
                  padding: '0 2px', borderRadius: 8,
                  ':hover': { opacity: 1, color: '#d9534f' }
                }}
                title="Remove"
                onMouseOver={e => e.target.style.opacity = 1}
                onMouseOut={e => e.target.style.opacity = 0.7}
              >×</span>
            </span>
          ))}
          {tags.length < maxTags && (
            <input
              ref={inputRef}
              value={input}
              onChange={handleInput}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              style={{
                border: 'none', outline: 'none', fontSize: 15, minWidth: 80, flex: 1, background: 'transparent',
                padding: 4, marginLeft: 2
              }}
              maxLength={32}
            />
          )}
        </div>
      </label>
      <div style={{ fontSize: 13, color: '#888', marginTop: 4 }}>{tags.length}/{maxTags} tags</div>
    </div>
  );
}

export default function Settings({ onSave, initialValues }) {
  const [profileFile, setProfileFile] = useState(null);
  const [postsFile, setPostsFile] = useState(null);
  const [disciplineTags, setDisciplineTags] = useState(
    initialValues?.discipline ? initialValues.discipline.split(',').map(t => t.trim()).filter(Boolean) : []
  );
  const [marketTags, setMarketTags] = useState(
    initialValues?.market ? initialValues.market.split(',').map(t => t.trim()).filter(Boolean) : []
  );
  const [customerProfile, setCustomerProfile] = useState(initialValues?.customerProfile || '');
  const [topicPillars, setTopicPillars] = useState(initialValues?.topicPillars || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleFileChange = (e, setter) => {
    if (e.target.files && e.target.files[0]) {
      setter(e.target.files[0]);
    }
  };

  const cleanTag = (tag) => {
    return tag
      .replace(/^[\s*-]+/, '') // leading spaces, asterisks, dashes
      .replace(/^[0-9]+\.?\s*/, '') // leading numbers
      .replace(/\*+/g, '') // all asterisks
      .replace(/^(the user('|'?)s?|discipline|market|:|\s)+/i, '') // leading phrases
      .replace(/\s+/g, ' ')
      .replace(/[,.;:]+$/, '') // trailing punctuation
      .trim();
  };

  const handleAnalyze = async () => {
    if (!profileFile || !postsFile) {
      setError('Please upload both your profile PDF and posts CSV.');
      return;
    }
    setLoading(true);
    setError('');
    const formData = new FormData();
    formData.append('profile', profileFile);
    formData.append('posts', postsFile);
    try {
      // Analyze discipline and market
      const res1 = await fetch('https://theideadeck.onrender.com/api/analyze-discipline-market', {
        method: 'POST',
        body: formData
      });
      if (!res1.ok) throw new Error('Failed to analyze discipline/market');
      const data1 = await res1.json();
      // Split by comma or new line, trim, filter empty, max 5
      setDisciplineTags((data1.discipline || '').split(/,|\n/)
        .map(t => cleanTag(t))
        .filter(t => t && t.length > 1 && !/^(the user|discipline|market)$/i.test(t))
        .slice(0,5));
      setMarketTags((data1.market || '').split(/,|\n/)
        .map(t => cleanTag(t))
        .filter(t => t && t.length > 1 && !/^(the user|discipline|market)$/i.test(t))
        .slice(0,5));
    } catch (err) {
      setError('Discipline/Market analysis failed.');
      setLoading(false);
      return;
    }
    try {
      // Need to re-create FormData because it is consumed after first fetch
      const formData2 = new FormData();
      formData2.append('profile', profileFile);
      formData2.append('posts', postsFile);
      const res2 = await fetch('https://theideadeck.onrender.com/api/analyze-topic-pillars', {
        method: 'POST',
        body: formData2
      });
      if (!res2.ok) throw new Error('Failed to analyze topic pillars');
      const data2 = await res2.json();
      setCustomerProfile(data2.customerProfile || '');
      setTopicPillars(data2.topicPillars || '');
    } catch (err) {
      setError('Topic Pillars analysis failed.');
      setLoading(false);
      return;
    }
    setLoading(false);
  };

  const handleSave = () => {
    if (onSave) {
      onSave({
        discipline: disciplineTags.join(', '),
        market: marketTags.join(', '),
        customerProfile,
        topicPillars
      });
    }
  };

  return (
    <div style={{ maxWidth: 700, margin: '0 auto', padding: 40, background: '#fff', borderRadius: 16, boxShadow: '0 2px 16px rgba(0,0,0,0.07)', fontFamily: 'inherit' }}>
      <h2 style={{ fontSize: 32, fontWeight: 800, marginBottom: 32, letterSpacing: '-1px' }}>Settings</h2>
      <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', marginBottom: 32 }}>
        <div style={{ flex: 1, minWidth: 220 }}>
          <label style={{ fontWeight: 600, fontSize: 16, marginBottom: 8, display: 'block' }}>Profile PDF
            <input type="file" accept="application/pdf" onChange={e => handleFileChange(e, setProfileFile)} style={{ marginTop: 8, width: '100%' }} />
          </label>
        </div>
        <div style={{ flex: 1, minWidth: 220 }}>
          <label style={{ fontWeight: 600, fontSize: 16, marginBottom: 8, display: 'block' }}>Posts CSV
            <input type="file" accept=".csv" onChange={e => handleFileChange(e, setPostsFile)} style={{ marginTop: 8, width: '100%' }} />
          </label>
        </div>
      </div>
      <button
        onClick={handleAnalyze}
        disabled={loading}
        style={{
          background: 'linear-gradient(90deg, #6a82fb 0%, #fc5c7d 100%)',
          color: '#fff',
          border: 'none',
          borderRadius: 8,
          padding: '14px 32px',
          fontWeight: 700,
          fontSize: 18,
          marginBottom: 32,
          boxShadow: '0 2px 8px rgba(100,100,150,0.07)',
          cursor: loading ? 'not-allowed' : 'pointer',
          transition: 'background 0.2s, box-shadow 0.2s',
          opacity: loading ? 0.7 : 1
        }}
      >
        {loading ? 'Analyzing...' : 'Analyze with AI'}
      </button>
      {error && <div style={{ color: '#d9534f', marginBottom: 24, fontWeight: 600, fontSize: 16 }}>{error}</div>}
      <TagInput
        label="Discipline (What do you do?)"
        tags={disciplineTags}
        setTags={setDisciplineTags}
        placeholder="Add a service (e.g. web design)"
        maxTags={5}
      />
      <TagInput
        label="Market (Who do you do it for?)"
        tags={marketTags}
        setTags={setMarketTags}
        placeholder="Add a market (e.g. startups)"
        maxTags={5}
      />
      <div style={{ marginBottom: 28 }}>
        <label style={{ fontWeight: 600, fontSize: 16, marginBottom: 8, display: 'block' }}>Ideal Customer Profile
          <textarea value={customerProfile} onChange={e => setCustomerProfile(e.target.value)} style={{ width: '100%', minHeight: 80, fontSize: 16, padding: 12, borderRadius: 8, border: '1px solid #ddd', marginTop: 8, resize: 'vertical' }} />
        </label>
      </div>
      <div style={{ marginBottom: 32 }}>
        <label style={{ fontWeight: 600, fontSize: 16, marginBottom: 8, display: 'block' }}>Topic Pillars
          <textarea value={topicPillars} onChange={e => setTopicPillars(e.target.value)} style={{ width: '100%', minHeight: 60, fontSize: 16, padding: 12, borderRadius: 8, border: '1px solid #ddd', marginTop: 8, resize: 'vertical' }} placeholder="Comma-separated (e.g. Leadership, SaaS, Product)" />
        </label>
      </div>
      <button
        onClick={handleSave}
        style={{
          background: 'linear-gradient(90deg, #43cea2 0%, #185a9d 100%)',
          color: '#fff',
          border: 'none',
          borderRadius: 8,
          padding: '14px 32px',
          fontWeight: 700,
          fontSize: 18,
          boxShadow: '0 2px 8px rgba(100,100,150,0.07)',
          cursor: 'pointer',
          transition: 'background 0.2s, box-shadow 0.2s',
        }}
      >
        Save
      </button>
    </div>
  );
} 