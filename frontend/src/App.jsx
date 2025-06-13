import React from 'react';
import './KeepGrid.css';

const notes = [
  { id: 1, text: 'Caught up with bestie over dinner and business talk in San Antonio.' },
  { id: 2, text: 'Strapped down two refrigerators in the back of my truck in 105-degree Texas sun.' },
  { id: 3, text: 'Found a smaller fridge for $300 as a secondary.' },
  { id: 4, text: '"Dealing with a second fridge breakdown in 2 years - time for an upgrade!"' },
  { id: 5, text: '360 Feedback exercise' },
  { id: 6, text: 'Life is too short to read a shitty book' },
  { id: 7, text: 'Read 100 posts on X and summarize' },
  { id: 8, text: "I'll die on this hill…" },
  { id: 9, text: 'MINE MY COMMENTS' },
  { id: 10, text: 'Watching star wars and star wars rebels' },
  { id: 11, text: 'It\'s safer to post bland content that be our authentic self' },
  { id: 12, text: "I've listened to step into your greatness 50+ times" },
  { id: 13, text: "I'm convinced we are all making LinkedIn too hard" }
];

export default function App() {
  return (
    <div className="keep-root">
      <h1 className="keep-title">My Notes</h1>
      <div className="keep-grid">
        {notes.map(note => (
          <div className="keep-card" key={note.id}>
            {note.text}
          </div>
        ))}
      </div>
    </div>
  );
} 