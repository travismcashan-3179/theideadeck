import React, { useState } from 'react';
import './KeepGrid.css';
import { DndContext, closestCenter } from '@dnd-kit/core';
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

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

function SortableNote({ id, text }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 2 : 1,
    cursor: 'grab',
  };
  return (
    <div ref={setNodeRef} style={style} className="keep-card" {...attributes} {...listeners}>
      {text}
    </div>
  );
}

export default function App() {
  const [notes, setNotes] = useState(initialNotes);

  return (
    <div className="keep-root">
      <h1 className="keep-title">My Notes</h1>
      <DndContext
        collisionDetection={closestCenter}
        onDragEnd={event => {
          const { active, over } = event;
          if (active.id !== over?.id) {
            const oldIndex = notes.findIndex(n => n.id === active.id);
            const newIndex = notes.findIndex(n => n.id === over.id);
            setNotes(arrayMove(notes, oldIndex, newIndex));
          }
        }}
      >
        <SortableContext items={notes.map(n => n.id)} strategy={verticalListSortingStrategy}>
          <div className="keep-grid">
            {notes.map(note => (
              <SortableNote key={note.id} id={note.id} text={note.text} />
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
} 