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
      const res = await fetch('/api/analyze-linkedin', {
        method: 'POST',
        body: formData
      });
      if (!res.ok) throw new Error('Failed to analyze files');
      const data = await res.json();
      setDiscipline(data.discipline || '');
      setMarket(data.market || '');
      setCustomerProfile(data.customerProfile || '');
      setTopicPillars(data.topicPillars || '');
    } catch (err) {
      setError('Analysis failed.');
    }
    setLoading(false);
  };

  const handleSave = () => {
    if (onSave) {
      onSave({ discipline, market, customerProfile, topicPillars });
    }
  };

  return (
    <div style={{ maxWidth: 600, margin: '0 auto', padding: 32 }}>
      <h2>Settings</h2>
      <div style={{ marginBottom: 18 }}>
        <label>Profile PDF: <input type="file" accept="application/pdf" onChange={e => handleFileChange(e, setProfileFile)} /></label>
      </div>
      <div style={{ marginBottom: 18 }}>
        <label>Posts CSV: <input type="file" accept=".csv" onChange={e => handleFileChange(e, setPostsFile)} /></label>
      </div>
      <button onClick={handleAnalyze} disabled={loading} style={{ marginBottom: 24 }}>
        {loading ? 'Analyzing...' : 'Analyze with AI'}
      </button>
      {error && <div style={{ color: '#d9534f', marginBottom: 18 }}>{error}</div>}
      <div style={{ marginBottom: 18 }}>
        <label>Discipline:<br />
          <input type="text" value={discipline} onChange={e => setDiscipline(e.target.value)} style={{ width: '100%' }} />
        </label>
      </div>
      <div style={{ marginBottom: 18 }}>
        <label>Market:<br />
          <input type="text" value={market} onChange={e => setMarket(e.target.value)} style={{ width: '100%' }} />
        </label>
      </div>
      <div style={{ marginBottom: 18 }}>
        <label>Ideal Customer Profile:<br />
          <textarea value={customerProfile} onChange={e => setCustomerProfile(e.target.value)} style={{ width: '100%' }} />
        </label>
      </div>
      <div style={{ marginBottom: 18 }}>
        <label>Topic Pillars:<br />
          <input type="text" value={topicPillars} onChange={e => setTopicPillars(e.target.value)} style={{ width: '100%' }} placeholder="Comma-separated (e.g. Leadership, SaaS, Product)" />
        </label>
      </div>
      <button onClick={handleSave} style={{ fontWeight: 700, fontSize: '1.1em' }}>Save</button>
    </div>
  );
} 