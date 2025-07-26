// src/components/Conversations.js
import React from 'react';
import BottomTab from './bottomTab';

const Conversations = () => {
  return (
    <div style={{ paddingBottom: '60px' }}>
      <h2>Conversations Page</h2>
      {/* You can add your chat list here */}
      <BottomTab />
    </div>
  );
};

export default Conversations;
