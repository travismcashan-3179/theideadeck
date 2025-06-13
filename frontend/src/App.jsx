import React, { useEffect, useRef, useState } from 'react';
import './KeepGrid.css';
import { Sortable } from '@shopify/draggable';

const initialNotes = [
  { id: '1', text: 'Caught up with bestie over dinner and business talk in San Antonio.' },
  { id: '2', text: 'Strapped down two refrigerators in the back of my truck in 105-degree Texas sun.' },
  { id: '3', text: 'Found a smaller fridge for $300 as a secondary.' },
  { id: '4', text: '"Dealing with a second fridge breakdown in 2 years - time for an upgrade!"' },
  { id: '5', text: '360 Feedback exercise' },
  { id: '6', text: 'Life is too short to read a shitty book' },
  { id: '7', text: 'Read 100 posts on X and summarize' },
  { id: '8', text: "I'll die on this hill…" },
  { id: '9', text: 'MINE MY COMMENTS' },
  { id: '10', text: 'Watching star wars and star wars rebels' },
  { id: '11', text: "It's safer to post bland content that be our authentic self" },
  { id: '12', text: "I've listened to step into your greatness 50+ times" },
  { id: '13', text: "I'm convinced we are all making LinkedIn too hard" }
];

export default function App() {
  const [notes, setNotes] = useState(initialNotes);
  const gridRef = useRef(null);

  useEffect(() => {
    if (!gridRef.current) return;
    const draggable = new Sortable(gridRef.current, {
      draggable: '.keep-card',
      mirror: {
        constrainDimensions: true
      }
    });
    draggable.on('sortable:stop', (evt) => {
      const { oldIndex, newIndex } = evt;
      if (oldIndex !== newIndex) {
        setNotes(prev => {
          const updated = [...prev];
          const [moved] = updated.splice(oldIndex, 1);
          updated.splice(newIndex, 0, moved);
          return updated;
        });
      }
    });
    return () => {
      draggable.destroy();
    };
  }, [notes]);

  return (
    <div className="keep-root">
      <h1 className="keep-title">My Notes</h1>
      <div className="keep-grid" ref={gridRef}>
        {notes.map(note => (
          <div className="keep-card" key={note.id} data-id={note.id}>
            {note.text}
          </div>
        ))}
      </div>
    </div>
  );
} 