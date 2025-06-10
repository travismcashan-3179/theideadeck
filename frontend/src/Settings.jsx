import React, { useState } from 'react';

export default function Settings({ onSave, initialValues }) {
  const [profileFile, setProfileFile] = useState(null);
  const [postsFile, setPostsFile] = useState(null);
  const [discipline, setDiscipline] = useState(initialValues?.discipline || '');
  const [market, setMarket] = useState(initialValues?.market || '');
  const [customerProfile, setCustomerProfile] = useState(initialValues?.customerProfile || '');
  const [topicPillars, setTopicPillars] = useState(initialValues?.topicPillars || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleFileChange = (e, setter) => {
    if (e.target.files && e.target.files[0]) {
      setter(e.target.files[0]);
    }
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
      setDiscipline(data1.discipline || '');
      setMarket(data1.market || '');
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
      onSave({ discipline, market, customerProfile, topicPillars });
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
      <div style={{ marginBottom: 28 }}>
        <label style={{ fontWeight: 600, fontSize: 16, marginBottom: 8, display: 'block' }}>Discipline
          <textarea value={discipline} onChange={e => setDiscipline(e.target.value)} style={{ width: '100%', minHeight: 60, fontSize: 16, padding: 12, borderRadius: 8, border: '1px solid #ddd', marginTop: 8, resize: 'vertical' }} />
        </label>
      </div>
      <div style={{ marginBottom: 28 }}>
        <label style={{ fontWeight: 600, fontSize: 16, marginBottom: 8, display: 'block' }}>Market
          <textarea value={market} onChange={e => setMarket(e.target.value)} style={{ width: '100%', minHeight: 60, fontSize: 16, padding: 12, borderRadius: 8, border: '1px solid #ddd', marginTop: 8, resize: 'vertical' }} />
        </label>
      </div>
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