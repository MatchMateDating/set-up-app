// components/match/BlindMatchButton.js
import React from 'react';
import { FaUserSecret } from 'react-icons/fa';

const BlindMatchButton = ({ onClick }) => (
  <FaUserSecret onClick={onClick} className="blind-match-button" />
);

export default BlindMatchButton;
