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

// Add new helper for single-file FormData
function getFormDataSingle(file, name) {
  const fd = new FormData();
  fd.append(name, file);
  return fd;
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
  const [icpTags, setIcpTags] = useState(
    initialValues?.customerProfile ? initialValues.customerProfile.split(',').map(t => t.trim()).filter(Boolean) : []
  );
  const [topicPillarsTags, setTopicPillarsTags] = useState(
    initialValues?.topicPillars ? initialValues.topicPillars.split(',').map(t => t.trim()).filter(Boolean) : []
  );
  const [loading, setLoading] = useState(''); // which field is loading
  const [error, setError] = useState('');

  const cleanTag = (tag) => {
    return tag
      .replace(/^[\s*-]+/, '')
      .replace(/^[0-9]+\.?\s*/, '')
      .replace(/\*+/g, '')
      .replace(/^(the user('|'?)s?|discipline|market|ideal customer profile|topic pillars|:|\s)+/i, '')
      .replace(/\s+/g, ' ')
      .replace(/[,.;:]+$/, '')
      .trim();
  };

  // Analyze Discipline (profile only)
  const handleAnalyzeDiscipline = async () => {
    if (!profileFile) {
      setError('Please upload your profile PDF.');
      return;
    }
    setLoading('discipline');
    setError('');
    try {
      const formData = getFormDataSingle(profileFile, 'profile');
      const res = await fetch('https://theideadeck.onrender.com/api/analyze-discipline', {
        method: 'POST',
        body: formData
      });
      if (!res.ok) throw new Error('Failed to analyze discipline');
      const data = await res.json();
      setDisciplineTags((data.discipline || '').split(/,|\n/).map(cleanTag).filter(Boolean).slice(0,5));
    } catch (err) {
      setError('Discipline analysis failed.');
    }
    setLoading('');
  };

  // Analyze Market (profile only)
  const handleAnalyzeMarket = async () => {
    if (!profileFile) {
      setError('Please upload your profile PDF.');
      return;
    }
    setLoading('market');
    setError('');
    try {
      const formData = getFormDataSingle(profileFile, 'profile');
      const res = await fetch('https://theideadeck.onrender.com/api/analyze-market', {
        method: 'POST',
        body: formData
      });
      if (!res.ok) throw new Error('Failed to analyze market');
      const data = await res.json();
      setMarketTags((data.market || '').split(/,|\n/).map(cleanTag).filter(Boolean).slice(0,5));
    } catch (err) {
      setError('Market analysis failed.');
    }
    setLoading('');
  };

  // Analyze ICP (profile + posts)
  const handleAnalyzeICP = async () => {
    if (!profileFile || !postsFile) {
      setError('Please upload both your profile PDF and posts CSV.');
      return;
    }
    setLoading('icp');
    setError('');
    try {
      const formData = new FormData();
      formData.append('profile', profileFile);
      formData.append('posts', postsFile);
      const res = await fetch('https://theideadeck.onrender.com/api/analyze-icp', {
        method: 'POST',
        body: formData
      });
      if (!res.ok) throw new Error('Failed to analyze ICP');
      const data = await res.json();
      setIcpTags((data.customerProfile || '').split(/,|\n/).map(cleanTag).filter(Boolean).slice(0,5));
    } catch (err) {
      setError('ICP analysis failed.');
    }
    setLoading('');
  };

  // Analyze Topic Pillars (posts only)
  const handleAnalyzeTopicPillars = async () => {
    if (!postsFile) {
      setError('Please upload your posts CSV.');
      return;
    }
    setLoading('topicPillars');
    setError('');
    try {
      const formData = getFormDataSingle(postsFile, 'posts');
      const res = await fetch('https://theideadeck.onrender.com/api/analyze-topic-pillars', {
        method: 'POST',
        body: formData
      });
      if (!res.ok) throw new Error('Failed to analyze topic pillars');
      const data = await res.json();
      setTopicPillarsTags((data.topicPillars || '').split(/,|\n/).map(cleanTag).filter(Boolean).slice(0,5));
    } catch (err) {
      setError('Topic Pillars analysis failed.');
    }
    setLoading('');
  };

  const handleSave = () => {
    if (onSave) {
      onSave({
        discipline: disciplineTags.join(', '),
        market: marketTags.join(', '),
        customerProfile: icpTags.join(', '),
        topicPillars: topicPillarsTags.join(', ')
      });
    }
  };

  return (
    <div style={{ maxWidth: 700, margin: '0 auto', padding: 40, background: '#fff', borderRadius: 16, boxShadow: '0 2px 16px rgba(0,0,0,0.07)', fontFamily: 'inherit' }}>
      <h2 style={{ fontSize: 32, fontWeight: 800, marginBottom: 32, letterSpacing: '-1px' }}>Settings</h2>
      <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', marginBottom: 32 }}>
        <div style={{ flex: 1, minWidth: 220 }}>
          <label style={{ fontWeight: 600, fontSize: 16, marginBottom: 8, display: 'block' }}>Profile PDF
            <input type="file" accept="application/pdf" onChange={e => setProfileFile(e.target.files[0])} style={{ marginTop: 8, width: '100%' }} />
          </label>
        </div>
        <div style={{ flex: 1, minWidth: 220 }}>
          <label style={{ fontWeight: 600, fontSize: 16, marginBottom: 8, display: 'block' }}>Posts CSV
            <input type="file" accept=".csv" onChange={e => setPostsFile(e.target.files[0])} style={{ marginTop: 8, width: '100%' }} />
          </label>
        </div>
      </div>
      {error && <div style={{ color: '#d9534f', marginBottom: 24, fontWeight: 600, fontSize: 16 }}>{error}</div>}
      <TagInput
        label="Discipline (What do you do?)"
        tags={disciplineTags}
        setTags={setDisciplineTags}
        placeholder="Add a service (e.g. web design)"
        maxTags={5}
      />
      <button
        onClick={handleAnalyzeDiscipline}
        disabled={loading === 'discipline'}
        style={{
          background: 'linear-gradient(90deg, #6a82fb 0%, #fc5c7d 100%)',
          color: '#fff', border: 'none', borderRadius: 8, padding: '10px 24px', fontWeight: 700, fontSize: 16,
          marginBottom: 18, marginRight: 12, boxShadow: '0 2px 8px rgba(100,100,150,0.07)', cursor: loading === 'discipline' ? 'not-allowed' : 'pointer', opacity: loading === 'discipline' ? 0.7 : 1
        }}
      >{loading === 'discipline' ? 'Analyzing...' : 'Analyze Discipline'}</button>
      <TagInput
        label="Market (Who do you do it for?)"
        tags={marketTags}
        setTags={setMarketTags}
        placeholder="Add a market (e.g. startups)"
        maxTags={5}
      />
      <button
        onClick={handleAnalyzeMarket}
        disabled={loading === 'market'}
        style={{
          background: 'linear-gradient(90deg, #43cea2 0%, #185a9d 100%)',
          color: '#fff', border: 'none', borderRadius: 8, padding: '10px 24px', fontWeight: 700, fontSize: 16,
          marginBottom: 18, marginRight: 12, boxShadow: '0 2px 8px rgba(100,100,150,0.07)', cursor: loading === 'market' ? 'not-allowed' : 'pointer', opacity: loading === 'market' ? 0.7 : 1
        }}
      >{loading === 'market' ? 'Analyzing...' : 'Analyze Market'}</button>
      <TagInput
        label="Ideal Customer Profile (ICP)"
        tags={icpTags}
        setTags={setIcpTags}
        placeholder="Add a customer profile keyword"
        maxTags={5}
      />
      <button
        onClick={handleAnalyzeICP}
        disabled={loading === 'icp'}
        style={{
          background: 'linear-gradient(90deg, #fc5c7d 0%, #6a82fb 100%)',
          color: '#fff', border: 'none', borderRadius: 8, padding: '10px 24px', fontWeight: 700, fontSize: 16,
          marginBottom: 18, marginRight: 12, boxShadow: '0 2px 8px rgba(100,100,150,0.07)', cursor: loading === 'icp' ? 'not-allowed' : 'pointer', opacity: loading === 'icp' ? 0.7 : 1
        }}
      >{loading === 'icp' ? 'Analyzing...' : 'Analyze ICP'}</button>
      <TagInput
        label="Topic Pillars"
        tags={topicPillarsTags}
        setTags={setTopicPillarsTags}
        placeholder="Add a topic pillar (e.g. Leadership)"
        maxTags={5}
      />
      <button
        onClick={handleAnalyzeTopicPillars}
        disabled={loading === 'topicPillars'}
        style={{
          background: 'linear-gradient(90deg, #185a9d 0%, #43cea2 100%)',
          color: '#fff', border: 'none', borderRadius: 8, padding: '10px 24px', fontWeight: 700, fontSize: 16,
          marginBottom: 32, marginRight: 12, boxShadow: '0 2px 8px rgba(100,100,150,0.07)', cursor: loading === 'topicPillars' ? 'not-allowed' : 'pointer', opacity: loading === 'topicPillars' ? 0.7 : 1
        }}
      >{loading === 'topicPillars' ? 'Analyzing...' : 'Analyze Topic Pillars'}</button>
      <button
        onClick={handleSave}
        style={{
          background: 'linear-gradient(90deg, #43cea2 0%, #185a9d 100%)',
          color: '#fff', border: 'none', borderRadius: 8, padding: '14px 32px', fontWeight: 700, fontSize: 18,
          boxShadow: '0 2px 8px rgba(100,100,150,0.07)', cursor: 'pointer', transition: 'background 0.2s, box-shadow 0.2s',
        }}
      >Save</button>
    </div>
  );
} 